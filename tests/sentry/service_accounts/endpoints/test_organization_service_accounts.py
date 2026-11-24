from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request

from sentry import audit_log
from sentry.auth import access
from sentry.auth.access import RpcBackedAccess
from sentry.constants import ObjectStatus
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.dashboard import Dashboard
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.impl import DatabaseBackedOrganizationService
from sentry.service_accounts.endpoints.organization_service_accounts import (
    ADD_SCOPES_HIDDEN_PROJECTS_ERROR,
    ALL_PROJECTS_ROLE_ERROR,
    ALL_PROJECTS_WITH_PROJECTS_ERROR,
    MAX_PROJECT_IDS_PER_REQUEST,
    NARROW_ALL_PROJECTS_ERROR,
    OrganizationServiceAccountDetailsEndpoint,
    ServiceAccountCreateSerializer,
)
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountOwnerKind,
    ServiceAccountProject,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
    ServiceAccountToken,
    ServiceAccountTokenReplica,
)
from sentry.service_accounts.tokens import stored_token_fields
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_no_organization_resource_hydration
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

FEATURE_FLAG = "organizations:service-accounts"


def project_ids_for(service_account: ServiceAccount) -> list[int]:
    return sorted(
        ServiceAccountProject.objects.filter(service_account=service_account).values_list(
            "project_id", flat=True
        )
    )


