import string

from django.urls import reverse
from django.utils.crypto import get_random_string

import sentry.auth.idpmigration as idpmigration
from sentry.models import OrganizationMember
from sentry.testutils import TestCase
from sentry.utils.compat import mock


class IDPMigrationTests(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(self.user)
        self.email = "test@example.com"
        self.org = self.create_organization()
        OrganizationMember.objects.create(organization=self.org, user=self.user)

    @mock.patch("sentry.auth.idpmigration.send_confirm_email")
    def test_create_verification_key(self, send_confirm_email):
        idpmigration.create_verification_key(self.user, self.org, self.email)
        assert send_confirm_email.call_args.args[0] == self.user
        assert send_confirm_email.call_args.args[1] == self.email
        assert len(send_confirm_email.call_args.args[2]) == 32

    @mock.patch("sentry.auth.idpmigration.send_confirm_email")
    def test_verify_new_identity_post(self, send_confirm_email):
        idpmigration.create_verification_key(self.user, self.org, self.email)
        data = {"one_time_key": send_confirm_email.call_args.args[2]}
        path = reverse(
            "sentry-api-0-organization-idp-email-verification", args=[self.organization.slug]
        )
        response = self.client.post(
            path,
            data,
        )
        assert response.status_code == 302
        assert response.url == "/auth/login/"

    def test_verify_new_identity_post_wrong_key(self):
        idpmigration.create_verification_key(self.user, self.org, self.email)
        data = {"one_time_key": get_random_string(32, string.ascii_letters + string.digits)}
        path = reverse(
            "sentry-api-0-organization-idp-email-verification", args=[self.organization.slug]
        )
        response = self.client.post(
            path,
            data,
        )
        assert response.status_code == 401

    @mock.patch("sentry.auth.idpmigration.send_confirm_email")
    def test_verify_new_identity_get(self, send_confirm_email):
        idpmigration.create_verification_key(self.user, self.org, self.email)
        url = f"/api/0/organizations/{self.org.slug}/user-confirm/?one_time_key={send_confirm_email.call_args.args[2]}"
        response = self.client.get(url)
        assert response.status_code == 302
        assert response.url == "/auth/login/"

    def test_verify_new_identity_get_wrong_key(self):
        idpmigration.create_verification_key(self.user, self.org, self.email)
        url = f"/api/0/organizations/{self.org.slug}/user-confirm/?one_time_key={get_random_string(32, string.ascii_letters + string.digits)}"
        response = self.client.get(url)
        assert response.status_code == 401
