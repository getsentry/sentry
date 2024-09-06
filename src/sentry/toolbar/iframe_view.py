from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry.types.region import subdomain_is_region
from sentry.utils.http import is_using_customer_domain
from sentry.web.frontend.base import OrganizationMixin
from sentry.web.helpers import render_to_response


class IframeView(View, OrganizationMixin):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "GET":
            return HttpResponse(status=405)

        organization_slug = kwargs.get("organization_slug", None)
        if request and is_using_customer_domain(request) and not subdomain_is_region(request):
            organization_slug = request.subdomain
        self.determine_active_organization(request, organization_slug)

        response = render_to_response("sentry/toolbar/iframe.html")
        response["X-Frame-Options"] = "ALLOWALL"
        return response
