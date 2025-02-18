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
        updates={"platform": "java"},
    )
    project = Project.objects.get(id=project.id)
    assert project.platform == "java"

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        updates={"slug": "test-project-slug"},
    )
    project = Project.objects.get(id=project.id)
    assert project.slug == "test-project-slug"

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        updates={"name": "New Name"},
    )
    project = Project.objects.get(id=project.id)
    assert project.name == "New Name"

    project_service.update_project(
        organization_id=org.id,
        project_id=project.id,
        updates={"external_id": "abcde"},
    )
    project = Project.objects.get(id=project.id)
    assert project.external_id == "abcde"

    import pytest

    with pytest.raises(Exception):
        project_service.update_project(
            organization_id=org.id,
            project_id=project.id,
            updates={"does_not_exist": "test"},
        )
        project = Project.objects.get(id=project.id)
        assert project.external_id == "abcde"
