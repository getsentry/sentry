# import os
from io import BytesIO
from zipfile import ZipFile

import requests
from google.cloud import functions_v2
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
    # topic =
    publisher.create_topic(name=function_pubsub_name(funcId))
    # print(topic.name)


def upload_function_files_v1(client, code):
    f = BytesIO()
    with ZipFile(f, "w") as codezip:
        codezip.writestr("function.js", code)
        # codezip.writestr("index.js", WRAPPER_JS)
        # codezip.writestr("package.json", json.dumps(PACKAGE_JSON))
        # codezip.writestr("env.json", json.dumps(env))
    f.seek(0)

    # Post request
    # parent = "projects/hackweek-sentry-functions/locations/us-central1"
    # generateURLResponse = requests.post(
    #     f"https://cloudfunctions.googleapis.com/v1/{parent}/functions:generateUploadUrl"
    # )
    # # print(upload_url)
    # upload_url = generateURLResponse.json()["uploadUrl"]

    # google.cloud.functions_v1
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


def create_function_v1(code, funcId, description):
    create_function_pubsub_topic(funcId)
    client = CloudFunctionsServiceClient()
    upload_url = upload_function_files_v1(client, code)
    client.create_function(
        function=CloudFunction(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-" + funcId,
            description=description,
            source_upload_url=upload_url,
            runtime="nodejs14",
            entry_point="yourFunction",
            event_trigger=EventTrigger(
                event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                resource=function_pubsub_name(funcId),
            ),
        ),
        location="projects/hackweek-sentry-functions/locations/us-central1",
    )


def upload_function_files_v2(client: functions_v2.FunctionServiceClient, code):
    f = BytesIO()
    with ZipFile(f, "w") as codezip:
        codezip.writestr("function.js", code)
        # codezip.writestr("index.js", WRAPPER_JS)
        # codezip.writestr("package.json", json.dumps(PACKAGE_JSON))
        # codezip.writestr("env.json", json.dumps(env))
    f.seek(0)

    # google.cloud.functions_v2
    request = functions_v2.GenerateUploadUrlRequest(
        parent="projects/hackweek-sentry-functions/locations/us-central1",
    )
    response = client.generate_upload_url(request=request)
    upload_url = response.upload_url
    requests.put(
        upload_url,
        data=f,
        headers={"content-type": "application/zip"},
    )
    return response.storage_source


def create_function_v2(code, funcId, description):
    create_function_pubsub_topic(funcId)
    # Create a client
    client = functions_v2.FunctionServiceClient()
    storage_source = upload_function_files_v2(client, code)
    # Initialize request argument(s)
    request = functions_v2.CreateFunctionRequest(
        parent="projects/hackweek-sentry-functions/locations/us-central1",
        function=functions_v2.Function(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/" + funcId,
            environment=functions_v2.Environment(2),
            description=description,
            build_config=functions_v2.BuildConfig(
                runtime="nodejs14",
                entry_point="yourFunction",
                source=functions_v2.Source(storage_source=storage_source),
                # TODO: Implement environment variables
                # environment_variables=
            ),
            service_config=functions_v2.ServiceConfig(
                # TODO: Implement other fields
                # timeout_seconds=
                # available_memory=
                # environment_variables=
            ),
            event_trigger=functions_v2.EventTrigger(
                event_type="google.cloud.pubsub.topic.v1.messagePublished",
            ),
        ),
        function_id="projects/hackweek-sentry-functions/locations/us-central1/functions/fn-"
        + funcId,
    )

    # Make the request
    operation = client.create_function(request=request)
    # response =
    operation.result()
    # print(response)
