from typing import Any
from unittest import mock

from django.urls import reverse
from rest_framework.request import Request

from sentry import audit_log
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.models.auditlogentry import AuditLogEntry
from sentry.service_accounts.endpoints.organization_service_accounts import (
    OrganizationServiceAccountDetailsEndpoint,
)
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountProject,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
)
from sentry.silo.base import SiloMode
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
        second = self.create_service_account(
            organization=self.organization, name="nightly-triage", is_active=False
        )
        self.create_service_account(organization=other_organization, name="seer-autofix")

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug)

        assert response.data == [
            {
                "id": str(first.id),
                "name": "seer-autofix",
                "scopes": ["org:read", "project:read"],
                "projectIds": [str(project.id) for project in sorted(projects, key=lambda p: p.id)],
                "isActive": True,
                "dateCreated": first.date_added,
            },
            {
                "id": str(second.id),
                "name": "nightly-triage",
                "scopes": ["org:read"],
                "projectIds": [],
                "isActive": False,
                "dateCreated": second.date_added,
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
        assert project_ids_for(service_account) == [project.id]
        assert response.data == {
            "id": str(service_account.id),
            "name": "nightly-triage",
            "scopes": ["event:read", "project:read"],
            "projectIds": [str(project.id)],
            "isActive": True,
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
            "is_active": True,
        }

    def test_create_inactive(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                isActive=False,
                status_code=201,
            )

        assert response.data["isActive"] is False
        assert not ServiceAccount.objects.get(id=response.data["id"]).is_active

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

    def test_create_requires_org_admin(self) -> None:
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

    def test_create_rejects_scopes_caller_lacks(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(user=self.user, scope_list=["org:admin"])
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

    def test_owner_can_grant_projects_outside_their_teams(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            project = self.create_project(
                organization=self.organization,
                teams=[self.create_team(organization=self.organization)],
            )

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id],
                status_code=201,
            )

        assert response.data["projectIds"] == [str(project.id)]


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
            "isActive": True,
            "dateCreated": self.service_account.date_added,
        }

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
                isActive=False,
            )

        self.service_account.refresh_from_db()
        assert self.service_account.name == "seer-autofix-v2"
        assert self.service_account.scope_list == ["event:read"]
        assert not self.service_account.is_active
        # Leaving out `projectIds` keeps the projects.
        assert project_ids_for(self.service_account) == [self.projects[0].id]
        assert response.data["projectIds"] == [str(self.projects[0].id)]

        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_EDIT"))
        assert entry.target_object == self.service_account.id
        assert entry.data == {
            "name": "seer-autofix-v2",
            "scopes": ["event:read"],
            "project_ids": [str(self.projects[0].id)],
            "is_active": False,
        }

    def test_update_replaces_projects(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
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
        token = self.create_user_auth_token(user=self.user, scope_list=["org:admin"])
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
            ServiceAccount.objects.get(id=service_account_id).delete()
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

        assert not ServiceAccount.objects.filter(id=service_account_id).exists()
        assert not AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SERVICE_ACCOUNT_EDIT")
        ).exists()

    def test_update_requires_org_admin(self) -> None:
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
            assert list(
                ServiceAccountProjectReplica.objects.filter(service_account=replica).values_list(
                    "project_id", flat=True
                )
            ) == [self.projects[1].id]

    def test_delete(self) -> None:
        service_account_id = self.service_account.id

        with self.feature(FEATURE_FLAG):
            self.get_success_response(
                self.organization.slug, service_account_id, method="delete", status_code=204
            )

        assert not ServiceAccount.objects.filter(id=service_account_id).exists()
        assert not ServiceAccountProject.objects.filter(
            service_account_id=service_account_id
        ).exists()

        entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE"))
        assert entry.target_object == service_account_id
        assert entry.data["name"] == "seer-autofix"

    def test_delete_requires_org_admin(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug, self.service_account.id, method="delete", status_code=403
            )

        assert ServiceAccount.objects.filter(id=self.service_account.id).exists()

    def test_delete_removes_cell_replica(self) -> None:
        service_account_id = self.service_account.id

        with self.feature(FEATURE_FLAG), outbox_runner():
            self.get_success_response(
                self.organization.slug, service_account_id, method="delete", status_code=204
            )

        with self.tasks(), assume_test_silo_mode(SiloMode.CELL):
            schedule_hybrid_cloud_foreign_key_jobs()
            assert not ServiceAccountReplica.objects.filter(
                service_account_id=service_account_id
            ).exists()
