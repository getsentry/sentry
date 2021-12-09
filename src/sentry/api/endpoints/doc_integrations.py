import logging

from rest_framework.request import Request

from sentry.api.bases.docintegrations import DocIntegrationsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.auth.superuser import is_active_superuser
from sentry.models.integration import DocIntegration

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
        pass
