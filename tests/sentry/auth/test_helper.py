from __future__ import absolute_import

import mock

from sentry.models import AuthProvider, OrganizationMember
from sentry.testutils import TestCase
from sentry.auth.helper import handle_new_user


class HandleNewuserTest(TestCase):
    @mock.patch("sentry.auth.helper.handle_new_membership")
    def test_simple(self, mock_handle_new_membership):
        provider = AuthProvider.objects.create(organization=self.organization, provider="dummy")

        identity = {"id": "1234", "email": "test@example.com", "name": "Morty"}

        auth_identity = handle_new_user(provider, self.organization, None, identity)

        assert mock_handle_new_membership.called
        assert auth_identity.user.email == identity["email"]

    @mock.patch("sentry.auth.helper.handle_new_membership")
    def test_associated_member_invite(self, mock_handle_new_membership):
        provider = AuthProvider.objects.create(organization=self.organization, provider="dummy")

        identity = {"id": "1234", "email": "test@example.com", "name": "Morty"}

        OrganizationMember.objects.create(organization=self.organization, email=identity["email"])

        auth_identity = handle_new_user(provider, self.organization, None, identity)

        assert not mock_handle_new_membership.called
        assert OrganizationMember.objects.filter(
            organization=self.organization, user=auth_identity.user
        ).exists()
