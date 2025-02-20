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
def test_update_name() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)

    project_service.update_external_id(
        organization_id=org.id,
        id=project.id,
        name="new-name",
    )

    project_model = Project.objects.get(id=project.id)
    assert project_model.external_id == "new-name"


@django_db_all(transaction=True)
def test_update_external_id() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)

    project_service.update_external_id(
        organization_id=org.id,
        id=project.id,
        external_id="test-external-id",
    )

    project_model = Project.objects.get(id=project.id)
    assert project_model.external_id == "test-external-id"

    project_service.update_external_id(
        organization_id=org.id,
        id=project.id,
        external_id=None,
    )

    project_model = Project.objects.get(id=project.id)
    assert project_model.external_id is None
