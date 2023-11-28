import re

from django.urls import reverse

import sentry.auth.idpmigration as idpmigration
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmember import OrganizationMember
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


@control_silo_test
class IDPMigrationTests(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(self.user)
        self.email = "test@example.com"
        self.org = self.create_organization()
        self.provider = AuthProvider.objects.create(organization_id=self.org.id, provider="dummy")

    IDENTITY_ID = "drgUQCLzOyfHxmTyVs0G"

    def test_send_one_time_account_confirm_link(self):
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.create(organization=self.org, user_id=self.user.id)
        link = idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.provider, self.email, self.IDENTITY_ID
        )
        assert re.match(r"auth:one-time-key:\w{32}", link.verification_key)

        value = json.loads(idpmigration.get_redis_cluster().get(link.verification_key))
        assert value["user_id"] == self.user.id
        assert value["email"] == self.email
        assert value["member_id"] == om.id
        assert value["organization_id"] == self.org.id
        assert value["identity_id"] == self.IDENTITY_ID
        assert value["provider"] == "dummy"

    def test_send_without_org_membership(self):
        link = idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.provider, self.email, self.IDENTITY_ID
        )

        value = json.loads(idpmigration.get_redis_cluster().get(link.verification_key))
        assert value["user_id"] == self.user.id
        assert value["email"] == self.email
        assert value["member_id"] is None
        assert value["organization_id"] == self.org.id
        assert value["identity_id"] == self.IDENTITY_ID
        assert value["provider"] == "dummy"

    def test_verify_account(self):
        link = idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.provider, self.email, self.IDENTITY_ID
        )
        path = reverse(
            "sentry-idp-email-verification",
            args=[link.verification_code],
        )
        response = self.client.get(path)

        assert self.client.session[idpmigration.SSO_VERIFICATION_KEY] == link.verification_code
        assert response.status_code == 200
        assert response.templates[0].name == "sentry/idp_account_verified.html"

    def test_verify_account_wrong_key(self):
        idpmigration.send_one_time_account_confirm_link(
            self.user, self.org, self.provider, self.email, self.IDENTITY_ID
        )
        path = reverse(
            "sentry-idp-email-verification",
            args=["d14Ja9N2eQfPfVzcydS6vzcxWecZJG2z2"],
        )
        response = self.client.get(path)
        assert response.status_code == 200
        assert response.templates[0].name == "sentry/idp_account_not_verified.html"
