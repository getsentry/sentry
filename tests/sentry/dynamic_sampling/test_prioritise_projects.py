import pytest

from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.testutils.factories import Factories
from sentry.utils.snuba import SnubaError


@pytest.mark.django_db
def test_prioritize_projects():
    organization = Factories.create_organization(name="test-org")
    Factories.create_project(organization=organization)
    # TODO (andrii): remove it when snuba PR is ready
    # https://github.com/getsentry/snuba/pull/3708
    with pytest.raises(SnubaError):
        fetch_projects_with_total_volumes()
