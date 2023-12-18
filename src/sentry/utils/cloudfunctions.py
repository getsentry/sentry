import logging
from io import BytesIO
from zipfile import ZipFile

import requests
from django.conf import settings
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
const userFunc = require('./function.js');
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
    return f"projects/{settings.SENTRY_FUNCTIONS_PROJECT_NAME}/topics/fn-{funcId}"


def project_location_function_name(
    include_proj=False, include_loc=False, include_func=False, funcId=None
):
    return_value = ""
    if include_proj:
        return_value += f"projects/{settings.SENTRY_FUNCTIONS_PROJECT_NAME}/"
    if include_loc:
        return_value += f"locations/{settings.SENTRY_FUNCTIONS_REGION}"
    if include_func:
        return_value += f"/functions/fn-{funcId}"
    return return_value


def create_function_pubsub_topic(funcId):
    logger = logging.getLogger("sentry.functions")
    logger.info("Created topic %s", function_pubsub_name(funcId))
    publisher = PublisherClient()
    publisher.create_topic(name=function_pubsub_name(funcId))


def upload_function_files(client, code, env_variables):
    f = BytesIO()
    with ZipFile(f, "w") as codezip:
        codezip.writestr("function.js", code)
        # codezip.writestr("index.js", WRAPPER_JS)
        codezip.writestr("package.json", json.dumps(PACKAGE_JSON))
        codezip.writestr("env.json", json.dumps(env_variables))
    f.seek(0)

    logger = logging.getLogger("sentry.functions")
    logger.info("The region is %s", settings.SENTRY_FUNCTIONS_REGION)

    upload_url = client.generate_upload_url(
        request=GenerateUploadUrlRequest(
            parent=project_location_function_name(include_proj=True, include_loc=True)
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
    client.create_function(
        function=subcreate_function(client, code, funcId, description, env_variables),
        location=project_location_function_name(include_proj=True, include_loc=True),
    )


def update_function(code, funcId, description, env_variables):
    client = CloudFunctionsServiceClient()
    client.update_function(
        request=UpdateFunctionRequest(
            function=subcreate_function(client, code, funcId, description, env_variables),
            update_mask=FieldMask(paths=["source_upload_url", "environment_variables"]),
        )
    )


def subcreate_function(client, code, funcId, description, env_variables):
    upload_url = upload_function_files(client, code, env_variables)
    return CloudFunction(
        name=project_location_function_name(
            include_proj=True, include_loc=True, include_func=True, funcId=funcId
        ),
        description=description,
        source_upload_url=upload_url,
        runtime="nodejs16",
        entry_point="yourFunction",
        event_trigger=EventTrigger(
            event_type="providers/cloud.pubsub/eventTypes/topic.publish",
            resource=function_pubsub_name(funcId),
        ),
        environment_variables=env_variables,
    )


def delete_function(funcId):
    client = CloudFunctionsServiceClient()
    client.delete_function(
        request=DeleteFunctionRequest(
            name=project_location_function_name(
                include_proj=True, include_loc=True, include_func=True, funcId=funcId
            )
        ),
    )


def publish_message(funcId, message):
    publisher = PublisherClient()
    publisher.publish(
        topic=function_pubsub_name(funcId),
        data=message,
    )
