from concurrent.futures import TimeoutError
from threading import Event
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.db import close_old_connections, router, transaction
from django.test import override_settings

from sentry.api.helpers.oauth_consent import (
    InvalidOrganizationSelection,
    OrganizationSelectionError,
    get_organization_options,
    get_permission_descriptions,
    get_permission_groups,
    has_existing_consent,
    persist_authorization,
    resolve_organization,
)
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.models.apiauthorization import ApiAuthorization
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


@override_settings(
    SENTRY_SCOPE_SETS=(
        (("project:read", "Read projects"), ("project:write", "Write projects")),
        (("org:read", "Read organizations"),),
    )
)
def test_permission_descriptions() -> None:
    assert get_permission_descriptions(
        ["org:read", "project:write", "project:read", "project:read"]
    ) == ["Read projects", "Read organizations"]


def test_empty_permissions() -> None:
    assert get_permission_descriptions([]) == []


def test_unknown_permission() -> None:
    with pytest.raises(NotImplementedError, match="scopes did not have descriptions"):
        get_permission_descriptions(["unknown:read"])


@control_silo_test
class OAuthConsentTest(TestCase):
    def test_user_scoped_application(self) -> None:
        application = self.create_api_application()
        assert get_organization_options(application, self.user.id) == []
        assert resolve_organization(application, self.user.id, "123") is None

    @patch("sentry.api.helpers.oauth_consent.user_service.get_organizations")
    def test_organization_selection(self, get_organizations: MagicMock) -> None:
        application = self.create_api_application(requires_org_level_access=True)
        organization = RpcOrganizationMapping(id=123, slug="org-slug", name="Example")
        get_organizations.return_value = [organization]

        assert get_organization_options(application, self.user.id) == [organization]
        assert resolve_organization(application, self.user.id, "123") == 123
        get_organizations.assert_called_with(user_id=self.user.id, only_visible=True)

        get_organizations.return_value = []
        with pytest.raises(InvalidOrganizationSelection) as error:
            resolve_organization(application, self.user.id, "123")
        assert error.value.reason == OrganizationSelectionError.NOT_ACCESSIBLE

    def test_missing_organization_selection(self) -> None:
        application = self.create_api_application(requires_org_level_access=True)
        with pytest.raises(InvalidOrganizationSelection) as error:
            resolve_organization(application, self.user.id, None)
        assert error.value.reason == OrganizationSelectionError.REQUIRED

    def test_invalid_organization_selection(self) -> None:
        application = self.create_api_application(requires_org_level_access=True)
        with pytest.raises(InvalidOrganizationSelection) as error:
            resolve_organization(application, self.user.id, "invalid")
        assert error.value.reason == OrganizationSelectionError.INVALID

    def test_existing_consent(self) -> None:
        application = self.create_api_application()
        assert not has_existing_consent(application, self.user.id, ["project:read"])
        persist_authorization(application, self.user.id, ["project:read"], None)
        assert has_existing_consent(application, self.user.id, ["project:read"])
        assert not has_existing_consent(application, self.user.id, ["project:write"])

    def test_organization_consent_requires_selection(self) -> None:
        application = self.create_api_application(requires_org_level_access=True)
        organization = self.create_organization(owner=self.user)
        persist_authorization(application, self.user.id, ["project:read"], organization.id)
        assert not has_existing_consent(application, self.user.id, ["project:read"])

    def test_save_and_extend_authorization(self) -> None:
        application = self.create_api_application()
        persist_authorization(application, self.user.id, ["project:read"], None)
        persist_authorization(application, self.user.id, ["project:read", "org:read"], None)

        authorization = ApiAuthorization.objects.get(application=application, user=self.user)
        assert set(authorization.scope_list) == {"project:read", "org:read"}

        persist_authorization(application, self.user.id, [], None)
        authorization.refresh_from_db()
        assert set(authorization.scope_list) == {"project:read", "org:read"}

    def test_organization_authorizations_are_separate(self) -> None:
        application = self.create_api_application(requires_org_level_access=True)
        first = self.create_organization(owner=self.user)
        second = self.create_organization(owner=self.user)
        persist_authorization(application, self.user.id, ["project:read"], first.id)
        persist_authorization(application, self.user.id, ["org:read"], second.id)
        persist_authorization(application, self.user.id, ["project:write"], first.id)

        assert set(
            ApiAuthorization.objects.get(
                application=application, user=self.user, organization_id=first.id
            ).scope_list
        ) == {"project:read", "project:write"}
        assert ApiAuthorization.objects.get(
            application=application, user=self.user, organization_id=second.id
        ).scope_list == ["org:read"]