@control_silo_test
class OrganizationServiceAccountIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-accounts"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_flag_off_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, status_code=404)

    def test_list(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            projects = [self.create_project(organization=self.organization) for _ in range(2)]
            other_organization = self.create_organization()
        first = self.create_service_account(
            organization=self.organization,
            name="seer-autofix",
            scope_list=["project:read", "org:read"],
            project_ids=[projects[1].id, projects[0].id],
        )
        # Deleted accounts are left out.
        self.create_service_account(
            organization=self.organization, name="nightly-triage", is_active=False
        )
        self.create_service_account(organization=other_organization, name="seer-autofix")

        with (
            self.feature(FEATURE_FLAG),
            assert_no_organization_resource_hydration(),
        ):
            response = self.get_success_response(self.organization.slug)

        assert response.data == [
            {
                "id": str(first.id),
                "name": "seer-autofix",
                "scopes": ["org:read", "project:read"],
                "projectIds": [str(project.id) for project in sorted(projects, key=lambda p: p.id)],
                "allProjects": False,
                "ownerKind": None,
                "dateCreated": first.date_added,
            },
        ]

    def test_list_paginates(self) -> None:
        first = self.create_service_account(organization=self.organization, name="first")
        second = self.create_service_account(organization=self.organization, name="second")

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, qs_params={"per_page": 1})
            assert [row["id"] for row in response.data] == [str(first.id)]
            assert 'rel="next"; results="true"' in response["Link"]

            next_cursor = self.get_cursor_headers(response)[1]
            response = self.get_success_response(
                self.organization.slug, qs_params={"per_page": 1, "cursor": next_cursor}
            )
            assert [row["id"] for row in response.data] == [str(second.id)]

    def test_member_can_list(self) -> None:
        self.create_service_account(organization=self.organization)
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1

    def test_list_with_token_scopes(self) -> None:
        self.create_service_account(organization=self.organization)
        url = reverse(self.endpoint, args=[self.organization.slug])

        def list_with(scope_list: list[str]) -> Any:
            token = self.create_user_auth_token(user=self.user, scope_list=scope_list)
            return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        with self.feature(FEATURE_FLAG):
            assert list_with(["service_account:read"]).status_code == 200
            # Neither org:read nor the explicit write scope grants reads.
            assert list_with(["org:read"]).status_code == 403
            assert list_with(["service_account:write"]).status_code == 403

    def test_create(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            project = self.create_project(organization=self.organization)

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["project:read", "event:read"],
                projectIds=[project.id],
                status_code=201,
            )

        service_account = ServiceAccount.objects.get(id=response.data["id"])
        assert service_account.organization_id == self.organization.id
        assert service_account.name == "nightly-triage"
        assert service_account.scope_list == ["event:read", "project:read"]
        assert service_account.is_active
        assert service_account.created_by_id == self.user.id
        assert service_account.owner_kind == ServiceAccountOwnerKind.ORGANIZATION
        assert project_ids_for(service_account) == [project.id]
        assert response.data == {
            "id": str(service_account.id),
            "name": "nightly-triage",
            "scopes": ["event:read", "project:read"],
            "projectIds": [str(project.id)],
            "allProjects": False,
            "ownerKind": "organization",
            "dateCreated": service_account.date_added,
        }

        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_ADD"))
        assert entry.organization_id == self.organization.id
        assert entry.actor_id == self.user.id
        assert entry.target_object == service_account.id
        assert entry.data == {
            "name": "nightly-triage",
            "scopes": ["event:read", "project:read"],
            "project_ids": [str(project.id)],
            "all_projects": False,
        }

    def test_create_reuses_deleted_account_name(self) -> None:
        deleted = self.create_service_account(organization=self.organization, name="nightly-triage")
        deleted.deactivate()

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                status_code=201,
            )

        assert response.data["id"] != str(deleted.id)
        assert (
            ServiceAccount.objects.filter(
                organization_id=self.organization.id, name="nightly-triage"
            ).count()
            == 2
        )

    def test_create_duplicate_name(self) -> None:
        self.create_service_account(organization=self.organization, name="nightly-triage")

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                status_code=400,
            )

        assert response.data["detail"]["name"] == [
            "A service account with this name already exists."
        ]
        assert ServiceAccount.objects.filter(organization_id=self.organization.id).count() == 1

    def test_create_same_name_in_other_org(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_organization = self.create_organization()
        self.create_service_account(organization=other_organization, name="nightly-triage")

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                status_code=201,
            )

    def test_create_requires_service_account_write(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                status_code=403,
            )

        assert not ServiceAccount.objects.exists()

    def test_manager_can_create(self) -> None:
        manager = self.create_user()
        self.create_member(organization=self.organization, user=manager, role="manager")
        self.login_as(manager)

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                status_code=201,
            )

    def test_create_rejects_org_admin_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:admin"])
        url = reverse(self.endpoint, args=[self.organization.slug])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(
                url,
                data={"name": "nightly-triage", "scopes": ["org:read"]},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 403
        assert not ServiceAccount.objects.exists()

    def test_create_rejects_scopes_caller_lacks(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(
                user=self.user, scope_list=["service_account:write"]
            )
        url = reverse(self.endpoint, args=[self.organization.slug])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(
                url,
                data={"name": "nightly-triage", "scopes": ["event:read"]},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 400
        assert "event:read" in str(response.data["detail"])
        assert not ServiceAccount.objects.exists()

    def test_create_rejects_projects_from_other_orgs(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_project = self.create_project(organization=self.create_organization())

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[other_project.id],
                status_code=400,
            )

        assert str(other_project.id) in str(response.data["detail"])
        assert not ServiceAccount.objects.exists()

    def test_create_all_projects(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="seer-autofix",
                scopes=["event:read"],
                allProjects=True,
                status_code=201,
            )

        service_account = ServiceAccount.objects.get(id=response.data["id"])
        assert service_account.all_projects
        assert project_ids_for(service_account) == []
        assert response.data["allProjects"] is True
        assert response.data["projectIds"] == []
        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_ADD"))
        assert entry.data["all_projects"] is True

    def test_create_rejects_all_projects_with_projects(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            project = self.create_project(organization=self.organization)

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                method="post",
                name="seer-autofix",
                scopes=["event:read"],
                allProjects=True,
                projectIds=[project.id],
                status_code=400,
            )

        assert response.data["detail"]["projectIds"] == [ALL_PROJECTS_WITH_PROJECTS_ERROR]
        assert not ServiceAccount.objects.exists()

    def test_create_all_projects_requires_global_role(self) -> None:
        api_key = self.create_api_key(
            organization=self.organization, scope_list=["service_account:write", "event:read"]
        )
        url = reverse(self.endpoint, args=[self.organization.slug])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(
                url,
                data={"name": "seer-autofix", "scopes": ["event:read"], "allProjects": True},
                format="json",
                HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
            )
            assert response.status_code == 403
            assert response.data["detail"] == ALL_PROJECTS_ROLE_ERROR
            assert not ServiceAccount.objects.exists()

            # The same caller can still create an account with listed projects.
            response = self.client.post(
                url,
                data={"name": "seer-autofix", "scopes": ["event:read"]},
                format="json",
                HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
            )
            assert response.status_code == 201
            assert response.data["allProjects"] is False

    def test_owner_can_grant_projects_outside_their_teams(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            project = self.create_project(
                organization=self.organization,
                teams=[self.create_team(organization=self.organization)],
            )

        with self.feature(FEATURE_FLAG), assert_no_organization_resource_hydration():
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id],
                status_code=201,
            )
        assert response.data["projectIds"] == [str(project.id)]
        assert project_ids_for(ServiceAccount.objects.get(id=response.data["id"])) == [project.id]

    def test_create_rejects_inactive_projects(self) -> None:
        inactive = [
            self.create_project(organization=self.organization, status=status)
            for status in (
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
                ObjectStatus.DISABLED,
            )
        ]
        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id for project in inactive],
                status_code=400,
            )
        for project in inactive:
            assert str(project.id) in str(response.data["detail"]["projectIds"])
        assert not ServiceAccount.objects.exists()
        assert not ServiceAccountProject.objects.exists()

    def test_project_list_limit_and_deduplication(self) -> None:
        project = self.create_project(organization=self.organization)
        with (
            self.feature(FEATURE_FLAG),
            mock.patch.object(
                DatabaseBackedOrganizationService,
                "get_active_project_ids",
                autospec=True,
                side_effect=DatabaseBackedOrganizationService.get_active_project_ids,
            ) as lookup,
        ):
            response = self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id] * (MAX_PROJECT_IDS_PER_REQUEST + 1),
                status_code=400,
            )
            assert response.data["detail"]["projectIds"][0].code == "max_length"
            lookup.assert_not_called()
            assert not ServiceAccount.objects.exists()

            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id] * MAX_PROJECT_IDS_PER_REQUEST,
                status_code=201,
            )
            lookup.assert_called_once_with(
                mock.ANY, organization_id=self.organization.id, project_ids=[project.id]
            )
        assert project_ids_for(ServiceAccount.objects.get(id=response.data["id"])) == [project.id]

    def test_project_validation_filters_membership_before_rpc(self) -> None:
        member = self.create_user()
        team = self.create_team(organization=self.organization)
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])
        allowed = self.create_project(organization=self.organization, teams=[team])
        denied = self.create_project(organization=self.organization, teams=[])
        with assume_test_silo_mode(SiloMode.CELL):
            self.organization.flags.allow_joinleave = False
            self.organization.save()
        context = organization_service.get_access_context(
            organization_id=self.organization.id, user_id=member.id
        )
        assert context is not None
        serializer = ServiceAccountCreateSerializer(
            context={
                "organization": context.organization,
                "access": access.from_user_and_rpc_user_org_context(
                    user=member, rpc_user_org_context=context
                ),
            }
        )
        with mock.patch.object(
            DatabaseBackedOrganizationService,
            "get_active_project_ids",
            autospec=True,
            side_effect=DatabaseBackedOrganizationService.get_active_project_ids,
        ) as lookup:
            with pytest.raises(serializers.ValidationError, match=str(denied.id)):
                serializer.validate_projectIds([allowed.id, denied.id])
            lookup.assert_called_once_with(
                mock.ANY, organization_id=self.organization.id, project_ids=[allowed.id]
            )
            lookup.reset_mock()
            with pytest.raises(serializers.ValidationError, match=str(denied.id)):
                serializer.validate_projectIds([denied.id])
            lookup.assert_not_called()


