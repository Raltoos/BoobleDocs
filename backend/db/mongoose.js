require('dotenv').config();
const mongoose = require('mongoose')

const connectionURL = process.env.CONNECTION_STRING;

const connectDB = async () => {
    try{
        const connect = await mongoose.connect(connectionURL);
        console.log("Database connected",
            connect.connection.host,
            connect.connection.name
        )
    }catch (err){
        console.log("Database not connected", err);
    }
};

module.exports = connectDB;
