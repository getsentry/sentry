import pytest

from sentry.constants import PROJECT_SLUG_MAX_LENGTH
from sentry.models.project import Project
from sentry.projects.services.project.service import project_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


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
