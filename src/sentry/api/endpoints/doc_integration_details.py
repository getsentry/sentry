import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DocIntegrationSerializer
from sentry.models import DocIntegration, IntegrationFeature
from sentry.models.integrations.integration_feature import IntegrationTypes

logger = logging.getLogger(__name__)


class DocIntegrationDetailsEndpoint(DocIntegrationBaseEndpoint):
    def get(self, request: Request, doc_integration: DocIntegration) -> Response:
        return self.respond(serialize(doc_integration, request.user), status=status.HTTP_200_OK)

    def put(self, request: Request, doc_integration: DocIntegration) -> Response:
        data = request.json_body
        data["metadata"] = self.generate_incoming_metadata(request)

        serializer = DocIntegrationSerializer(doc_integration, data=data)
        if serializer.is_valid():
            doc_integration = serializer.save()
            return Response(
                serialize(doc_integration, request.user),
                status=status.HTTP_200_OK,
            )
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Request, doc_integration: DocIntegration) -> Response:
        IntegrationFeature.objects.filter(
            target_id=doc_integration.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        ).delete()
        doc_integration.delete()
        return self.respond(status=status.HTTP_204_NO_CONTENT)
