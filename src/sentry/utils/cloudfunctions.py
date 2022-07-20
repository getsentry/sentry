from io import BytesIO
from zipfile import ZipFile

import requests
from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.types import (  # UpdateFunctionRequest,
    CloudFunction,
    EventTrigger,
    GenerateUploadUrlRequest,
)

# from google.cloud.functions_v1.types.functions import DeleteFunctionRequest
from google.cloud.pubsub_v1 import PublisherClient

# from sentry.utils import json

# from google.protobuf.field_mask_pb2 import FieldMask


def function_pubsub_name(funcId):
    return "projects/hackweek-sentry-functions/topics/fn-" + funcId


def create_function_pubsub_topic(funcId):
    publisher = PublisherClient()
    publisher.create_topic(name=function_pubsub_name(funcId))


def upload_function_files(client, code):
    f = BytesIO()
    with ZipFile(f, "w") as codezip:
        codezip.writestr("user.js", code)
        # codezip.writestr("index.js", WRAPPER_JS)
        # codezip.writestr("package.json", json.dumps(PACKAGE_JSON))
        # codezip.writestr("env.json", json.dumps(env))
    f.seek(0)
    # parent = "projects/hackweek-sentry-functions/locations/us-central1"
    # generateURLResponse = requests.post(
    #     f"https://cloudfunctions.googleapis.com/v1/{parent}/functions:generateUploadUrl"
    # )
    # # print(upload_url)
    # upload_url = generateURLResponse.json()["uploadUrl"]

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


def create_function(code, funcId, description):
    create_function_pubsub_topic(funcId)
    client = CloudFunctionsServiceClient()
    upload_url = upload_function_files(client, code)
    client.create_function(
        function=CloudFunction(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-" + funcId,
            description=description,
            source_upload_url=upload_url,
            runtime="nodejs14",
            entry_point="start",
            event_trigger=EventTrigger(
                event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                resource=function_pubsub_name(funcId),
            ),
            # environment_variables=env_variables,
        ),
        location="projects/hackweek-sentry-functions/locations/us-central1",
    )
