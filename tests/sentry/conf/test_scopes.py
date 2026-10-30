from django.conf import settings

from sentry.conf.server import (
    GRANULAR_SCOPES,
    SENTRY_READONLY_SCOPES,
    SENTRY_SCOPE_HIERARCHY_MAPPING,
    SENTRY_SCOPES,
)
from sentry.models.apiscopes import ApiScopes
from sentry.service_accounts.models import GRANTABLE_SCOPES
from sentry.testutils.cases import TestCase

SERVICE_ACCOUNT_SCOPES = {"service_account:read", "service_account:write"}
# Resources whose scopes are explicit, so write does not imply read.
EXPLICIT_SCOPE_RESOURCES = {"service_account"}


class ScopesTest(TestCase):
    def test_scope_hierarchy_maintained(self) -> None:
        assert "org:superuser" not in SENTRY_SCOPES
        for scope in SENTRY_SCOPES:
            assert scope in SENTRY_SCOPE_HIERARCHY_MAPPING

            # exclude special OAuth scopes
            if ":" not in scope:
                continue
            resource, access_level = scope.split(":")

            # check that scope is in its own mapping
            assert scope in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

            # granular and service account scopes are explicit and imply nothing else
            if scope in GRANULAR_SCOPES or resource in EXPLICIT_SCOPE_RESOURCES:
                assert SENTRY_SCOPE_HIERARCHY_MAPPING[scope] == {scope}
                continue

            # check that write grants read
            if access_level == "write":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

            # # check that admin grants read+write
            if access_level == "admin":
                assert resource + ":read" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]
                assert resource + ":write" in SENTRY_SCOPE_HIERARCHY_MAPPING[scope]

    def test_readonly_scopes(self) -> None:
        for scope in SENTRY_SCOPES:
            if ":read" in scope:
                assert scope in SENTRY_READONLY_SCOPES

    def test_service_account_write_requires_global_role(self) -> None:
        # A role that can set allProjects must already see every project.
        for role in (*settings.SENTRY_ROLES, *settings.SENTRY_GRANULAR_ROLES):
            if "service_account:write" in role["scopes"]:
                assert role.get("is_global"), role["id"]

    def test_service_account_scopes_granted_to_manager_and_owner(self) -> None:
        for roles in (settings.SENTRY_ROLES, settings.SENTRY_GRANULAR_ROLES):
            granted = {role["id"] for role in roles if SERVICE_ACCOUNT_SCOPES <= role["scopes"]}
            assert granted == {"manager", "owner"}

    def test_service_account_scopes_not_grantable_to_non_humans(self) -> None:
        assert SERVICE_ACCOUNT_SCOPES <= SENTRY_SCOPES
        assert SERVICE_ACCOUNT_SCOPES.isdisjoint(GRANTABLE_SCOPES)
        assert SERVICE_ACCOUNT_SCOPES.isdisjoint(ApiScopes())
