import pytest
from django.core.exceptions import ValidationError

from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
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
