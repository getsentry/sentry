from __future__ import absolute_import

from django.conf import settings
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.utils import auth
from sentry.web.forms.accounts import RegistrationForm
from sentry.web.frontend.base import OrganizationMixin


class AuthRegisterEndpoint(Endpoint, OrganizationMixin):
    # Disable authentication and permission requirements.
    authentication_classes = []
    permission_classes = []

    def can_register(self, request):
        return bool(auth.has_user_registration() or request.session.get('can_register'))

    def post(self, request):
        if not self.can_register(request):
            return Response({'detail': 'Registration is disabled'}, status=403)

        form = RegistrationForm(request.DATA)
        if not form.is_valid():
            return Response({'detail': 'Registration failed', 'errors': form.errors}, status=400)

        user = form.save()
        user.send_confirm_emails(is_new_user=True)

        # HACK: grab whatever the first backend is and assume it works
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        auth.login(request, user)

        # can_register should only allow a single registration
        request.session.pop('can_register', None)
        request.session.pop('invite_email', None)

        organization = self.get_active_organization(request)
        org_url = None
        if organization:
            org_url = organization.get_url()

        return Response({
            'user': serialize(user, user, DetailedUserSerializer()),
            'nextUri': auth.get_login_redirect(request, org_url)
        })
