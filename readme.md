# Express App with Sequelize and SQLite for Roundforest interview

This is an Express app that uses Sequelize to interact with an SQLite database.  
The app defines a `Seller_Products` model with the fields `asin`, `locale`, `seller_name`, `availability`, `price`, `product_name`, and `product_link`.  
All fields have `allowNull` set to `false` to simplify error checking.  
The app includes routes for getting, creating, updating, deleting products, getting products by seller name, getting analysis data, uploading data from a CSV file, and uploading data from a local CSV file.  
I used the demo files sent to me in the task to create the DB and test CSV Upload.

## Installation

1. Install dependencies: `npm install`
2. Run the app: `node app.js`

## Routes and Usage

- `GET` `/get/:asin/:locale`: Get a product by its `asin` and `locale` values.
- `GET` `/getBySeller/:sellerName`: Get all products by a seller name.
- `GET` `/getAnalysis`: Get analysis data on available and unavailable products and average price by seller name and locale.
- `POST` `/create/:sellerName`: Create a new product for the seller with the product data in the request body.
- `POST` `/update/:asin/:locale`: Update an existing product with the updated product data in the request body.
- `POST` `/delete`: Delete products with an array of products to delete in the request body.
- `POST` `/upload`: Upload data from a CSV file with the URL of the CSV file in the request body.
- `POST` `/uploadLocal`: Upload data from a local CSV file with the filename of the local CSV file in the request body.

## Usage
The app uses the already initialized `database.sqlite` in the root directory as its database.
You can import the `Roundforest server.postman_collection.json` to ease your tests of this app.