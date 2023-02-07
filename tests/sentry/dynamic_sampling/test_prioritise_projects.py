import pytest

from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.testutils.factories import Factories


@pytest.mark.django_db
def test_prioritize_projects():
    organization = Factories.create_organization(name="test-org")
    Factories.create_project(organization=organization)
    fetch_projects_with_total_volumes()
