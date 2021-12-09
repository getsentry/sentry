import logging

from django.http import Http404
from rest_framework.request import Request

from sentry.api.bases.docintegrations import DocIntegrationsBaseEndpoint

logger = logging.getLogger(__name__)


class DocIntegrationsEndpoint(DocIntegrationsBaseEndpoint):
    def get(self, request: Request):
        raise Http404

    def post(self, request: Request):
        raise Http404
