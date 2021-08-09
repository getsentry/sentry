from io import BytesIO
from uuid import uuid4
from zipfile import ZipFile

from google.cloud import storage
from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.services.cloud_functions_service.transports.base import (
    CloudFunctionsServiceTransport,
)
from google.cloud.functions_v1.types import (
    CloudFunction,
    CreateFunctionRequest,
    EventTrigger,
    HttpsTrigger,
    ListFunctionsRequest,
)
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint


class OrganizationSentryFunctionEndpoint(OrganizationEndpoint):
    def post(self, request, organization):
        funcBody = request.data.get("fn")
        if not funcBody:
            return Response(status=400)
        funcId = uuid4().hex
        zipFilename = funcId + ".zip"

        f = BytesIO()
        with ZipFile(f, "w") as codezip:
            codezip.writestr("fn.json", funcBody)

        storage_client = storage.Client()
        bucket = storage_client.bucket("hackweek-sentry-functions-bucket")
        blob = bucket.blob(zipFilename)
        blob.upload_from_file(f, rewind=True, content_type="application/zip")

        client = CloudFunctionsServiceClient()
        fn = CloudFunction(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/" + funcId,
            description="created by api",
            source_archive_url=f"gs://hackweek-sentry-functions-bucket/" + zipFilename,
            runtime="nodejs14",
            https_trigger=HttpsTrigger(url=""),
        )
        client.create_function(
            function=fn,
            location="projects/hackweek-sentry-functions/locations/us-central1",
        )

        return Response(status=201)
