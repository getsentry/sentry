import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.doc_integrations import DocIntegrationsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DocIntegrationSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.models import DocIntegration

logger = logging.getLogger(__name__)


class DocIntegrationsEndpoint(DocIntegrationsBaseEndpoint):
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
        if serializer.is_valid():
            doc_integration = serializer.save()
            return Response(
                serialize(doc_integration, request.user),
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
