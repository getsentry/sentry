from __future__ import annotations

from unittest import mock

from django.urls import reverse

from sentry.incidents.grouptype import MetricIssue
from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
)
from sentry.notebooks.models import (
    Notebook,
    NotebookBlockExecutionStatus,
    NotebookProject,
    NotebookSourceType,
    NotebookStatus,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationNotebookDetailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-notebooks",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.start_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_detail_is_scoped_to_organization(self) -> None:
        other_organization = self.create_organization()
        foreign = self.create_notebook(
            organization=other_organization, created_by=self.user, title="Foreign"
        )
        url = reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": foreign.id,
            },
        )
        assert self.client.get(url).status_code == 404

    def test_archive_restore_and_list_filters(self) -> None:
        first = self.client.post(
            self.collection_url, data={"title": "Checkout investigation"}, format="json"
        ).data
        self.client.post(
            self.collection_url, data={"title": "Payments investigation"}, format="json"
        )
        detail_url = reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": first["id"],
            },
        )

        response = self.client.delete(
            detail_url,
            data={"notebookVersion": first["version"]},
            format="json",
        )
        assert response.status_code == 204
        response = self.client.get(f"{self.collection_url}?query=Checkout")
        assert response.data == []
        response = self.client.get(self.collection_url, {"status": "archived"})
        assert [item["id"] for item in response.data] == [first["id"]]

        archived = self.client.get(detail_url).data
        response = self.client.put(
            detail_url,
            data={"notebookVersion": archived["version"], "status": "active"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "active"

    def test_update_takes_notebook_version(self) -> None:
        notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Versioned"
        )

        old_name = self.client.put(
            self.details_url(notebook),
            data={"investigationVersion": 1, "title": "Renamed"},
            format="json",
        )
        assert old_name.status_code == 400
        assert "investigationVersion" in old_name.data

        renamed = self.client.put(
            self.details_url(notebook),
            data={"notebookVersion": 1, "title": "Renamed"},
            format="json",
        )
        assert renamed.status_code == 200, renamed.data
        assert renamed.data["version"] == 2

        stale = self.client.put(
            self.details_url(notebook),
            data={"notebookVersion": 1, "title": "Again"},
            format="json",
        )
        assert stale.status_code == 409

    def test_archive_rejects_an_active_block_run(self) -> None:
        created = self.client.post(
            self.collection_url, data={"title": "Running investigation"}, format="json"
        ).data
        notebook = Notebook.objects.get(id=created["id"])
        notebook.version += 3
        notebook.save(update_fields=["version", "date_updated"])
        block = self.create_notebook_block(notebook=notebook, kind="text")
        self.create_notebook_block_execution(
            block=block,
            executor="text_generation",
            status=NotebookBlockExecutionStatus.RUNNING,
            block_version=block.version,
            input_snapshot={},
        )
        detail_url = reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": notebook.id,
            },
        )

        response = self.client.delete(
            detail_url,
            data={"notebookVersion": notebook.version},
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {
            "detail": "Stop active block runs before archiving this investigation."
        }

    def test_archiving_agentic_notebook_durably_queues_cancellation(self) -> None:
        created = self.client.post(
            self.start_url,
            data={"source": {"type": "manual", "seed": {}}},
            format="json",
        ).data
        notebook = Notebook.objects.get(id=created["id"])
        block = self.create_notebook_block(
            notebook=notebook,
            kind="text",
            producer_revision=1,
            producer_key="streaming-summary",
        )
        execution = self.create_notebook_block_execution(
            block=block,
            executor="code_mode",
            status=NotebookBlockExecutionStatus.RUNNING,
            block_version=block.version,
            input_snapshot={"projectIds": [self.project.id]},
        )
        notebook.version += 3
        notebook.save(update_fields=["version", "date_updated"])

        with mock.patch(
            "sentry.investigations.services.orchestration.transaction.on_commit"
        ) as schedule:
            response = self.client.delete(
                self.details_url(notebook),
                data={"notebookVersion": created["version"]},
                format="json",
            )

        assert response.status_code == 204
        notebook.refresh_from_db()
        assert notebook.status == NotebookStatus.ARCHIVED
        execution.refresh_from_db()
        assert execution.status == NotebookBlockExecutionStatus.CANCELLED
        assert execution.error == {
            "code": "investigation_archived",
            "message": "The investigation was archived.",
        }
        command = InvestigationOrchestrationCommand.objects.get(
            orchestration_run__investigation=notebook
        )
        assert command.type == "cancel"
        assert command.payload == {"reason": "investigation_archived"}
        assert command.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        run = notebook.orchestration_run
        assert run.projection["_sentryControl"]["notebookWriteFenceGeneration"] == run.generation
        schedule.assert_called_once()

        restored = self.client.put(
            self.details_url(notebook),
            data={"notebookVersion": notebook.version, "status": "active"},
            format="json",
        )
        assert restored.status_code == 200, restored.data
        with mock.patch(
            "sentry.tasks.seer.investigation.dispatch_investigation_orchestration_commands.delay"
        ):
            for _ in range(2):
                archived = self.client.delete(
                    self.details_url(notebook),
                    data={"notebookVersion": created["version"]},
                    format="json",
                )
                assert archived.status_code == 204, archived.data
        notebook.refresh_from_db()
        assert notebook.status == NotebookStatus.ARCHIVED
        assert list(
            run.commands.order_by("id").values_list("expected_workflow_version", flat=True)
        ) == [1, 2]

    def test_agentic_title_update_marks_a_manual_override(self) -> None:
        created = self.client.post(
            self.start_url,
            data={"source": {"type": "manual", "seed": {}}},
            format="json",
        ).data
        notebook = Notebook.objects.get(id=created["id"])

        response = self.client.put(
            self.details_url(notebook),
            data={
                "notebookVersion": created["version"],
                "title": "My incident title",
            },
            format="json",
        )

        assert response.status_code == 200, response.data
        run = notebook.orchestration_run
        assert run.projection["_sentryControl"] == {
            "manualTitleOverride": True,
            "titleBuffer": "My incident title",
            "titleStarted": True,
        }

        stale_response = self.client.put(
            self.details_url(notebook),
            data={
                "notebookVersion": created["version"],
                "title": "Overwrite from a stale editor",
            },
            format="json",
        )
        assert stale_response.status_code == 409
        notebook.refresh_from_db()
        assert notebook.title == "My incident title"

    def test_detail_includes_action_requests(self) -> None:
        detector = self.create_detector(project=self.project, type=MetricIssue.slug)
        notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Breach"
        )
        self.create_investigation_orchestration_run(
            investigation=notebook,
            source={"type": "breached_metric", "detectorId": str(detector.id)},
        )
        action_request = self.create_notebook_action_request(
            notebook=notebook,
            key="widen-window",
            action_kind="update_detector",
            action_payload={
                "kind": "update_detector",
                "detectorId": str(detector.id),
                "before": {"timeWindowSeconds": 300},
                "changes": {"timeWindowSeconds": 900},
            },
        )
        url = reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": notebook.id,
            },
        )

        response = self.client.get(url)

        assert response.status_code == 200
        [serialized] = response.data["actionRequests"]
        assert serialized["id"] == str(action_request.id)
        assert serialized["action"] == action_request.action_payload
        assert (serialized["canApply"], serialized["cannotApplyReason"]) == (True, None)

        updated = self.client.put(
            url,
            data={"notebookVersion": notebook.version, "title": "Renamed"},
            format="json",
        )

        assert updated.status_code == 200
        assert updated.data["actionRequests"][0]["canApply"] is True

    def test_metadata_update_persists_and_stale_version_rolls_back(self) -> None:
        created = self.client.post(
            self.collection_url,
            data={"title": "Before", "projectIds": [self.project.id]},
            format="json",
        ).data
        url = reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": created["id"],
            },
        )
        response = self.client.put(
            url,
            data={
                "notebookVersion": created["version"],
                "title": "After",
                "filters": {"environment": ["production"]},
                "projectIds": [],
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["title"] == "After"
        assert response.data["filters"] == {"environment": ["production"]}
        assert response.data["projectIds"] == []

        response = self.client.put(
            url,
            data={"notebookVersion": created["version"], "title": "Stale write"},
            format="json",
        )
        assert response.status_code == 409
        notebook = Notebook.objects.get(id=created["id"])
        assert notebook.title == "After"

    def test_regular_member_can_edit_and_archive_another_users_notebook(self) -> None:
        notebook = self.create_notebook(
            organization=self.organization,
            created_by=self.user,
            title="Created by someone else",
        )
        member_user = self.create_user()
        self.create_member(organization=self.organization, user=member_user, role="member")
        self.login_as(member_user)
        url = self.details_url(notebook)

        response = self.client.put(
            url,
            data={"notebookVersion": notebook.version, "title": "Updated by member"},
            format="json",
        )
        assert response.status_code == 200, response.data

        response = self.client.delete(
            url,
            data={"notebookVersion": response.data["version"]},
            format="json",
        )
        assert response.status_code == 204
        notebook.refresh_from_db()
        assert notebook.status == NotebookStatus.ARCHIVED

    def archived_notebook(self) -> Notebook:
        notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Archived"
        )
        self.create_notebook_project(notebook=notebook, project=self.project)
        Notebook.objects.filter(id=notebook.id).update(status=NotebookStatus.ARCHIVED)
        notebook.refresh_from_db()
        return notebook

    def details_url(self, notebook: Notebook) -> str:
        return reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": notebook.id,
            },
        )

    def test_restoring_an_archived_notebook_cannot_also_change_projects(self) -> None:
        notebook = self.archived_notebook()
        other_project = self.create_project(organization=self.organization)

        response = self.client.put(
            self.details_url(notebook),
            data={
                "notebookVersion": notebook.version,
                "status": "active",
                "projectIds": [other_project.id],
            },
            format="json",
        )

        assert response.status_code == 400
        notebook.refresh_from_db()
        assert notebook.status == NotebookStatus.ARCHIVED
        assert list(
            NotebookProject.objects.filter(notebook=notebook).values_list("project_id", flat=True)
        ) == [self.project.id]

    def test_restoring_an_archived_notebook_by_status_alone_is_allowed(self) -> None:
        notebook = self.archived_notebook()

        response = self.client.put(
            self.details_url(notebook),
            data={"notebookVersion": notebook.version, "status": "active"},
            format="json",
        )

        assert response.status_code == 200, response.data
        notebook.refresh_from_db()
        assert notebook.status == NotebookStatus.ACTIVE

    def test_archived_notebooks_reject_other_edits(self) -> None:
        notebook = self.archived_notebook()

        response = self.client.put(
            self.details_url(notebook),
            data={"notebookVersion": notebook.version, "title": "Renamed"},
            format="json",
        )

        assert response.status_code == 400
        notebook.refresh_from_db()
        assert notebook.title == "Archived"

    def lineage(self) -> tuple[Notebook, Notebook]:
        first = self.create_notebook(
            organization=self.organization, created_by=self.user, title="rev1"
        )
        second = self.create_notebook(
            organization=self.organization, created_by=self.user, title="rev2"
        )
        for revision, notebook in enumerate((first, second), start=1):
            Notebook.objects.filter(id=notebook.id).update(
                source_type=NotebookSourceType.METRIC_OPEN_PERIOD,
                source_key="metric_open_period:1:2",
                source={"type": "metric_open_period", "ref": {"groupId": "1", "openPeriodId": "2"}},
                source_revision=revision,
                status=(NotebookStatus.ARCHIVED if notebook == first else NotebookStatus.ACTIVE),
            )
            notebook.refresh_from_db()
        return first, second

    def test_a_source_type_without_a_producer_can_be_renamed_and_archived(self) -> None:
        notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Original"
        )
        Notebook.objects.filter(id=notebook.id).update(
            source_type="unregistered", source_key="unregistered:1", source_revision=1
        )
        notebook.refresh_from_db()

        renamed = self.client.put(
            self.details_url(notebook),
            data={"notebookVersion": notebook.version, "title": "Renamed"},
            format="json",
        )
        assert renamed.status_code == 200, renamed.data
        notebook.refresh_from_db()
        assert notebook.title == "Renamed"

        archived = self.client.put(
            self.details_url(notebook),
            data={"notebookVersion": notebook.version, "status": "archived"},
            format="json",
        )
        assert archived.status_code == 200, archived.data
        notebook.refresh_from_db()
        assert notebook.status == NotebookStatus.ARCHIVED

    def test_archiving_a_source_notebook_via_put(self) -> None:
        first, second = self.lineage()

        response = self.client.put(
            self.details_url(second),
            data={"notebookVersion": second.version, "status": "archived"},
            format="json",
        )

        assert response.status_code == 200, response.data
        first.refresh_from_db()
        second.refresh_from_db()
        assert second.status == NotebookStatus.ARCHIVED
        assert first.status == NotebookStatus.ARCHIVED

    def test_archiving_via_put_cannot_be_combined_with_other_changes(self) -> None:
        first, second = self.lineage()

        response = self.client.put(
            self.details_url(second),
            data={
                "notebookVersion": second.version,
                "status": "archived",
                "title": "Renamed",
            },
            format="json",
        )

        assert response.status_code == 400
        second.refresh_from_db()
        assert second.status == NotebookStatus.ACTIVE
        assert second.title == "rev2"
