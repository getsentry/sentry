import time
from io import BytesIO
from uuid import uuid4
from zipfile import ZipFile

from django.template.defaultfilters import slugify
from google.cloud import storage
from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.services.cloud_functions_service.transports.base import (
    CloudFunctionsServiceTransport,
)
from google.cloud.functions_v1.types import (
    CloudFunction,
    CreateFunctionRequest,
    EventTrigger,
    ListFunctionsRequest,
)
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models import SentryFunction


class SentryFunctionSerilizer(CamelSnakeSerializer):
    name = serializers.CharField()
    code = serializers.CharField()
    author = serializers.CharField(required=False, allow_blank=True)
    overview = serializers.CharField(required=False, allow_blank=True)
    events = serializers.ListField(child=serializers.CharField(), required=False)


indexJs = """
const userFunc = require('./user.js');
exports.start = (message, context) => {
  console.log(message, context)
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


class OrganizationSentryFunctionEndpoint(OrganizationEndpoint):
    def post(self, request, organization):
        serializer = SentryFunctionSerilizer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        funcId = uuid4().hex
        zipFilename = funcId + ".zip"

        f = BytesIO()
        with ZipFile(f, "w") as codezip:
            codezip.writestr("user.js", data["code"])
            codezip.writestr("index.js", indexJs)

        storage_client = storage.Client(project="hackweek-sentry-functions")
        bucket = storage_client.bucket("hackweek-sentry-functions-bucket")
        blob = bucket.blob(zipFilename)
        blob.upload_from_file(f, rewind=True, content_type="application/zip")

        google_pubsub_name = "projects/hackweek-sentry-functions/topics/fn-" + funcId
        from google.cloud import pubsub_v1

        publisher = pubsub_v1.PublisherClient()
        publisher.create_topic(name=google_pubsub_name)

        # TODO: Find better way of handling this
        time.sleep(3)

        google_func_name = (
            "projects/hackweek-sentry-functions/locations/us-central1/functions/" + funcId
        )
        client = CloudFunctionsServiceClient()
        fn = CloudFunction(
            name=google_func_name,
            description="created by api",
            source_archive_url="gs://hackweek-sentry-functions-bucket/" + zipFilename,
            runtime="nodejs14",
            entry_point="start",
            event_trigger=EventTrigger(
                event_type="providers/cloud.pubsub/eventTypes/topic.publish",
                resource=google_pubsub_name,
            ),
        )
        client.create_function(
            function=fn,
            location="projects/hackweek-sentry-functions/locations/us-central1",
        )

        data["slug"] = slugify(data["name"])
        data["organization_id"] = organization.id
        data["external_id"] = funcId

        SentryFunction.objects.create(**data)

        return Response(status=201)

    def get(self, request, organization):
        functions = SentryFunction.objects.filter(organization=organization)
        return Response(serialize(list(functions), request.user), status=200)
