from google.cloud.functions_v1.services.cloud_functions_service import CloudFunctionsServiceClient
from google.cloud.functions_v1.services.cloud_functions_service.transports.base import (
    CloudFunctionsServiceTransport,
)
from google.cloud.functions_v1.types import CloudFunction, CreateFunctionRequest, HttpsTrigger
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint


class OrganizationSentryFunctionEndpoint(OrganizationEndpoint):
    def post(self, request, organization):
        client = CloudFunctionsServiceClient()
        fn = CloudFunction(
            name="projects/hackweek-sentry-functions/locations/us-central1/functions/testfunc",
            description="created by api",
            source_archive_url="gs://hackweek-sentry-functions-bucket/test-func.zip",
            runtime="nodejs14"
        )
        funcRequest = CreateFunctionRequest(
            function=fn,
            location="projects/hackweek-sentry-functions/locations/us-central1",
        )
        client.create_function(funcRequest)
        return Response(status=201)
