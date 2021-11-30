from django.http.response import HttpResponse
from rest_framework.request import Request

from sentry.auth.idpmigration import SSO_VERIFICATION_KEY, get_verification_value_from_key
from sentry.models import Organization, OrganizationMember
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
    def _recover_org_member(verification_value):
        member_id = verification_value.get("member_id")
        if member_id is None:
            return None  # the user was not an org member when the record was written
        try:
            return OrganizationMember.objects.get(id=member_id)
        except OrganizationMember.DoesNotExist:
            return None  # the user has left the org since the record was written

    @staticmethod
    def _recover_org_slug(verification_value):
        om = AccountConfirmationView._recover_org_member(verification_value)
        if om is not None:
            return om.organization.slug

        organization_id = verification_value.get("organization_id")
        try:
            org = Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            return None
        else:
            return org.slug
