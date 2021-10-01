import re

from django.urls import reverse

import sentry.auth.idpmigration as idpmigration
from sentry.models import OrganizationMember
from sentry.testutils import TestCase


class IDPMigrationTests(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(self.user)
        self.email = "test@example.com"
        self.org = self.create_organization()
        self.provider = "test_provider"
        OrganizationMember.objects.create(organization=self.org, user=self.user)

    def test_send_one_time_account_confirm_link(self):
        link = idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.provider, self.email, "drgUQCLzOyfHxmTyVs0G"
        )
        assert re.match(r"auth:one-time-key:\w{32}", link.verification_key)

    def test_verify_account(self):
        link = idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.provider, self.email, "drgUQCLzOyfHxmTyVs0G"
        )
        path = reverse(
            "sentry-idp-email-verification",
            args=[link.verification_code],
        )
        response = self.client.get(path)
        
        assert (
            self.client.session["confirm_account_verification_key"]
            == link.verification_code
        )
        assert response.status_code == 302
        assert response.templates[0].name == "sentry/idp_email_verified.html"

    def test_verify_account_wrong_key(self):
        idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.provider, self.email, "drgUQCLzOyfHxmTyVs0G"
        )
        path = reverse(
            "sentry-idp-email-verification",
            args=["d14Ja9N2eQfPfVzcydS6vzcxWecZJG2z2"],
        )
        response = self.client.get(path)
        assert response.status_code == 302
        assert response.templates[0].name == "sentry/idp_email_not_verified.html"