@control_silo_test
class OrganizationServiceAccountDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-account-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        with assume_test_silo_mode(SiloMode.CELL):
            self.projects = [self.create_project(organization=self.organization) for _ in range(2)]
        self.service_account = self.create_service_account(
            organization=self.organization,
            name="seer-autofix",
            scope_list=["org:read", "project:read"],
            project_ids=[self.projects[0].id],
        )

    def test_flag_off_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, self.service_account.id, status_code=404)

    def test_get(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, self.service_account.id)

        assert response.data == {
            "id": str(self.service_account.id),
            "name": "seer-autofix",
            "scopes": ["org:read", "project:read"],
            "projectIds": [str(self.projects[0].id)],
            "allProjects": False,
            "ownerKind": None,
            "dateCreated": self.service_account.date_added,
        }

    def test_get_owned_account_returns_owner_kind(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization,
            name="Seer: nightly triage #1",
            owner_kind=ServiceAccountOwnerKind.SEER_WORKFLOW_CONFIG,
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, service_account.id)

        assert response.data["ownerKind"] == "seer_workflow_config"

    def test_get_missing(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, self.service_account.id + 1, status_code=404
            )

    def test_other_org_returns_404(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_organization = self.create_organization()
        other = self.create_service_account(organization=other_organization, name="other")

        with self.feature(FEATURE_FLAG):
            self.get_error_response(self.organization.slug, other.id, status_code=404)
            self.get_error_response(
                self.organization.slug, other.id, method="put", name="mine", status_code=404
            )
            self.get_error_response(
                self.organization.slug, other.id, method="delete", status_code=404
            )

        other.refresh_from_db()
        assert other.name == "other"

    def test_update(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                name="seer-autofix-v2",
                scopes=["event:read"],
            )

        self.service_account.refresh_from_db()
        assert self.service_account.name == "seer-autofix-v2"
        assert self.service_account.scope_list == ["event:read"]
        # Leaving out `projectIds` keeps the projects.
        assert project_ids_for(self.service_account) == [self.projects[0].id]
        assert response.data["projectIds"] == [str(self.projects[0].id)]

        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_EDIT"))
        assert entry.target_object == self.service_account.id
        assert entry.data == {
            "name": "seer-autofix-v2",
            "scopes": ["event:read"],
            "project_ids": [str(self.projects[0].id)],
            "all_projects": False,
        }

    def test_update_replaces_projects(self) -> None:
        with self.feature(FEATURE_FLAG), assert_no_organization_resource_hydration():
            response = self.get_success_response(
                self.organization.id,
                self.service_account.id,
                method="put",
                projectIds=[self.projects[1].id],
            )

        assert response.data["projectIds"] == [str(self.projects[1].id)]
        assert project_ids_for(self.service_account) == [self.projects[1].id]
        self.service_account.refresh_from_db()
        assert self.service_account.name == "seer-autofix"
        assert self.service_account.scope_list == ["org:read", "project:read"]

    def test_update_clears_projects(self) -> None:
        cleared: list[list[int] | None] = [[], None]
        for project_ids in cleared:
            service_account = self.create_service_account(
                organization=self.organization,
                name=f"clear-{project_ids}",
                project_ids=[self.projects[0].id],
            )
            with self.feature(FEATURE_FLAG):
                response = self.get_success_response(
                    self.organization.slug,
                    service_account.id,
                    method="put",
                    projectIds=project_ids,
                )

            assert response.data["projectIds"] == []
            assert project_ids_for(service_account) == []

    def test_update_to_all_projects_clears_projects(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                allProjects=True,
            )

        self.service_account.refresh_from_db()
        assert self.service_account.all_projects
        assert project_ids_for(self.service_account) == []
        assert response.data["allProjects"] is True
        assert response.data["projectIds"] == []
        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_EDIT"))
        assert entry.data["all_projects"] is True
        assert entry.data["project_ids"] == []

    def test_update_from_all_projects_to_listed_projects(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization, name="seer-explorer", all_projects=True
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                service_account.id,
                method="put",
                allProjects=False,
                projectIds=[self.projects[1].id],
            )

        service_account.refresh_from_db()
        assert not service_account.all_projects
        assert project_ids_for(service_account) == [self.projects[1].id]
        assert response.data["allProjects"] is False
        assert response.data["projectIds"] == [str(self.projects[1].id)]

    def test_update_rejects_projects_on_all_projects_account(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization, name="seer-explorer", all_projects=True
        )

        with self.feature(FEATURE_FLAG):
            for data in (
                {"projectIds": [self.projects[0].id]},
                {"allProjects": True, "projectIds": [self.projects[0].id]},
            ):
                response = self.get_error_response(
                    self.organization.slug,
                    service_account.id,
                    method="put",
                    status_code=400,
                    **data,
                )
                assert response.data["detail"]["projectIds"] == [ALL_PROJECTS_WITH_PROJECTS_ERROR]

        service_account.refresh_from_db()
        assert service_account.all_projects
        assert project_ids_for(service_account) == []

    def test_update_all_projects_requires_global_role(self) -> None:
        service_account = self.create_service_account(
            organization=self.organization, name="seer-explorer", all_projects=True
        )
        api_key = self.create_api_key(
            organization=self.organization, scope_list=["service_account:write"]
        )

        def put(service_account_id: int, data: dict[str, Any]) -> Any:
            return self.client.put(
                reverse(self.endpoint, args=[self.organization.slug, service_account_id]),
                data=data,
                format="json",
                HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
            )

        with self.feature(FEATURE_FLAG):
            # Widening an account with listed projects.
            response = put(self.service_account.id, {"allProjects": True})
            assert response.status_code == 403
            assert response.data["detail"] == ALL_PROJECTS_ROLE_ERROR
            # Editing an account that keeps all projects.
            response = put(service_account.id, {"name": "renamed"})
            assert response.status_code == 403
            # Narrowing it is allowed.
            response = put(service_account.id, {"allProjects": False})
            assert response.status_code == 200

        self.service_account.refresh_from_db()
        assert not self.service_account.all_projects
        assert project_ids_for(self.service_account) == [self.projects[0].id]
        service_account.refresh_from_db()
        assert service_account.name == "seer-explorer"
        assert not service_account.all_projects

    def login_as_limited_caller(self) -> int:
        """
        Log in as a caller with `service_account:write` who reaches only the returned
        project. No shipped role does this, so the test turns off the manager's global
        access.
        """
        team = self.create_team(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CELL):
            visible = self.create_project(organization=self.organization, teams=[team])
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, role="manager", teams=[team])
        self.login_as(user)
        patcher = mock.patch.object(
            RpcBackedAccess, "has_global_access", new_callable=mock.PropertyMock, return_value=False
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        return visible.id

    def test_limited_caller_cannot_add_scopes_to_account_with_hidden_projects(self) -> None:
        self.login_as_limited_caller()

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                scopes=["org:read", "project:read", "event:read"],
                status_code=403,
            )
            assert response.data["detail"] == ADD_SCOPES_HIDDEN_PROJECTS_ERROR
            self.service_account.refresh_from_db()
            assert self.service_account.scope_list == ["org:read", "project:read"]

            # Removing scopes and renaming don't widen the account.
            self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                name="renamed",
                scopes=["org:read"],
            )
        self.service_account.refresh_from_db()
        assert self.service_account.name == "renamed"
        assert self.service_account.scope_list == ["org:read"]

    def test_limited_caller_can_add_scopes_when_all_projects_are_visible(self) -> None:
        visible_id = self.login_as_limited_caller()
        service_account = self.create_service_account(
            organization=self.organization,
            name="nightly-triage",
            scope_list=["org:read"],
            project_ids=[visible_id],
        )

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug,
                service_account.id,
                method="put",
                scopes=["org:read", "event:read"],
            )
        service_account.refresh_from_db()
        assert service_account.scope_list == ["event:read", "org:read"]

    def test_limited_caller_replace_keeps_hidden_projects(self) -> None:
        visible_id = self.login_as_limited_caller()
        hidden_id = self.projects[0].id

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                projectIds=[visible_id],
            )
            assert response.data["projectIds"] == [str(hidden_id), str(visible_id)]
            assert project_ids_for(self.service_account) == [hidden_id, visible_id]

            self.get_success_response(
                self.organization.slug, self.service_account.id, method="put", projectIds=[]
            )
        assert project_ids_for(self.service_account) == [hidden_id]

    def test_limited_caller_cannot_narrow_all_projects(self) -> None:
        visible_id = self.login_as_limited_caller()
        service_account = self.create_service_account(
            organization=self.organization, name="seer-explorer", all_projects=True
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                service_account.id,
                method="put",
                allProjects=False,
                projectIds=[visible_id],
                status_code=403,
            )
        assert response.data["detail"] == NARROW_ALL_PROJECTS_ERROR
        service_account.refresh_from_db()
        assert service_account.all_projects
        assert project_ids_for(service_account) == []

    def test_update_rejects_inactive_projects_without_changing_grants(self) -> None:
        inactive = [
            self.create_project(organization=self.organization, status=status)
            for status in (
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
                ObjectStatus.DISABLED,
            )
        ]
        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                name="renamed",
                projectIds=[self.projects[1].id, *(project.id for project in inactive)],
                status_code=400,
            )
        for project in inactive:
            assert str(project.id) in str(response.data["detail"]["projectIds"])
        assert project_ids_for(self.service_account) == [self.projects[0].id]
        self.service_account.refresh_from_db()
        assert self.service_account.name == "seer-autofix"

    def test_update_keeps_own_name(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, self.service_account.id, method="put", name="seer-autofix"
            )

    def test_update_duplicate_name(self) -> None:
        self.create_service_account(organization=self.organization, name="nightly-triage")

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                name="nightly-triage",
                status_code=400,
            )

        assert response.data["detail"]["name"] == [
            "A service account with this name already exists."
        ]
        self.service_account.refresh_from_db()
        assert self.service_account.name == "seer-autofix"

    def test_update_rejects_scopes_caller_lacks(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["service_account:write"])
        url = reverse(self.endpoint, args=[self.organization.slug, self.service_account.id])

        with self.feature(FEATURE_FLAG):
            response = self.client.put(
                url,
                data={"scopes": ["event:read"]},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 400
        assert "event:read" in str(response.data["detail"])
        self.service_account.refresh_from_db()
        assert self.service_account.scope_list == ["org:read", "project:read"]

    def test_update_after_concurrent_delete_returns_404(self) -> None:
        convert_args = OrganizationServiceAccountDetailsEndpoint.convert_args
        service_account_id = self.service_account.id

        def convert_args_then_delete(
            endpoint: OrganizationServiceAccountDetailsEndpoint,
            request: Request,
            *args: Any,
            **kwargs: Any,
        ) -> tuple[tuple[Any, ...], dict[str, Any]]:
            args, kwargs = convert_args(endpoint, request, *args, **kwargs)
            ServiceAccount.objects.get(id=service_account_id).deactivate()
            return args, kwargs

        with (
            mock.patch.object(
                OrganizationServiceAccountDetailsEndpoint,
                "convert_args",
                autospec=True,
                side_effect=convert_args_then_delete,
            ),
            self.feature(FEATURE_FLAG),
        ):
            self.get_error_response(
                self.organization.slug,
                service_account_id,
                method="put",
                name="renamed",
                status_code=404,
            )

        service_account = ServiceAccount.objects.get(id=service_account_id)
        assert service_account.name == "seer-autofix"
        assert not service_account.is_active
        assert not AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SERVICE_ACCOUNT_EDIT")
        ).exists()

    def test_update_requires_service_account_write(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                name="mine",
                status_code=403,
            )

    def test_update_replicates_to_cell(self) -> None:
        with self.feature(FEATURE_FLAG), outbox_runner():
            self.get_success_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                scopes=["org:read"],
                projectIds=[self.projects[1].id],
            )

        with assume_test_silo_mode(SiloMode.CELL):
            replica = ServiceAccountReplica.objects.get(service_account_id=self.service_account.id)
            assert replica.scope_list == ["org:read"]
            assert not replica.all_projects
            assert list(
                ServiceAccountProjectReplica.objects.filter(service_account=replica).values_list(
                    "project_id", flat=True
                )
            ) == [self.projects[1].id]

    def test_update_to_all_projects_replicates_to_cell(self) -> None:
        with self.feature(FEATURE_FLAG), outbox_runner():
            self.get_success_response(
                self.organization.slug, self.service_account.id, method="put", allProjects=True
            )

        with assume_test_silo_mode(SiloMode.CELL):
            replica = ServiceAccountReplica.objects.get(service_account_id=self.service_account.id)
            assert replica.all_projects
            assert not ServiceAccountProjectReplica.objects.filter(service_account=replica).exists()

    def test_delete(self) -> None:
        service_account_id = self.service_account.id

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, service_account_id, method="delete", status_code=204
            )

        # The row stays, turned off, so references to the account stay set.
        service_account = ServiceAccount.objects.get(id=service_account_id)
        assert not service_account.is_active
        assert service_account.name == "seer-autofix"
        assert service_account.scope_list == ["org:read", "project:read"]
        assert not ServiceAccountProject.objects.filter(
            service_account_id=service_account_id
        ).exists()

        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE"))
        assert entry.target_object == service_account_id
        # The entry describes the account before the delete.
        assert entry.data == {
            "name": "seer-autofix",
            "scopes": ["org:read", "project:read"],
            "project_ids": [str(self.projects[0].id)],
            "all_projects": False,
        }

    def test_delete_deactivates_tokens(self) -> None:
        def create_token(name: str) -> ServiceAccountToken:
            stored = stored_token_fields(f"plaintext-{name}")
            return ServiceAccountToken.objects.create(
                service_account=self.service_account,
                organization_id=self.organization.id,
                name=name,
                token_hashed=stored.token_hashed,
                token_last_characters=stored.token_last_characters,
                scope_list=["project:read"],
                created_by=self.user,
            )

        with outbox_runner():
            active = create_token("deploys")
            revoked = create_token("old")
            revoked_at = timezone.now() - timedelta(days=1)
            revoked.update(date_deactivated=revoked_at)

        with self.feature(FEATURE_FLAG), outbox_runner():
            self.get_success_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=204
            )

        active.refresh_from_db()
        revoked.refresh_from_db()
        assert active.date_deactivated is not None
        assert revoked.date_deactivated == revoked_at

        entries = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SERVICE_ACCOUNT_TOKEN_REMOVE")
        )
        assert [(entry.target_object, entry.actor_id, entry.data) for entry in entries] == [
            (
                active.id,
                self.user.id,
                {
                    "name": "deploys",
                    "scopes": ["project:read"],
                    "service_account_id": self.service_account.id,
                    "service_account_name": "seer-autofix",
                    "reason": "service_account_deleted",
                },
            )
        ]

        with assume_test_silo_mode(SiloMode.CELL):
            replica = ServiceAccountTokenReplica.objects.get(token_id=active.id)
            assert replica.date_deactivated == active.date_deactivated

    def test_delete_writes_audit_log_when_outbox_flush_fails(self) -> None:
        stored = stored_token_fields("plaintext-deploys")
        with outbox_runner():
            token = ServiceAccountToken.objects.create(
                service_account=self.service_account,
                organization_id=self.organization.id,
                name="deploys",
                token_hashed=stored.token_hashed,
                token_last_characters=stored.token_last_characters,
                scope_list=["project:read"],
                created_by=self.user,
            )

        with (
            self.feature(FEATURE_FLAG),
            mock.patch(
                "sentry.service_accounts.models.ServiceAccountToken.handle_async_replication",
                side_effect=Exception("cell unavailable"),
            ),
        ):
            self.get_success_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=204
            )

        token.refresh_from_db()
        assert token.date_deactivated is not None
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE"),
            target_object=self.service_account.id,
        ).exists()
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SERVICE_ACCOUNT_TOKEN_REMOVE"), target_object=token.id
        ).exists()

    def test_delete_clears_all_projects(self) -> None:
        self.service_account.update(all_projects=True)

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=204
            )

        self.service_account.refresh_from_db()
        assert not self.service_account.all_projects
        assert not self.service_account.is_active

    def test_deleted_account_returns_404(self) -> None:
        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=204
            )

            self.get_error_response(
                self.organization.slug, self.service_account.id, status_code=404
            )
            self.get_error_response(
                self.organization.slug,
                self.service_account.id,
                method="put",
                name="renamed",
                status_code=404,
            )
            self.get_error_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=404
            )

        assert (
            AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE")
            ).count()
            == 1
        )

    def test_delete_after_concurrent_delete_returns_404(self) -> None:
        convert_args = OrganizationServiceAccountDetailsEndpoint.convert_args
        service_account_id = self.service_account.id

        def convert_args_then_delete(
            endpoint: OrganizationServiceAccountDetailsEndpoint,
            request: Request,
            *args: Any,
            **kwargs: Any,
        ) -> tuple[tuple[Any, ...], dict[str, Any]]:
            args, kwargs = convert_args(endpoint, request, *args, **kwargs)
            ServiceAccount.objects.get(id=service_account_id).deactivate()
            return args, kwargs

        with (
            mock.patch.object(
                OrganizationServiceAccountDetailsEndpoint,
                "convert_args",
                autospec=True,
                side_effect=convert_args_then_delete,
            ),
            self.feature(FEATURE_FLAG),
        ):
            self.get_error_response(
                self.organization.slug, service_account_id, method="delete", status_code=404
            )

        assert not AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE")
        ).exists()

    def test_delete_requires_service_account_write(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=403
            )

        assert ServiceAccount.objects.filter(id=self.service_account.id).exists()

    def test_delete_keeps_cell_replica_turned_off(self) -> None:
        service_account_id = self.service_account.id

        with self.feature(FEATURE_FLAG), outbox_runner():
            self.get_success_response(
                self.organization.slug, service_account_id, method="delete", status_code=204
            )

        with self.tasks(), assume_test_silo_mode(SiloMode.CELL):
            schedule_hybrid_cloud_foreign_key_jobs()
            replica = ServiceAccountReplica.objects.get(service_account_id=service_account_id)
            assert not replica.is_active
            assert not ServiceAccountProjectReplica.objects.filter(service_account=replica).exists()

    def test_delete_keeps_attribution(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            dashboard = Dashboard.objects.create(
                organization=self.organization,
                title="Triage",
                created_by_service_account_id=self.service_account.id,
            )

        with self.feature(FEATURE_FLAG), outbox_runner():
            self.get_success_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=204
            )

        with self.tasks(), assume_test_silo_mode(SiloMode.CELL):
            schedule_hybrid_cloud_foreign_key_jobs()
            dashboard.refresh_from_db()
            assert dashboard.created_by_service_account_id == self.service_account.id
