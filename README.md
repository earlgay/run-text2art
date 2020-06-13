# run-text2art

This project is meant to provide a simple example of using [Cloud Run](https://cloud.google.com/run/) to execute an external command within a container to process incoming data from [Cloud Pub/Sub](https://cloud.google.com/pubsub) and export the results in [Cloud Storage](https://cloud.google.com/storage).

In short, the [Cloud Run](https://cloud.google.com/run/) service receives a push message from [Cloud Pub/Sub](https://cloud.google.com/pubsub) containing text. The text is then ran against the [figlet](http://www.figlet.org/) command within the container, and the resulting formatted text is saved into a *.txt* file on [Cloud Storage](https://cloud.google.com/storage).

## Deploy

In any instance of bracketed variables (i.e. *[EXAMPLE]*) within the commands, replace with appropriate value based on context.

### Create Cloud Storage Bucket

The service will store the output files in a Cloud Storage bucket. To create a new bucket:
```
gsutil mb gs://[BUCKET_NAME]/
```

### Deploy Service

To simplify deployment, it's recommended to use [crbt](https://github.com/GoogleCloudPlatform/crbt), which sets up a source repo, automatic builds, and automatic deploys. Otherwise, [build the container](https://cloud.google.com/cloud-build/docs/building/build-containers) and [deploy the service](https://cloud.google.com/cloud-build/docs/deploying-builds/deploy-cloud-run) as you would normally.

1. Deploy to Cloud Run and setup Cloud Build commit hooks to redeploy on commit to Cloud Source Repository (it will prompt you for a Cloud Storage bucket and region to use):

```
crbt init -p managed -l -b commit -m none
```

2. Get the service address: 
```
crbt status | grep "run-text2art:"
```

### Configure Pub/Sub

1. Create service account:

```
gcloud iam service-accounts create run-text2art-sa \
   --display-name "Service Account for run-text2art Cloud Run Service"
```

2. Give service account permission to invoke Cloud Run:

```
gcloud run services add-iam-policy-binding run-text2art \
   --member=serviceAccount:run-text2art-sa@[PROJECT_NAME].iam.gserviceaccount.com \
   --role=roles/run.invoker \
   --platform=managed \
   --region=[REGION]
```

3. Create Pub/Sub Topic: `gcloud pubsub topics create run-text2art-topic`
4. Allow Pub/Sub to create auth tokens:

```
gcloud projects add-iam-policy-binding [PROJECT_NAME] \
     --member=serviceAccount:service-[PROJECT_ID]@gcp-sa-pubsub.iam.gserviceaccount.com \
     --role=roles/iam.serviceAccountTokenCreator
```

5. Create Pub/Sub subscription with service account:

```
gcloud beta pubsub subscriptions create run-text2art-sub --topic run-text2art-topic \
   --push-endpoint=https://[SERVICE_URL]/ \
   --push-auth-service-account=run-text2art-sa@[PROJECT_NAME].iam.gserviceaccount.com
```

Further documentation:

-   Cloud Run > Documentation > [Triggering from Pub/Sub push](https://cloud.google.com/run/docs/triggering/pubsub-push)
-   Data Analytics Products > Cloud Pub/Sub > [Using push subscriptions](https://cloud.google.com/pubsub/docs/push)

## Testing

There are several ways to test the service:

1. **Locally**: Run everything on your local machine.
2. **Cloud Run through Cloud Pub/Sub**: Invoke the Cloud Run Service by generating a Cloud Pub/Sub message.

### Testing Locally

In this example, note that the message.data field must be [base64-encoded](https://tools.ietf.org/html/rfc4648#section-4), as it would be through Cloud Pub/Sub. Make sure you have `figlet` installed locally.

1. Install node modules: `npm install`
2. Start the service: `npm start`
3. Run a sample message through the service (feel free to replace `myname` and `earl`):

```
MESSAGE=$(echo '{"name": "myname", "text": "earl"}'|base64); curl -X POST 'http://localhost:8080' -H 'Content-Type: application/json' -d '{
 "message": {
   "attributes": {
     "key": "value"
   },
   "data": "'"$MESSAGE"'",
   "messageId": "123456789012"
 },
 "subscription": "projects/myproject/subscriptions/mysubscription"
}'
```

4. After pushing the sample message, the following should be visible:

```
earl@mars:~/Code/run-text2art$ npm start

> run-text2art@0.1.0 start /home/earl/Code/run-text2art
> node app.js

App listening on port 8080!
Received: {"name":"myname","text":"earl"}
Result saved to file: myname.txt
Skipping file save to Google Cloud Storage as no bucket is configured. Please configure either through environment variable ('BUCKET') or in-line.
```

5. Display the contents of the file (e.g. `myname.txt`):

```
                 _
  ___  __ _ _ __| |
 / _ \/ _` | '__| |
|  __/ (_| | |  | |
 \___|\__,_|_|  |_|
```

6. Delete the created file: `rm myname.txt`

### Testing Cloud Run through Cloud Pub/Sub

1. Test publishing a message:

```
gcloud pubsub topics publish run-text2art-topic --message '{"name": "myname", "text": "earl"}'
```

2. Check the Cloud Run logs for Cloud Storage URL:

```
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=run-text2art" --limit 10 | grep myname.txt
```


## Cleanup

1. Cleanup Cloud Source Repository, Cloud Build, Container Registry, and Cloud Run through crbt: 
```
crbt destroy
```
2. Delete service account:
```
gcloud iam service-accounts delete run-text2art-sa@[PROJECT_NAME].iam.gserviceaccount.com
```
3. Delete Pub/Sub subscription:
```
gcloud pubsub subscriptions delete run-text2art-sub
```
4. Delete Pub/Sub topic:
```
gcloud pubsub topics delete run-text2art-topic
```