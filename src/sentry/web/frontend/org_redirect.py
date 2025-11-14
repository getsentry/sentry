import re

import sentry_sdk
from django.http import HttpResponseRedirect

from sentry import analytics, features
from sentry.analytics.events.org_redirect import OrgRedirectEvent
from sentry.organizations.absolute_url import customer_domain_path, generate_organization_url
from sentry.organizations.services.organization import RpcOrganization
from sentry.web.frontend.base import BaseView, control_silo_view


@control_silo_view
class OrgRedirect(BaseView):
    auth_required = True

    def get_url(self, request, organization: RpcOrganization):
        # path in sentry comes after /orgredirect/
        path = request.get_full_path().replace("/orgredirect/", "/")
        # make it work for __orgslug__ and :orgslug
        path = re.sub("__orgslug__", organization.slug, path, flags=re.IGNORECASE)
        path = re.sub(":orgslug", organization.slug, path, flags=re.IGNORECASE)
        if request.subdomain == organization.slug or features.has("system:multi-region"):
            path = customer_domain_path(path)
            return f"{generate_organization_url(organization.slug)}{path}"
        return path

    def handle(self, request):
        if self.active_organization:
            try:
                analytics.record(
                    OrgRedirectEvent(
                        user_id=request.user.id,
                        organization_id=self.active_organization.organization.id,
                        path=request.get_full_path(),
                    )
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
            redirect_url = self.get_url(request, self.active_organization.organization)
            return HttpResponseRedirect(redirect_url)
        try:
            analytics.record(
                OrgRedirectEvent(
                    user_id=request.user.id,
                    path=request.get_full_path(),
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)
        return self.redirect_to_org(request)