@control_silo_test
class OAuthConsentConcurrencyTest(TransactionTestCase):
    def test_user_scope_merges(self) -> None:
        self.assert_concurrent_scope_merges(None)

    def test_organization_scope_merges(self) -> None:
        self.assert_concurrent_scope_merges(self.organization.id)

    def assert_concurrent_scope_merges(self, organization_id: int | None) -> None:
        application = self.create_api_application(
            requires_org_level_access=organization_id is not None
        )
        user_id = self.user.id
        persist_authorization(application, user_id, ["org:read"], organization_id)
        started = Event()

        def approve() -> None:
            close_old_connections()
            try:
                started.set()
                persist_authorization(application, user_id, ["member:read"], organization_id)
            finally:
                close_old_connections()

        with ContextPropagatingThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic(router.db_for_write(ApiAuthorization)):
                authorization = ApiAuthorization.objects.select_for_update().get(
                    application=application, user_id=user_id, organization_id=organization_id
                )
                future = executor.submit(approve)
                assert started.wait(timeout=10)
                with pytest.raises(TimeoutError):
                    future.result(timeout=1)

                authorization.scope_list = ["org:read", "project:read"]
                authorization.save(update_fields=["scope_list"])

            future.result(timeout=10)

        authorization.refresh_from_db()
        assert set(authorization.scope_list) == {"org:read", "project:read", "member:read"}


def test_permission_groups() -> None:
    assert get_permission_groups(
        ["project:write", "project:read", "project:read", "member:invite"]
    ) == [
        {
            "resource": "members",
            "label": "Organization members",
            "accessDescriptions": {
                "read": "View organization members and their membership details.",
                "write": "Invite members and update their organization membership.",
                "admin": "Includes write access and allows removing organization members.",
                "invite": "Invite organization members.",
            },
            "scopes": ["member:invite"],
            "actions": ["invite"],
            "description": None,
        },
        {
            "resource": "projects",
            "label": "Projects",
            "accessDescriptions": {
                "read": "View projects and their settings.",
                "write": "Create and update projects. Manage project settings and alert rules, including deleting them.",
                "admin": "Includes write access and allows deleting projects and removing ownership rules.",
            },
            "scopes": ["project:read", "project:write"],
            "actions": ["read", "write"],
            "description": None,
        },
    ]


def test_permission_groups_cover_all_scopes() -> None:
    groups = get_permission_groups(sorted(settings.SENTRY_SCOPES))
    assert {scope for group in groups for scope in group["scopes"]} == settings.SENTRY_SCOPES
    assert next(group for group in groups if group["resource"] == "ci")["description"]
    assert next(group for group in groups if group["resource"] == "dashboards")["actions"] == [
        "read",
        "create",
        "write",
        "delete",
    ]


def test_empty_permission_groups() -> None:
    assert get_permission_groups([]) == []


def test_unknown_permission_group() -> None:
    with pytest.raises(NotImplementedError, match="scopes did not have permission groups"):
        get_permission_groups(["unknown:read"])


@pytest.mark.parametrize(
    "scope, expected",
    [
        ("dashboard:write", ["read", "create", "write"]),
        ("dashboard:delete", ["read", "create", "write", "delete"]),
    ],
)
def test_dashboard_access_descriptions(scope: str, expected: list[str]) -> None:
    (group,) = get_permission_groups([scope])
    assert group["actions"] == expected
    assert group["accessDescriptions"]["delete"] == "Delete dashboards."


def test_resource_access_descriptions() -> None:
    groups = get_permission_groups(sorted(settings.SENTRY_SCOPES))
    for group in groups:
        assert set(group["actions"]) <= group["accessDescriptions"].keys()

    (projects,) = get_permission_groups(["project:read"])
    assert projects["actions"] == ["read"]
    assert "deleting projects" in projects["accessDescriptions"]["admin"]
    (ci,) = get_permission_groups(["org:ci"])
    assert ci["accessDescriptions"] == {}
    assert ci["description"]
