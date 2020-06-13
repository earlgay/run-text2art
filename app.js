/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const spawn = require('child_process').spawnSync;
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

let port = process.env.PORT || '8080';
let bucket = process.env.BUCKET || 'placeholder';

app.use(bodyParser.json());

app.post('/', async (req, res) => {
    if (!req.body) {
        const msg = 'no Pub/Sub message received';
        console.error(`error: ${msg}`);
        res.status(400).send(`Bad Request: ${msg}`);
        return;
    }
    if (!req.body.message) {
        const msg = 'invalid Pub/Sub message format';
        console.error(`error: ${msg}`);
        res.status(400).send(`Bad Request: ${msg}`);
        return;
    }

    // Cloud Pub/Sub sends messages in an object with that actual message in the data key, which is base64 encoded.
    // An example of the format Pub/Sub sends: https://cloud.google.com/pubsub/docs/push#receiving_push_messages
    let message = null;
    try {
        message = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString().trim());
    } catch (e) {
        console.error(`Error parsing message data: ${e}`);
        return;
    }

    // Run command against the message's text, and save it to a file on Google Cloud Storage.
    if (message) {
        console.log('Received: ' + JSON.stringify(message));

        let filename = message.name + '.txt';
        let result = spawn('figlet', [message.text]).stdout.toString('utf8');

        try {
            fs.writeFileSync(filename, result, 'utf8');
            console.log(`Result saved to file: ${filename}`);
        } catch (e) {
            console.error(`Error saving file: ${e}`);
            return;
        }

        if (bucket === 'placeholder') {
            console.error("Skipping file save to Google Cloud Storage as no bucket is configured. Please configure either through environment variable ('BUCKET').");
        } else {
            await storage.bucket(bucket).upload(filename, {
                gzip: true,
            });
            let url = `https://storage.cloud.google.com/${bucket}/${filename}`;
            console.log(`${filename} uploaded to ${bucket}: ${url}`);
        }
    }

    res.status(204).send(); // Acknowledge the message as successful.
});

app.listen(port, function () {
    console.log(`App listening on port ${port}!`);
});
