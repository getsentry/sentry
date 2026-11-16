import re

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

# Scopes are `<resource>:<action>`, see src/AGENTS.md. Adding a verb here should be a
# deliberate choice made in review, not a way to name a resource.
SCOPE_ACTIONS = {"read", "write", "admin", "create", "invite"}
_SNAKE_CASE = r"[a-z]+(?:_[a-z]+)*"
# A resource, optionally split into subresources like `membership.general`.
SCOPE_RESOURCE_RE = re.compile(rf"{_SNAKE_CASE}(?:\.{_SNAKE_CASE})?")
# OIDC requires these exact names.
OIDC_SCOPES = {"openid", "profile", "email"}
# Older scopes that name a resource or capability in the action slot. Do not add to this.
LEGACY_SCOPE_NAMES = {
    "org:integrations",
    "org:ci",
    "org:tokens",
    "project:releases",
    "project:distribution",
}


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

    def test_scope_names_follow_resource_action(self) -> None:
        for scope in SENTRY_SCOPES - OIDC_SCOPES - LEGACY_SCOPE_NAMES:
            resource, _, action = scope.partition(":")
            assert SCOPE_RESOURCE_RE.fullmatch(resource) and action in SCOPE_ACTIONS, (
                f"{scope!r} must be <resource>:<action>, with a snake_case resource "
                f"(e.g. project_key, or membership.general for a subresource) and an action in "
                f"{sorted(SCOPE_ACTIONS)}. See src/AGENTS.md."
            )

    def test_split_resources_have_no_parent_scope(self) -> None:
        # A parent scope like `membership:read` would read as covering every subresource,
        # so a resource with subresources only has subresource scopes.
        resources = {scope.partition(":")[0] for scope in SENTRY_SCOPES if ":" in scope}
        split_resources = {resource.partition(".")[0] for resource in resources if "." in resource}
        assert split_resources & resources == set()

    def test_legacy_scope_names_still_exist(self) -> None:
        # Drop an entry here once its scope is removed or renamed.
        assert LEGACY_SCOPE_NAMES <= SENTRY_SCOPES

    def test_scope_sets_group_one_resource(self) -> None:
        # Each set gets one consent description, so mixing resources hides one of them.
        for scope_set in settings.SENTRY_SCOPE_SETS:
            resources = {scope.partition(":")[0] for scope, _ in scope_set}
            assert len(resources) == 1, resources

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

    def test_service_account_read_granted_to_org_readers(self) -> None:
        for roles in (settings.SENTRY_ROLES, settings.SENTRY_GRANULAR_ROLES):
            granted = {role["id"] for role in roles if "service_account:read" in role["scopes"]}
            assert granted == {"member", "admin", "manager", "owner"}

    def test_service_account_scopes_not_grantable_to_non_humans(self) -> None:
        assert SERVICE_ACCOUNT_SCOPES <= SENTRY_SCOPES
        assert SERVICE_ACCOUNT_SCOPES.isdisjoint(GRANTABLE_SCOPES)
        assert SERVICE_ACCOUNT_SCOPES.isdisjoint(ApiScopes())
