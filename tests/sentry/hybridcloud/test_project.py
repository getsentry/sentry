from datetime import datetime, timezone

import pytest

from sentry.constants import PROJECT_SLUG_MAX_LENGTH
from sentry.models.project import Project
from sentry.projects.services.project.service import project_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all

from .test_organization import assert_project_equals


@django_db_all(transaction=True)
def test_get_or_create_project() -> None:
    org = Factories.create_organization()
    user = Factories.create_user(email="test@sentry.io")
    team = Factories.create_team(org)

    project_service.get_or_create_project_for_organization(
        organization_id=org.id,
        project_name="test-project",
        platform="java",
        user_id=user.id,
        add_org_default_team=True,
    )
    project = Project.objects.get(name="test-project")
    assert project.platform == "java"
    assert project.teams.filter(id=team.id).exists()
    assert Project.objects.all().count() == 1

    project_service.get_or_create_project_for_organization(
        organization_id=org.id,
        project_name="test-project",
        platform="java",
        user_id=user.id,
        add_org_default_team=True,
    )
    assert Project.objects.all().count() == 1


@django_db_all(transaction=True)
def test_get_by_id() -> None:
    org = Factories.create_organization()
    proj = Factories.create_project(
        organization=org, name="test-project", platform="python", first_event=None
    )
    rpc_proj = project_service.get_by_id(organization_id=org.id, id=proj.id)
    assert rpc_proj is not None

    assert_project_equals(proj, rpc_proj)

    proj.first_event = datetime.now(tz=timezone.utc)
    proj.save()

    rpc_proj = project_service.get_by_id(organization_id=org.id, id=proj.id)
    assert rpc_proj is not None

    assert_project_equals(proj, rpc_proj)


@django_db_all(transaction=True)
def test_update_project() -> None:
    org = Factories.create_organization()
    Factories.create_user(email="test@sentry.io")
    Factories.create_team(org)
    project = Factories.create_project(organization=org, name="test-project", platform="python")

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"platform": "java"},
    )
    project = Project.objects.get(id=project.id)
    assert project.platform == "java"

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"platform": None},
    )
    project = Project.objects.get(id=project.id)
    assert project.platform is None

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"slug": "test-project-slug"},
    )
    project = Project.objects.get(id=project.id)
    assert project.slug == "test-project-slug"

    with pytest.raises(Exception):
        project_service.update_project(
            organization_id=org.id,
            project_id=project.id,
            attrs={"slug": "Invalid Slug Here"},
        )

    with pytest.raises(Exception):
        project_service.update_project(
            organization_id=org.id,
            project_id=project.id,
            attrs={"slug": "x" * (PROJECT_SLUG_MAX_LENGTH + 1)},
        )

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"name": "New Name"},
    )
    project = Project.objects.get(id=project.id)
    assert project.name == "New Name"

    with pytest.raises(Exception):
        project_service.update_project(
            organization_id=org.id,
            project_id=project.id,
            attrs={"name": "X" * 201},
        )

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"external_id": "abcde"},
    )
    project = Project.objects.get(id=project.id)
    assert project.external_id == "abcde"

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"external_id": None},
    )
    project = Project.objects.get(id=project.id)
    assert project.external_id is None

    # assert that we don't fail on non-existent fields
    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"does_not_exist": "test"},
    )

    # assert that we cannot change any fields not in the serializer
    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        attrs={"status": 99},
    )
    project = Project.objects.get(id=project.id)
    assert project.status != 99


@django_db_all(transaction=True)
def test_delete_project_happy_path() -> None:
    """Soft-delete: status flips to PENDING_DELETION, slug is renamed so
    the original can be reused, and a CellScheduledDeletion is queued.
    """
    from sentry.constants import ObjectStatus
    from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion

    org = Factories.create_organization()
    project = Factories.create_project(organization=org, slug="my-proj")
    original_slug = project.slug

    result = project_service.delete_project(organization_id=org.id, project_id=project.id)

    assert result is True
    project.refresh_from_db()
    assert project.status == ObjectStatus.PENDING_DELETION
    # rename_on_pending_deletion() replaces the slug with a random token
    # so the original slug can be reused by a new project before the
    # 30-day retention elapses. Concrete format is an implementation
    # detail; assert only that the original slug is no longer in use.
    assert project.slug != original_slug
    # Scheduled deletion is queued for the deletion task.
    assert CellScheduledDeletion.objects.filter(
        app_label="sentry", model_name="Project", object_id=project.id
    ).exists()
    # The freed slug must actually be available for reuse.
    reused = Factories.create_project(organization=org, slug=original_slug)
    assert reused.slug == original_slug


@django_db_all(transaction=True)
def test_delete_project_missing_returns_false() -> None:
    org = Factories.create_organization()
    result = project_service.delete_project(organization_id=org.id, project_id=999_999_999)
    assert result is False


@django_db_all(transaction=True)
def test_delete_project_wrong_org_returns_false() -> None:
    """A malformed or stolen project_id can't be used to delete a project
    belonging to a different org."""
    from sentry.constants import ObjectStatus

    org_a = Factories.create_organization()
    org_b = Factories.create_organization()
    project = Factories.create_project(organization=org_a)

    result = project_service.delete_project(organization_id=org_b.id, project_id=project.id)

    assert result is False
    project.refresh_from_db()
    assert project.status == ObjectStatus.ACTIVE


@django_db_all(transaction=True)
def test_delete_project_idempotent_on_second_call() -> None:
    """Calling delete_project twice on the same project must not schedule
    a second deletion; the atomic ACTIVE→PENDING_DELETION update is the
    race guard."""
    from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion

    org = Factories.create_organization()
    project = Factories.create_project(organization=org)

    first = project_service.delete_project(organization_id=org.id, project_id=project.id)
    second = project_service.delete_project(organization_id=org.id, project_id=project.id)

    assert first is True
    assert second is True
    schedules = CellScheduledDeletion.objects.filter(
        app_label="sentry", model_name="Project", object_id=project.id
    )
    assert schedules.count() == 1


@django_db_all(transaction=True)
def test_delete_project_rolls_back_on_failure() -> None:
    """If ``rename_on_pending_deletion`` or ``CellScheduledDeletion.schedule``
    raises, the status update must roll back so a retry can succeed.
    Without the transaction wrapper the row would be stuck in
    PENDING_DELETION with no scheduled deletion -- a replay would find
    status != ACTIVE and skip the whole block, orphaning the project."""
    from unittest import mock

    from sentry.constants import ObjectStatus

    org = Factories.create_organization()
    project = Factories.create_project(organization=org)

    with mock.patch.object(
        Project,
        "rename_on_pending_deletion",
        side_effect=RuntimeError("simulated downstream failure"),
    ):
        with pytest.raises(RuntimeError):
            project_service.delete_project(organization_id=org.id, project_id=project.id)

    # The transaction must have rolled back the status update; the
    # project is still ACTIVE and a retry can succeed.
    project.refresh_from_db()
    assert project.status == ObjectStatus.ACTIVE
