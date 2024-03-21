import pytest

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.user import User
from sentry.tasks.split_discover_dataset import schedule_widget_discover_split
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.on_demand import create_widget
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def owner() -> None:
    return Factories.create_user()


@pytest.fixture
def organization(owner: User) -> None:
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization: Organization) -> None:
    return Factories.create_project(organization=organization)


@django_db_all
def test_schedule_split_discover_dataset(
    project: Project,
):
    _, __, dashboard = create_widget(
        ["count()"], "transaction.duration:>=1", project, columns=["foo"], id=1
    )

    schedule_widget_discover_split()
