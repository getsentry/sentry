from django.http.response import HttpResponse
from rest_framework.request import Request

from sentry.auth.idpmigration import SSO_VERIFICATION_KEY, get_verification_value_from_key
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class AccountConfirmationView(BaseView):
    # the user using this endpoint is currently locked out of their account so auth isn't required.
    auth_required = False

    def handle(self, request: Request, key: str) -> HttpResponse:
        verification_value = get_verification_value_from_key(key)

        if not verification_value:
            return render_to_response("sentry/idp_account_not_verified.html", request=request)

        org = self._recover_org_slug(verification_value)
        context = {"org": org}

        if verification_value and org:
            request.session[SSO_VERIFICATION_KEY] = key
            return render_to_response(
                "sentry/idp_account_verified.html", context=context, request=request
            )
        return render_to_response("sentry/idp_account_not_verified.html", request=request)

    @staticmethod
    def _recover_org_slug(verification_value):
        organization_id = verification_value.get("organization_id")
        if organization_id is None:
            return None
        org_context = organization_service.get_organization_by_id(id=organization_id, user_id=None)
        return org_context.organization.slug if org_context is not None else None
