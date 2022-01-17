const mongoose = require("mongoose") 
const {log} = require( "./logger")

function connect() {
    const dbUri = process.env.MONGO
    return mongoose
        .connect(dbUri, {
            useNewUrlParser: true, 
            useUnifiedTopology: true,
        })
        .then(() => {
            log.info("Database connected")
        })
        .catch(error=> {
            log.error("db error", error)
            process.exit(1)
        })
}

module.exports = {connect}