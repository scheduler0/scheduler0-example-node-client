'use strict'

/**
 * The purpose of this program is to test the scheduler0 server.
 * It sends a request scheduler0 server and counts scheduler0 request to the callback url.
 * It's kinda like a scratch pad.
 * **/

require('dotenv').config()
const axios = require('axios')
const express = require('express')

const app = express()
const port = 3003

// Scheduler0 environment variables
const scheduler0Endpoint = process.env.API_ENDPOINT
const scheduler0ApiKey = process.env.API_KEY
const scheduler0ApiSecret = process.env.API_SECRET

const awsLambdaCloudResourceUrl = process.env.AWS_LAMBDA_CLOUD_RESOURCE_URL
const gcpCloudResourceUrl = process.env.GCP_CLOUD_RESOURCE_URL
const azureCloudResourceUrl = process.env.AZURE_CLOUD_RESOURCE_URL

const awsLambdaApiKey = process.env.AWS_LAMBDA_API_KEY
const awsLambdaApiSecret = process.env.AWS_LAMBDA_API_SECRET

const gcpCloudApiKey = process.env.GCP_CLOUD_API_KEY
const gcpCloudApiSecret = process.env.GCP_CLOUD_API_SECRET

const azureCloudApiKey = process.env.AZURE_CLOUD_API_KEY
const azureCloudApiSecret = process.env.AZURE_CLOUD_API_SECRET


const axiosInstance = axios.create({
    baseURL: scheduler0Endpoint,
    headers: {
        'x-api-key': scheduler0ApiKey,
        'x-secret-key': scheduler0ApiSecret,
        'x-account-id': 2
    }
});

axiosInstance.interceptors.request.use(request => {
    request.maxContentLength = Infinity;
    request.maxBodyLength = Infinity;
    return request;
});

async function createProject() {
    const { data: { data } } = await axiosInstance
        .post('/api/v1/projects', {
            name: "@sample project",
            description: "my reminder project",
            createdBy: "node-test-client"
        });
    return data
}

async function createJobs(projectID, executorID) {
    let payload = [];

    let startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() + 1);

    for (let i = 0; i < 1; i++) {
        for (let j = 0; j < 1; j++) {
            payload.push({
                spec: "@every 1m",
                executorId: executorID,
                projectId: projectID,
                startDate: startDate.toISOString(),
                data: JSON.stringify({jobId: i + j}),
                timezone: 'UTC',
                createdBy: "node-test-client"
            })
        }
    }

    console.log(`Creating ${payload.length} jobs`);

    try {
        const {data: {data}} = await axiosInstance
            .post('/api/v1/jobs', payload);
        console.log(data);
        payload = []
    } catch (err) {
        console.error(err.message);
        console.error(err.response.data);
    }
}

async function createWebhookExecutor() {
    const {data: {data}} = await axiosInstance
        .post('/api/v1/executors', {
            name: "my webhook executor",
            type: "webhook_url",
            webhookUrl: `http://localhost:${port}/callback`,
            webhookSecret: "secret",
            webhookHeaders: "{\"Content-Type\": \"application/json\"}",
            webhookMethod: "POST",
            webhookTimeout: 30,
            webhookRetries: 3,
            createdBy: "node-test-client"
        });
    return data
}

async function createAwsLambdaExecutor() {
    const {data: {data}} = await axiosInstance
        .post('/api/v1/executors', {
            name: "my aws lambda executor",
            type: "aws-lambda",
            region: "us-east-1",
            cloudProvider: "aws",
            cloudResourceUrl: awsLambdaCloudResourceUrl,
            cloudApiKey: awsLambdaApiKey,
            cloudApiSecret: awsLambdaApiSecret,
            createdBy: "node-test-client"
        });
    return data
}

async function createGcpCloudExecutor() {
    const {data: {data}} = await axiosInstance
        .post('/api/v1/executors', {
            name: "my gcp cloud executor",
            type: "gcp-cloud",
            region: "us-east-1",
            cloudProvider: "gcp",
            cloudResourceUrl: gcpCloudResourceUrl,
            cloudApiKey: gcpCloudApiKey,
            cloudApiSecret: gcpCloudApiSecret,
            createdBy: "node-test-client"
        });
    return data
}

async function createAzureCloudExecutor() {
    const {data: {data}} = await axiosInstance
        .post('/api/v1/executors', {
            name: "my azure cloud executor",
            type: "azure-cloud",
            region: "us-east-1",
            cloudProvider: "azure",
            cloudResourceUrl: azureCloudResourceUrl,
            cloudApiKey: azureCloudApiKey,
            cloudApiSecret: azureCloudApiSecret,
            createdBy: "node-test-client"
        });
    return data
}

const hits = new Map();

app.use(express.json({limit: '3mb'}));

app.post('/callback', (req, res) => {
    const payload =  req.body

    res.send(null);

    payload.forEach((payload) => {
        if (!hits.has(payload.id)) {
            hits.set(payload.id, 0);
        }

        hits.set(payload.id, hits.get(payload.id) + 1);
    })

    const hitCounts = new Map();

    const values = hits.values();
    let currentValue = values.next();
    while (currentValue) {
        const { value, done } = currentValue;

        if (done) {
            break;
        }

        if (!hitCounts.has(value)) {
            hitCounts.set(value, 0);
        }

        hitCounts.set(value, hitCounts.get(value) + 1);

        currentValue = values.next();
    }

    const min = Math.min(...Array.from(hits.values()));
    const max = Math.max(...Array.from(hits.values()));

    console.log(hits.size, hitCounts, min, max)
});

app.listen(port, async () => {
    let project = { id: 1 };
    let executor;
    
    const SKIP_CREATE = process.env.SKIP_PROJECT_CREATE === "1" &&
        process.env.SKIP_JOB_CREATE === "1"

    if (!SKIP_CREATE && process.env.SKIP_PROJECT_CREATE !== "1")
        project = await createProject();

    if (!SKIP_CREATE && process.env.SKIP_EXECUTOR_CREATE !== "1")
        executor = await createWebhookExecutor();

    // if (!SKIP_CREATE && process.env.SKIP_EXECUTOR_CREATE !== "1")
    //     await createAwsLambdaExecutor();

    // if (!SKIP_CREATE && process.env.SKIP_EXECUTOR_CREATE !== "1")
    //     await createGcpCloudExecutor();

    // if (!SKIP_CREATE && process.env.SKIP_EXECUTOR_CREATE !== "1")
    //     await createAzureCloudExecutor();

    if (!SKIP_CREATE && process.env.SKIP_JOB_CREATE !== "1")
        await createJobs(project.id, executor.id);

    console.log(`app listening at http://localhost:${port}`);
});