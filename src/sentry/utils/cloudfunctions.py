from io import BytesIO
from zipfile import ZipFile

import requests
from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.types import (
    CloudFunction,
    EventTrigger,
    GenerateUploadUrlRequest,
    UpdateFunctionRequest,
)
from google.cloud.functions_v1.types.functions import DeleteFunctionRequest
from google.cloud.pubsub_v1 import PublisherClient
from google.protobuf.field_mask_pb2 import FieldMask

from sentry.utils import json

WRAPPER_JS = """
const userFunc = require('./user.js');
Object.assign(process.env, require('./env.json'));
"""


PACKAGE_JSON = {
    "dependencies": {
        "@sentry/node": "^6.11.0",
        "@sentry/tracing": "^6.11.0",
        "node-fetch": "^2.6.1",
    }
}


def function_pubsub_name(funcId):
    return "projects/hackweek-sentry-functions/topics/fn-" + funcId


def create_function_pubsub_topic(funcId):
    publisher = PublisherClient()
    publisher.create_topic(name=function_pubsub_name(funcId))


def upload_function_files(client, code, env_variables):
    f = BytesIO()
    with ZipFile(f, "w") as codezip:
        codezip.writestr("function.js", code)
        codezip.writestr("index.js", WRAPPER_JS)
        codezip.writestr("package.json", json.dumps(PACKAGE_JSON))
        codezip.writestr("env.json", json.dumps(env_variables))
    f.seek(0)

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
    return upload_url


def create_function(code, funcId, description, env_variables):
    create_function_pubsub_topic(funcId)
    client = CloudFunctionsServiceClient()
    upload_url = upload_function_files(client, code, env_variables)
    client.create_function(
        function=CloudFunction(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-" + funcId,
            description=description,
            source_upload_url=upload_url,
            runtime="nodejs16",
            entry_point="yourFunction",
            event_trigger=EventTrigger(
                event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                resource=function_pubsub_name(funcId),
            ),
            environment_variables=env_variables,
        ),
        location="projects/hackweek-sentry-functions/locations/us-central1",
    )


def update_function(code, funcId, description, env_variables):
    client = CloudFunctionsServiceClient()
    upload_url = upload_function_files(client, code, env_variables)
    client.update_function(
        request=UpdateFunctionRequest(
            function=CloudFunction(
                name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-"
                + funcId,
                description=description,
                source_upload_url=upload_url,
                runtime="nodejs16",
                entry_point="yourFunction",
                event_trigger=EventTrigger(
                    event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                    resource=function_pubsub_name(funcId),
                ),
                environment_variables=env_variables,
            ),
            update_mask=FieldMask(paths=["source_upload_url", "environment_variables"]),
        )
    )


def delete_function(funcId):
    client = CloudFunctionsServiceClient()
    client.delete_function(
        request=DeleteFunctionRequest(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-" + funcId,
        ),
    )


def publish_message(funcId, message):
    publisher = PublisherClient()
    publisher.publish(
        topic=function_pubsub_name(funcId),
        data=message,
    )
