from __future__ import absolute_import

from six.moves.urllib.parse import urlencode
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser

from sentry.auth.helper import handle_new_user
from sentry.models import AuthProvider, InviteStatus, OrganizationMember
from sentry.testutils import TestCase
from sentry.utils.compat import mock


class HandleNewUserTest(TestCase):
    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        provider = "dummy"
        request = RequestFactory().post("/auth/sso/")
        request.user = AnonymousUser()

        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider=provider
        )
        identity = {"id": "1234", "email": "test@example.com", "name": "Morty"}

        auth_identity = handle_new_user(auth_provider, self.organization, request, identity)
        user = auth_identity.user

        assert user.email == identity["email"]
        assert OrganizationMember.objects.filter(organization=self.organization, user=user).exists()

        signup_record = [r for r in mock_record.call_args_list if r[0][0] == "user.signup"]
        assert signup_record == [
            mock.call(
                "user.signup", user_id=user.id, source="sso", provider=provider, referrer="in-app"
            )
        ]

    def test_associated_existing_member_invite_by_email(self):
        request = RequestFactory().post("/auth/sso/")
        request.user = AnonymousUser()

        provider = AuthProvider.objects.create(organization=self.organization, provider="dummy")
        identity = {"id": "1234", "email": "test@example.com", "name": "Morty"}

        member = OrganizationMember.objects.create(
            organization=self.organization, email=identity["email"]
        )

        auth_identity = handle_new_user(provider, self.organization, request, identity)

        assigned_member = OrganizationMember.objects.get(
            organization=self.organization, user=auth_identity.user
        )

        assert assigned_member.id == member.id

    def test_associated_existing_member_invite_request(self):
        request = RequestFactory().post("/auth/sso/")
        request.user = AnonymousUser()

        provider = AuthProvider.objects.create(organization=self.organization, provider="dummy")
        identity = {"id": "1234", "email": "test@example.com", "name": "Morty"}

        member = self.create_member(
            organization=self.organization,
            email=identity["email"],
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        auth_identity = handle_new_user(provider, self.organization, request, identity)

        assert OrganizationMember.objects.filter(
            organization=self.organization,
            user=auth_identity.user,
            invite_status=InviteStatus.APPROVED.value,
        ).exists()

        assert not OrganizationMember.objects.filter(id=member.id).exists()

    def test_associate_pending_invite(self):
        provider = AuthProvider.objects.create(organization=self.organization, provider="dummy")
        identity = {"id": "1234", "email": "test@example.com", "name": "Morty"}

        # The org member invite should have a non matching email, but the
        # member id and token will match from the cookie, allowing association
        member = OrganizationMember.objects.create(
            organization=self.organization, email="different.email@example.com", token="abc"
        )

        request = RequestFactory().post("/auth/sso/")
        request.user = AnonymousUser()
        request.COOKIES["pending-invite"] = urlencode(
            {"memberId": member.id, "token": member.token, "url": ""}
        )

        auth_identity = handle_new_user(provider, self.organization, request, identity)

        assigned_member = OrganizationMember.objects.get(
            organization=self.organization, user=auth_identity.user
        )

        assert assigned_member.id == member.id
