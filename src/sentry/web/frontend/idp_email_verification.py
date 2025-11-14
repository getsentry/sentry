from typing import int
import logging

from django.http import HttpRequest
from django.http.response import HttpResponse

from sentry.auth.idpmigration import SSO_VERIFICATION_KEY, get_verification_value_from_key
from sentry.models.organizationmapping import OrganizationMapping
from sentry.utils.cache import cache
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

logger = logging.getLogger(__name__)


@control_silo_view
class AccountConfirmationView(BaseView):
    # the user using this endpoint is currently locked out of their account so auth isn't required.
    auth_required = False

    def handle(self, request: HttpRequest, key: str) -> HttpResponse:
        verification_value = get_verification_value_from_key(key)

        if not verification_value:
            return render_to_response("sentry/idp_account_not_verified.html", request=request)

        org = self._recover_org_slug(verification_value)
        context = {"org": org}

        if verification_value and org:
            request.session[SSO_VERIFICATION_KEY] = key
            user_id = verification_value.get("user_id")
            if user_id:
                key = f"{SSO_VERIFICATION_KEY}:{user_id}"
                cache.set(key, True, timeout=300)
                logger.info(
                    "sso.login-pipeline.verified-email-set-cache",
                    extra={
                        "user_id": user_id,
                        "organization_id": verification_value.get("organization_id"),
                    },
                )

            return render_to_response(
                "sentry/idp_account_verified.html", context=context, request=request
            )
        return render_to_response("sentry/idp_account_not_verified.html", request=request)

    @staticmethod
    def _recover_org_slug(verification_value):
        organization_id = verification_value.get("organization_id")
        if organization_id is None:
            return None
        try:
            return OrganizationMapping.objects.get(organization_id=organization_id).slug
        except OrganizationMapping.DoesNotExist:
            return None
