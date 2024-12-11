const fs = require("fs");
const express = require("express");
const app = express();
const path = require("path");
let portNumber = 5001;
const apiKey = process.env.RAPIDAPI_KEY;
const axios = require('axios');

const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
// sets up style.css so the template files can use them, to use just add the dependency inside the ejs
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));
//allows to use photos
app.use('/photos', express.static(path.join(__dirname, 'photos')));

require("dotenv").config({ path: path.resolve(__dirname, 'credentialsDontPost/.env') }) 
const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');
const client = new MongoClient(uri, {
    serverApi: ServerApiVersion.v1,
});

app.listen(portNumber, async () => {
    try {
        await client.connect(); 
        console.log(`Web server started at http://localhost:${portNumber}`);
        console.log(`Type "stop" to shut down the server.`);
    } catch (e) {
        console.error("Error connecting to MongoDB:", e);
        process.exit(1);
    }
});

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (dataInput) => {
    const command = dataInput.trim();
    if (command === "stop") {
        console.log("Shutting down the server");
        await client.close();
        process.exit(0);
    } else {
        console.log(`Invalid Command: ${input}`);
    }
});

app.get("/", (request, response) => {
    response.render("main");
});

app.get("/form", (request, response) => {
    response.render("form");
});

app.post("/form", async (request, response) => {
    const {longitude, latitude, name, grade} = request.body;

    const options = {
        method: 'GET',
        url: `https://open-weather13.p.rapidapi.com/city/latlon/${latitude}/${longitude}`,
        headers: {
            'x-rapidapi-host': 'open-weather13.p.rapidapi.com',
            'x-rapidapi-key': '8948917f7bmshb010232de0d97eap174dd5jsn9b26111a3b24', // Use the correct variable name here
        },
    };

    try {
        // Fetch weather data from the API
        const apiResponse = await axios.request(options);
        const weather = apiResponse.data;
        console.log("API Response:", weather);

        // Prepare data to pass to the EJS file
        const weatherData = {
            location: `Lon: ${longitude}, Lat: ${latitude}` || "Unknown Location",
            temperature: weather.main?.temp? (weather.main.temp - 273.15).toFixed(2) : "N/A",
            condition: weather.weather?.[0]?.description || "N/A",
            humidity: weather.main?.humidity || "N/A",
            windSpeed: weather.wind?.speed || "N/A",
            iconUrl: `https://openweathermap.org/img/wn/${weather.weather?.[0]?.icon}@2x.png`,
        };

        // Insert into MongoDB
        try {
            const person = { name, grade, longitude, latitude };
            await client.db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .insertOne(person);
            console.log("Record successfully inserted into MongoDB:", person);
        } catch (e) {
            console.error("Error inserting into MongoDB:", e);
        }
        response.render("displayWeather", { weatherData });
    } catch (error) {
        console.error("Error fetching weather data:", error);
        response.render("displayWeather", { weatherData: null });
    }
});

app.get("/output", async (request, response) => {
    try {
        const collection = client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection);
        const documents = await collection.find({}).toArray();
        const gradeStats = documents.reduce((a, doc) => {
            const grade = doc.grade;
            if (!a[grade]) {
                a[grade] = 0;
            }
            a[grade]++;
            return a;
        }, {});
        let table = "<table border='1'>";
        table += "<thead><tr><th>Grade</th><th>Count</th></tr></thead>";
        table += "<tbody>";
        for (const [grade, count] of Object.entries(gradeStats)) {
            table += `<tr><td>${grade}</td><td>${count}</td></tr>`;
        }
        table += "</tbody></table>";
        response.render("output", {table});
    } catch (e) {
        console.error("Error fetching output:", e);
    } 
});

app.get("/remove", (request, response) => {
    response.render("remove");
});

app.post("/processRemove", async (request, response) => {
    let num = await clear();
    response.render("processRemove", {num: num});
});

async function clear() {
    try {
        const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .deleteMany({});
        return result.deletedCount;
    } catch (e) {
        console.error(e);
    } 
}