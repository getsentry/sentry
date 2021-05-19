from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.utils import auth, metrics
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import OrganizationMixin


class AuthLoginEndpoint(Endpoint, OrganizationMixin):
    # Disable permission requirements.
    permission_classes = []

    def post(self, request, organization=None, *args, **kwargs):
        """
        Process a login request via username/password. SSO login is handled
        elsewhere.
        """
        login_form = AuthenticationForm(request, request.data)

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
                    "user": serialize(user, user, DetailedUserSerializer()),
                }
            )

        active_org = self.get_active_organization(request)
        redirect_url = auth.get_org_redirect_url(request, active_org)

        return Response(
            {
                "nextUri": auth.get_login_redirect(request, redirect_url),
                "user": serialize(user, user, DetailedUserSerializer()),
            }
        )

    def respond_with_error(self, errors):
        return Response({"detail": "Login attempt failed", "errors": errors}, status=400)
