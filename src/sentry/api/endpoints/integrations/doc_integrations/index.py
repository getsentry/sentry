import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.doc_integrations import DocIntegrationsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DocIntegrationSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.models.integrations.doc_integration import DocIntegration

logger = logging.getLogger(__name__)


@control_silo_endpoint
class DocIntegrationsEndpoint(DocIntegrationsBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request):
        if is_active_superuser(request):
            queryset = DocIntegration.objects.all()
        else:
            queryset = DocIntegration.objects.filter(is_draft=False)
        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, access=request.access),
        )

    def post(self, request: Request):
        # Override any incoming JSON for these fields
        data = request.json_body
        data["is_draft"] = True
        data["metadata"] = self.generate_incoming_metadata(request)
        serializer = DocIntegrationSerializer(data=data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        doc_integration = serializer.save()
        return Response(
            serialize(doc_integration, request.user),
            status=status.HTTP_201_CREATED,
        )
