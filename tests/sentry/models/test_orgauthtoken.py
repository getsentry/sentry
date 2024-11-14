import pytest
from django.core.exceptions import ValidationError

from sentry.hybridcloud.models.outbox import RegionOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken, update_org_auth_token_last_used
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class OrgAuthTokenTest(TestCase):
    def test_get_scopes(self):
        token = OrgAuthToken(scope_list=["project:read", "project:releases"])
        assert token.get_scopes() == ["project:read", "project:releases"]

    def test_has_scope(self):
        token = OrgAuthToken(scope_list=["project:read", "project:releases"])
        assert token.has_scope("project:read")
        assert token.has_scope("project:releases")
        assert not token.has_scope("project:write")

    def test_validate_scope(self):
        org = Organization(name="Test org", slug="test-org")
        token = OrgAuthToken(
            organization_id=org.id,
            name="test token",
            token_hashed="test-token",
            scope_list=["project:xxxx"],
        )

        with pytest.raises(
            ValidationError,
            match="project:xxxx is not a valid scope.",
        ):
            token.full_clean()


class UpdateOrgAuthTokenLastUsed(TestCase):
    def test_creates_outboxes(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="test token",
                token_hashed="test-token",
                scope_list=["org:ci"],
            )
        update_org_auth_token_last_used(token, [])
        outbox = RegionOutbox.objects.first()
        assert outbox
        assert outbox.category == OutboxCategory.ORGAUTHTOKEN_UPDATE_USED
        assert outbox.object_identifier == token.id
        assert outbox.payload is not None
        assert outbox.payload["organization_id"] == self.organization.id
        assert outbox.payload["org_auth_token_id"] == token.id
        assert "date_last_used" in outbox.payload
        assert "project_last_used_id" in outbox.payload

    def test_create_outbox_debounce(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="test token",
                token_hashed="test-token",
                scope_list=["org:ci"],
            )
        update_org_auth_token_last_used(token, [])
        update_org_auth_token_last_used(token, [])
        assert RegionOutbox.objects.count() == 1, "Should be debounced"

        update_org_auth_token_last_used(token, [123])
        assert RegionOutbox.objects.count() == 2, "Different project ids create new outboxes"
