from django.http import HttpRequest
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import ratelimits as ratelimiter
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers.base import serialize
from sentry.models.organization import Organization
from sentry.users.api.serializers.user import DetailedSelfUserSerializer
from sentry.utils import auth, metrics
from sentry.utils.hashlib import md5_text
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import OrganizationMixin


@control_silo_endpoint
class AuthLoginEndpoint(Endpoint, OrganizationMixin):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    # Disable authentication and permission requirements.
    permission_classes = ()

    def dispatch(self, request: HttpRequest, *args, **kwargs) -> Response:
        self.determine_active_organization(request)
        return super().dispatch(request, *args, **kwargs)

    def post(
        self, request: Request, organization: Organization | None = None, *args, **kwargs
    ) -> Response:
        """
        Process a login request via username/password. SSO login is handled
        elsewhere.
        """
        login_form = AuthenticationForm(request, request.data)

        # Rate limit logins
        is_limited = ratelimiter.backend.is_limited(
            "auth:login:username:{}".format(
                md5_text(login_form.clean_username(request.data.get("username"))).hexdigest()
            ),
            limit=10,
            window=60,  # 10 per minute should be enough for anyone
        )

        if is_limited:
            errors = {"__all__": [login_form.error_messages["rate_limited"]]}
            metrics.incr(
                "login.attempt", instance="rate_limited", skip_internal=True, sample_rate=1.0
            )

            return self.respond_with_error(errors)

        if not login_form.is_valid():
            metrics.incr("login.attempt", instance="failure", skip_internal=True, sample_rate=1.0)
            return self.respond_with_error(login_form.errors)

        user = login_form.get_user()

        auth.login(request, user, organization_id=organization.id if organization else None)
        metrics.incr("login.attempt", instance="success", skip_internal=True, sample_rate=1.0)

        if not user.is_active:
            return Response(
                {
                    "nextUri": "/auth/reactivate/",
                    "user": serialize(user, user, DetailedSelfUserSerializer()),
                }
            )

        redirect_url = auth.get_org_redirect_url(
            request, self.active_organization.organization if self.active_organization else None
        )

        return Response(
            {
                "nextUri": auth.get_login_redirect(request, redirect_url),
                "user": serialize(user, user, DetailedSelfUserSerializer()),
            }
        )

    def respond_with_error(self, errors):
        return Response({"detail": "Login attempt failed", "errors": errors}, status=400)
