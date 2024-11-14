from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.cache import cache_control
from django.views.generic.base import View as BaseView
from rest_framework.request import Request

from sentry.conf.types.sentry_config import SentryMode
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.utils import json
from sentry.utils.http import get_origins
from sentry.web.client_config import get_client_config
from sentry.web.helpers import render_to_response

# Paths to pages should not be added here, otherwise crawlers will
# not be able to access the metadata with the 'none' directive
# and the URL of these pages may still appear in search results
ROBOTS_SENTRY_IO = """\
User-agent: *
Disallow: /api/
Allow: /api/*/store/
Allow: /

Sitemap: https://sentry.io/sitemap-index.xml
"""

# For customer domains, like acme.us.sentry.io,
# we want to disallow honest crawlers from accessing any page on a customer domain.
# This should prevent a customer domain from showing up in search engine results.
ROBOTS_DISALLOW_ALL = """\
User-agent: *
Disallow: /
"""


class ClientConfigView(BaseView):
    def get(self, request: Request) -> HttpResponse:
        return HttpResponse(json.dumps(get_client_config(request)), content_type="application/json")


@cache_control(max_age=3600, public=True)
def robots_txt(request):
    if settings.SENTRY_MODE == SentryMode.SAAS and not request.subdomain:
        return HttpResponse(ROBOTS_SENTRY_IO, content_type="text/plain")

    return HttpResponse(ROBOTS_DISALLOW_ALL, content_type="text/plain")


@cache_control(max_age=60)
def crossdomain_xml(request, project_id):
    if SiloMode.get_current_mode() == SiloMode.CONTROL or (not project_id.isdigit()):
        return HttpResponse(status=404)

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        return HttpResponse(status=404)

    origin_list = get_origins(project)
    response = render_to_response("sentry/crossdomain.xml", {"origin_list": origin_list})
    response["Content-Type"] = "application/xml"

    return response


@cache_control(max_age=3600, public=True)
def not_found(request):
    return HttpResponse(status=404)
