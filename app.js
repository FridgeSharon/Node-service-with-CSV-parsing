const express = require('express');
const app = express();
const port = 3000;
const {Sequelize, DataTypes} = require('sequelize');
const csv = require('csvtojson');
const fs = require('fs');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite'
});

app.use(express.json());

const Seller_Products = sequelize.define('seller_products', {
    asin: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    locale: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    seller_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    availability: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    product_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    product_link: {
        type: DataTypes.STRING,
        allowNull: false
    }
});
sequelize.sync().then(() => console.log('sequelize synced'));

const findeOne = (asin, locale) => {
    return Seller_Products.findOne({where: {asin, locale}});
}
const status400 = (res, message) => res.status(400).send(message);
const status200 = (res, message) => res.status(200).send(message);

app.get('/get/:asin/:locale', async (req, res) => {
    try {
        const {asin, locale} = req.params;
        if (!asin || asin === ":asin" || !locale || locale === ":locale") {
            status400(res, `Bad/missing properties: ASIN:'${asin}', Locale:'${locale}'`)
            return;
        }
        const data = await findeOne(asin, locale);
        if (!data) {
            status200('no product was found');
            return;
        }
        res.send(data);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/create/:sellerName', async (req, res) => {
    try {
        const {sellerName: seller_name} = req.params;
        if (await findeOne(req.body.asin, req.body.locale)) {
            status400(res, 'This product already exists');
            return;
        }
        const response = await Seller_Products.create({seller_name, ...req.body});
        res.send(response);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/update/:asin/:locale', async (req, res) => {
    try {
        const {asin, locale} = req.params;
        const {price, product_name, product_link} = req.body;
        const exists = await findeOne(asin, locale);
        if (!exists) {
            status200(res, 'no product was found to update');
            return;
        }
        await exists.update({asin, locale, price, product_name, product_link, seller_name: exists.seller_name})
        res.send(`Data updated with ID: ${asin}, ${locale}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/delete', async (req, res) => {
    try {
        const {products} = req.body;
        if (!products?.length) {
            status400(res, 'you sent nothing to delete');
            return;
        }
        const deletedSuccessfully = [];
        const failedToDelete = [];
        const promisesMap = products.map(async product => {
            const {asin, locale} = product;
            if (!asin || !locale) {
                failedToDelete.push({reason: `Bad/missing properties: ASIN:'${asin}', Locale:'${locale}'`, ...product})
                return;
            }
            const toRemove = await findeOne(asin, locale);
            if (!toRemove) {
                failedToDelete.push({reason: 'product not found', ...product});
                return;
            }
            await toRemove.destroy()
            deletedSuccessfully.push(product);
        })
        await Promise.all(promisesMap);
        res.json({
            failedToDelete, deletedSuccessfully
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/getBySeller/:sellerName', async (req, res) => {
    try {
        const {sellerName: seller_name} = req.params;
        const sellerData = await Seller_Products.findAll({where: {seller_name}});
        if (!sellerData) {
            status400(res, 'no seller data');
            return;
        }
        res.send(sellerData);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/getAnalysis', async (req, res) => {
    try {
        const report = await Seller_Products.findAll({
            attributes: [
                'seller_name',
                'locale',
                [Sequelize.fn('COUNT', Sequelize.col('availability')), 'available_products'],
                [Sequelize.literal('COUNT(*) - COUNT(`availability`)'), 'unavailable_products'],
                [Sequelize.fn('ROUND', Sequelize.fn('AVG', Sequelize.col('price')), 3), 'average_price']
            ],
            group: ['seller_name', 'locale']
        });

        res.send(report);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/upload', async (req, res) => {
    try {
        const csvUrl = req.body.url;
        const response = await fetch(csvUrl);
        const csvString = await response.text();
        const jsonArray = await csv({delimiter: ','}).fromString(csvString);
        res.json(jsonArray);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.post('/uploadLocal', async (req, res) => {
    try {
        const filename = req.body.url;
        const suffix = "_products.csv";
        if (!filename.endsWith(suffix)) {
            status400(res, 'files should use the format "seller_name_products.csv"')
        }
        const seller_name = filename.slice(0, -suffix.length);
        const csvFilePath = `${__dirname}/${req.body.url}`;
        const csvString = fs.readFileSync(csvFilePath, 'utf8');
        const jsonArray = await csv({delimiter: ','}).fromString(csvString);
        const failed = [];
        const created = [];

        // Comment next lines to bypass length limit
        if (jsonArray.length > 100) {
            status400(res, 'CSV file should not exceed max 100 products')
            return;
        }

        const promises = jsonArray.map(async product => {

            if (await findeOne(product.asin, product.locale)) {
                product.failReason = `this product already exists`;
                failed.push(product);
                return;
            }
            const createdProduct = await Seller_Products.create({seller_name, ...product});
            created.push(createdProduct);

        })
        await Promise.all(promises);
        const resBody = {
            'failedNumber': failed.length,
            'createdNumber': created.length,
            created,
            failed
        }

        res.json(resBody);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(port, () => {
    console.log(`Guy Sharon's RoundForest server is listening at http://localhost:${port}`);
})