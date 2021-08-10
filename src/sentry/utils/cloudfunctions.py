from io import BytesIO
from zipfile import ZipFile

import requests
from google.api_core.retry import Retry
from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.types import (
    CloudFunction,
    CreateFunctionRequest,
    EventTrigger,
    GenerateUploadUrlRequest,
    ListFunctionsRequest,
)
from google.cloud.pubsub_v1 import PublisherClient

WRAPPER_JS = """
const userFunc = require('./user.js');
exports.start = (message, context) => {
  if (!userFunc) {
    console.error("Your code needs to export a function. module.export = () => {}");
    return;
  }
  if (typeof userFunc !== 'function') {
    console.error("Your code needs to export a function. Instead, " + typeof userFunc + " was exported.");
    return;
  }
  const event = JSON.parse(Buffer.from(message.data, 'base64').toString());
  userFunc(event);
};
"""
import time

from google.cloud import storage


def function_pubsub_name(funcId):
    return "projects/hackweek-sentry-functions/topics/fn-" + funcId


def create_function_pubsub_topic(funcId):
    publisher = PublisherClient()
    publisher.create_topic(name=function_pubsub_name(funcId))


def create_function(code, funcId, env_variables):
    create_function_pubsub_topic(funcId)
    f = BytesIO()
    with ZipFile(f, "w") as codezip:
        codezip.writestr("user.js", code)
        codezip.writestr("index.js", WRAPPER_JS)
    f.seek(0)

    client = CloudFunctionsServiceClient()
    upload_url = client.generate_upload_url(
        request=GenerateUploadUrlRequest(
            parent="projects/hackweek-sentry-functions/locations/us-central1"
        )
    ).upload_url
    requests.put(
        upload_url,
        data=f,
        headers={"content-type": "application/zip", "x-goog-content-length-range": "0,104857600"},
    )
    client.create_function(
        function=CloudFunction(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-" + funcId,
            description="created by api",
            source_upload_url=upload_url,
            runtime="nodejs14",
            entry_point="start",
            event_trigger=EventTrigger(
                event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                resource=function_pubsub_name(funcId),
            ),
            environment_variables=env_variables,
        ),
        location="projects/hackweek-sentry-functions/locations/us-central1",
    )
