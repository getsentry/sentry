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

SECURITY = """-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

# Sentry runs a private bug bounty program using HackerOne.
# Please send us an email if you want to be invited:
Contact: mailto:security@sentry.io
Policy: https://sentry.io/security/#vulnerability-disclosure
Encryption: https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x641d2f6c230dbe3b

# Please refer to https://sentry.io/cookiebounty/ for details on Cookie Bounty
-----BEGIN PGP SIGNATURE-----

iQIzBAEBCAAdFiEE5AbCeulxZRWhse2GZB0vbCMNvjsFAmYhkjMACgkQZB0vbCMN
vjvEzA//UoHN1WN3fXHIGHfKirgPnIidnS6KrthYAXkTMYU7BNZLl31YCq2SVyfL
IfZEwK2dgqNZI/WBxySdj7STFAVeskYP8dgAqkkM/Nc+I1KL8g4co6e3xRdtx/8W
kK1Yn3F3f769tbAcBkX+UYCebLrcgB8akllp+q9x2s/0kYiW/NbL7Q5epdK9kdg4
2p99kS1zcv01U0XUlmUU02cqxcqbj7H4GXKhTbtyEMH7xbLfoSbftgRXZVGxxLAb
AF3+M5zRpBAfLnDxGGb2rj7hC12dXbGgH0PEWQX0Lj3cfde7nHySHE0SUFfAWDTg
gMRmTUgzHimyeFZ22ndFwJJOXny+t+BCMYj0QcCrddp4o9LuHq5Ao8n8yUd3syfE
uPj8GhK15E6rwewyRodKQXzN9zZrCpVMizfLLQNsGDlqr28Yfh+rxiLOC/gvceH1
upyFS5kYr9oGA9rLqnrw2KByhzm+t1EHro1Wkv58eVbMJzJ5HmH/D8OXU+9XwyqX
ZRcT4CWSEobXpytX8JR6EanEHZYfTw93o+EcuwkuZO5TYHY+pWPF1MQmy3XUHS98
rxG3qWbgPqJwIB7fCnASoRqrpYz6p6Eq6Vt1TDwaXO1I/uC3lAmb477lyNe2RLIg
Yei0NogNpSgL/Xa1RUTKdeC0NLDo33PIlMHLXPrQ39vEQ+DwZZY=
=LO/F
-----END PGP SIGNATURE-----
"""


class ClientConfigView(BaseView):
    def get(self, request: Request) -> HttpResponse:
        return HttpResponse(json.dumps(get_client_config(request)), content_type="application/json")


@cache_control(max_age=3600, public=True)
def robots_txt(request):
    if settings.SENTRY_MODE == SentryMode.SAAS and not request.subdomain:
        return HttpResponse(ROBOTS_SENTRY_IO, content_type="text/plain")

    return HttpResponse(ROBOTS_DISALLOW_ALL, content_type="text/plain")


@cache_control(max_age=3600, public=True)
def security_txt(request):
    if settings.SENTRY_MODE == SentryMode.SELF_HOSTED:
        return HttpResponse(status=404)

    return HttpResponse(SECURITY, content_type="text/plain")


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
