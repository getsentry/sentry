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
    def test_send_one_time_account_confirm_link(self, send_confirm_email):
        idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.email, "drgUQCLzOyfHxmTyVs0G"
        )
        assert send_confirm_email.call_args.args[0] == self.user
        assert send_confirm_email.call_args.args[1] == self.email
        assert len(send_confirm_email.call_args.args[2]) == 32

    def test_verify_account(self):
        verification_key = idpmigration.create_verification_key(self.user, self.org, self.email)
        path = reverse(
            "sentry-idp-email-verification",
            args=[verification_key],
        )
        response = self.client.get(path)
        assert self.client.session["verification_key"] == f"auth:one-time-key:{verification_key}"
        assert response.status_code == 302
        assert response.url == "/auth/login/"

    def test_verify_account_wrong_key(self):
        idpmigration.create_verification_key(self.user, self.org, self.email)
        path = reverse(
            "sentry-idp-email-verification",
            args=[get_random_string(32, string.ascii_letters + string.digits)],
        )
        response = self.client.get(path)
        assert response.status_code == 404
