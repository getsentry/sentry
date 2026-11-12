from __future__ import annotations

import pytest

from sentry.api.helpers.creator import CreatorReference
from sentry.notebooks.models import Notebook, NotebookProject, NotebookSourceType
from sentry.notebooks.services.notebooks import (
    NotebookSourceNotFound,
    NotebookValidationError,
    create_manual_notebook,
    create_notebook,
    default_notebook_title,
    lock_notebook,
    update_notebook_row,
)
from sentry.testutils.cases import TestCase


def user_creator(user_id: int) -> CreatorReference:
    return {
        "created_by_id": user_id,
        "created_by_service_account_id": None,
        "created_by_org_auth_token_id": None,
    }


class ProjectLinkScopingTest(TestCase):
    def test_create_rejects_projects_from_another_organization(self) -> None:
        other_organization = self.create_organization(name="other")
        foreign_project = self.create_project(organization=other_organization)

        with pytest.raises(NotebookValidationError) as excinfo:
            create_manual_notebook(
                organization=self.organization,
                creator=user_creator(self.user.id),
                title="Investigation",
                project_ids=[foreign_project.id],
                filters={},
            )

        assert "projectIds" in excinfo.value.errors
        assert not NotebookProject.objects.filter(project_id=foreign_project.id).exists()

    def test_create_notebook_rejected_projects_leave_no_notebook(self) -> None:
        other_organization = self.create_organization(name="other")
        foreign_project = self.create_project(organization=other_organization)

        with pytest.raises(NotebookValidationError):
            create_notebook(
                organization=self.organization,
                created_by_id=self.user.id,
                created_by_service_account_id=None,
                title="Notebook",
                source_type=NotebookSourceType.MANUAL,
                source_key=None,
                source={},
                source_revision=None,
                filters={},
                project_ids=[self.project.id, foreign_project.id],
            )

        assert not Notebook.objects.filter(organization=self.organization).exists()
        assert not NotebookProject.objects.exists()

    def test_create_accepts_projects_in_the_organization(self) -> None:
        notebook = create_manual_notebook(
            organization=self.organization,
            creator=user_creator(self.user.id),
            title="Investigation",
            project_ids=[self.project.id],
            filters={},
        )

        assert list(
            NotebookProject.objects.filter(notebook=notebook).values_list("project_id", flat=True)
        ) == [self.project.id]

    def test_update_rejects_projects_from_another_organization(self) -> None:
        other_organization = self.create_organization(name="other")
        foreign_project = self.create_project(organization=other_organization)
        notebook = create_manual_notebook(
            organization=self.organization,
            creator=user_creator(self.user.id),
            title="Investigation",
            project_ids=[self.project.id],
            filters={},
        )

        with pytest.raises(NotebookValidationError):
            update_notebook_row(
                notebook=notebook,
                expected_version=notebook.version,
                fields={},
                project_ids=[foreign_project.id],
            )

        assert not NotebookProject.objects.filter(project_id=foreign_project.id).exists()


def test_default_title_names_the_notebook_type() -> None:
    assert (
        default_notebook_title(NotebookSourceType.METRIC_OPEN_PERIOD)
        == "New breached metrics investigation"
    )
    assert default_notebook_title(NotebookSourceType.MANUAL) == "New manual investigation"


class ConcurrentModificationTest(TestCase):
    def test_locking_a_deleted_notebook_is_a_missing_source(self) -> None:
        """A concurrent delete should not surface as an unhandled 500."""
        notebook = create_manual_notebook(
            organization=self.organization,
            creator=user_creator(self.user.id),
            title="Gone",
            project_ids=[],
            filters={},
        )
        Notebook.objects.filter(id=notebook.id).delete()

        with pytest.raises(NotebookSourceNotFound):
            lock_notebook(notebook, notebook.version)


class UpdateFieldAllowlistTest(TestCase):
    def test_rejects_fields_outside_the_allowlist(self) -> None:
        """The service does not trust its caller to have filtered `fields`."""
        other_organization = self.create_organization(name="other")
        notebook = create_manual_notebook(
            organization=self.organization,
            creator=user_creator(self.user.id),
            title="Investigation",
            project_ids=[],
            filters={},
        )

        with pytest.raises(NotebookValidationError):
            update_notebook_row(
                notebook=notebook,
                expected_version=notebook.version,
                fields={"organization_id": other_organization.id},
                project_ids=None,
            )

        notebook.refresh_from_db()
        assert notebook.organization_id == self.organization.id

    def test_accepts_the_allowlisted_fields(self) -> None:
        notebook = create_manual_notebook(
            organization=self.organization,
            creator=user_creator(self.user.id),
            title="Investigation",
            project_ids=[],
            filters={},
        )

        updated = update_notebook_row(
            notebook=notebook,
            expected_version=notebook.version,
            fields={"title": "Renamed", "filters": {"environment": ["prod"]}},
            project_ids=None,
        )

        assert updated.title == "Renamed"
        assert updated.filters == {"environment": ["prod"]}
