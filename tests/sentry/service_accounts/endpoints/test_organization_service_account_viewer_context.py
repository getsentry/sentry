from typing import Any

from django.test import override_settings
from django.urls import reverse

from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.models.project import Project
from sentry.service_accounts.models import ServiceAccountProject
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    decode_viewer_context,
    encode_viewer_context,
)

FEATURE_FLAG = "organizations:service-accounts"
SECRET = "service-accounts-test-viewer-context-secret"


@cell_silo_test
@override_settings(SEER_API_SHARED_SECRET=SECRET)
class OrganizationServiceAccountViewerContextTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-account-viewer-context"

    def setUp(self) -> None:
        super().setUp()
        self.service_account = self.create_service_account(
            organization=self.organization,
            name="seer-autofix",
            scope_list=["project:read", "event:read"],
        )
        self.seer_viewer_context = ViewerContext(
            actor=Actor(type=ActorType.SYSTEM), organization_id=self.organization.id
        )

    def _post(
        self, viewer_context: ViewerContext | None = None, service_account_id: int | None = None
    ) -> Any:
        url = reverse(
            self.endpoint,
            args=[self.organization.slug, service_account_id or self.service_account.id],
        )
        with self.feature(FEATURE_FLAG):
            return self.client.post(
                url,
                HTTP_X_VIEWER_CONTEXT=encode_viewer_context(
                    viewer_context or self.seer_viewer_context
                ),
            )

    def _issue(self) -> str:
        response = self._post()
        assert response.status_code == 200
        return response.data["viewerContext"]

    def _get_project(self, viewer_context: str, project: Project) -> Any:
        # Environments needs only project access; details also serializes per-person fields.
        url = reverse(
            "sentry-api-0-project-environments", args=[self.organization.slug, project.slug]
        )
        # Service accounts only authenticate with the flag on.
        with self.feature(FEATURE_FLAG):
            return self.client.get(url, HTTP_X_VIEWER_CONTEXT=viewer_context)

    def test_returns_service_account_viewer_context_and_scopes(self) -> None:
        response = self._post()

        assert response.status_code == 200
        assert response.data["scopes"] == ["event:read", "project:read"]
        returned = decode_viewer_context(response.data["viewerContext"])
        assert returned.organization_id == self.organization.id
        assert returned.actor == Actor(
            type=ActorType.SERVICE_ACCOUNT, actor_id=self.service_account.id
        )

    def test_missing_account_returns_404(self) -> None:
        response = self._post(service_account_id=self.service_account.id + 1)

        assert response.status_code == 404

    def test_account_in_other_org_returns_404(self) -> None:
        other = self.create_service_account(organization=self.create_organization())

        response = self._post(service_account_id=other.id)

        assert response.status_code == 404

    def test_inactive_account_returns_404(self) -> None:
        inactive = self.create_service_account(
            organization=self.organization, name="nightly-triage", is_active=False
        )

        response = self._post(service_account_id=inactive.id)

        assert response.status_code == 404

    def test_changes_apply_to_next_request(self) -> None:
        assert self._post().status_code == 200

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(scope_list=["event:read"])
        response = self._post()
        assert response.status_code == 200
        assert response.data["scopes"] == ["event:read"]

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(is_active=False)
        assert self._post().status_code == 404

    def test_deleted_account_returns_404_on_next_request(self) -> None:
        assert self._post().status_code == 200
        service_account_id = self.service_account.id

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.delete()
        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        assert self._post(service_account_id=service_account_id).status_code == 404

    def test_rejects_viewer_context_for_other_org(self) -> None:
        other_org = self.create_organization()

        response = self._post(
            ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=other_org.id)
        )

        assert response.status_code == 403

    def test_rejects_viewer_context_with_user(self) -> None:
        response = self._post(
            ViewerContext(
                actor=Actor(type=ActorType.USER, actor_id=self.user.id),
                organization_id=self.organization.id,
            )
        )

        assert response.status_code == 403

    def test_rejects_service_account_viewer_context(self) -> None:
        other = self.create_service_account(organization=self.organization, name="other")
        service_account_context = decode_viewer_context(self._issue())

        response = self._post(service_account_context, service_account_id=other.id)

        assert response.status_code == 403

    def test_issued_context_reaches_only_linked_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        linked = self.create_project(organization=self.organization)
        unlinked = self.create_project(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            ServiceAccountProject.objects.create(
                service_account=self.service_account, project_id=linked.id
            )
        viewer_context = self._issue()

        assert self._get_project(viewer_context, linked).status_code == 200
        assert self._get_project(viewer_context, unlinked).status_code == 403

    def test_open_membership_does_not_widen_issued_context(self) -> None:
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        project = self.create_project(organization=self.organization)

        assert self._get_project(self._issue(), project).status_code == 403

    def test_issued_context_reaches_every_project_with_all_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(all_projects=True)
        project = self.create_project(organization=self.organization)

        assert self._get_project(self._issue(), project).status_code == 200

    def test_issued_context_needs_the_endpoint_scope(self) -> None:
        project = self.create_project(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(scope_list=["event:read"], all_projects=True)

        assert self._get_project(self._issue(), project).status_code == 403

    def test_account_changes_apply_to_issued_context(self) -> None:
        project = self.create_project(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(all_projects=True)
        viewer_context = self._issue()
        assert self._get_project(viewer_context, project).status_code == 200

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(all_projects=False)
        assert self._get_project(viewer_context, project).status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(all_projects=True, scope_list=["event:read"])
        assert self._get_project(viewer_context, project).status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(scope_list=["project:read"], is_active=False)
        assert self._get_project(viewer_context, project).status_code == 401

    def test_issued_context_has_no_access_to_other_org(self) -> None:
        other_org = self.create_organization(owner=self.create_user())
        other_project = self.create_project(organization=other_org)
        url = reverse("sentry-api-0-project-details", args=[other_org.slug, other_project.slug])

        viewer_context = self._issue()
        with self.feature(FEATURE_FLAG):
            response = self.client.get(url, HTTP_X_VIEWER_CONTEXT=viewer_context)

        assert response.status_code == 403

    def test_rejects_session_user(self) -> None:
        self.login_as(self.user)
        url = reverse(self.endpoint, args=[self.organization.slug, self.service_account.id])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(url)

        assert response.status_code == 403

    def test_flag_off_returns_404(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug, self.service_account.id])

        response = self.client.post(
            url, HTTP_X_VIEWER_CONTEXT=encode_viewer_context(self.seer_viewer_context)
        )

        assert response.status_code == 404
