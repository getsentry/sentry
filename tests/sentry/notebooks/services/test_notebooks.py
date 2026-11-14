from __future__ import annotations

import pytest
from django.db import IntegrityError, close_old_connections, router, transaction

from sentry.api.helpers.creator import CreatorReference
from sentry.notebooks.models import Notebook, NotebookProject, NotebookSourceType, NotebookStatus
from sentry.notebooks.services.notebooks import (
    NotebookSourceNotFound,
    NotebookValidationError,
    create_manual_notebook,
    create_notebook,
    default_notebook_title,
    get_or_create_source_notebook,
    lock_notebook,
    update_notebook_row,
)
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


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


class GetOrCreateSourceNotebookTest(TestCase):
    source_key = "example_issue:1"

    def create_revision(self, revision: int, title: str = "Revision") -> Notebook:
        return create_notebook(
            organization=self.organization,
            created_by_id=self.user.id,
            created_by_service_account_id=None,
            title=title,
            source_type="example_issue",
            source_key=self.source_key,
            source={"issueId": 1},
            source_revision=revision,
            filters={},
            project_ids=[],
        )

    def test_returns_the_active_notebook(self) -> None:
        active = self.create_revision(1)
        revisions: list[int] = []

        def create(revision: int) -> Notebook:
            revisions.append(revision)
            return self.create_revision(revision)

        notebook, created = get_or_create_source_notebook(
            organization=self.organization, source_key=self.source_key, create=create
        )

        assert (notebook, created) == (active, False)
        assert revisions == []

    def test_creates_the_next_revision_after_an_archived_one(self) -> None:
        self.create_revision(1)
        Notebook.objects.filter(source_key=self.source_key).update(status=NotebookStatus.ARCHIVED)

        notebook, created = get_or_create_source_notebook(
            organization=self.organization, source_key=self.source_key, create=self.create_revision
        )

        assert created is True
        assert notebook.source_revision == 2

    def test_creates_the_first_revision(self) -> None:
        notebook, created = get_or_create_source_notebook(
            organization=self.organization, source_key=self.source_key, create=self.create_revision
        )

        assert created is True
        assert notebook.source_revision == 1

    def test_retries_after_a_create_that_fails_without_its_own_savepoint(self) -> None:
        self.create_revision(1)
        Notebook.objects.filter(source_key=self.source_key).update(status=NotebookStatus.ARCHIVED)
        revisions: list[int] = []

        def create(revision: int) -> Notebook:
            revisions.append(revision)
            # The first insert reuses the archived revision and conflicts.
            return Notebook.objects.create(
                organization=self.organization,
                title="Bare",
                source_type="example_issue",
                source_key=self.source_key,
                source={"issueId": 1},
                source_revision=revision if len(revisions) > 1 else 1,
            )

        notebook, created = get_or_create_source_notebook(
            organization=self.organization, source_key=self.source_key, create=create
        )

        assert created is True
        assert notebook.source_revision == 2
        assert revisions == [2, 2]

    def test_raises_when_every_attempt_conflicts_without_an_active_notebook(self) -> None:
        def create(revision: int) -> Notebook:
            # An archived row at this revision still holds the revision's unique key.
            winner = self.create_revision(revision, title="Archived")
            winner.update(status=NotebookStatus.ARCHIVED)
            return self.create_revision(revision, title="Loser")

        with pytest.raises(IntegrityError):
            get_or_create_source_notebook(
                organization=self.organization, source_key=self.source_key, create=create
            )


class ConcurrentSourceNotebookTest(TransactionTestCase):
    source_key = "example_issue:1"

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()

    def create_revision(self, revision: int, title: str) -> Notebook:
        return Notebook.objects.create(
            organization=self.org,
            title=title,
            source_type="example_issue",
            source_key=self.source_key,
            source={"issueId": 1},
            source_revision=revision,
        )

    def test_a_concurrent_create_wins_inside_an_outer_transaction(self) -> None:
        winners: list[Notebook] = []

        def commit_winner(revision: int) -> None:
            close_old_connections()
            try:
                winners.append(self.create_revision(revision, "Winner"))
            finally:
                close_old_connections()

        def create(revision: int) -> Notebook:
            # Another launch commits its revision between our lookup and our insert.
            if not winners:
                with ContextPropagatingThreadPoolExecutor(max_workers=1) as executor:
                    executor.submit(commit_winner, revision).result(timeout=15)
            return self.create_revision(revision, "Loser")

        with transaction.atomic(using=router.db_for_write(Notebook)):
            notebook, created = get_or_create_source_notebook(
                organization=self.org, source_key=self.source_key, create=create
            )

        assert (notebook, created) == (winners[0], False)
        assert list(
            Notebook.objects.filter(source_key=self.source_key).values_list("title", flat=True)
        ) == ["Winner"]
