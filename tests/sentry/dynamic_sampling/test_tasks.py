import pytest

from sentry.dynamic_sampling.tasks import fetch_projects_with_total_volumes
from sentry.utils.snuba import SnubaError


@pytest.mark.django_db
def test_simple(default_project):
    test_data = [
        {
            "org_id": [default_project.organization.id],
            "project_id": [default_project.id],
        },
    ]
    assert 1 == 1
    _ = test_data
    # TODO (andrii): remove it when snuba PR is ready
    # https://github.com/getsentry/snuba/pull/3708
    with pytest.raises(SnubaError):
        fetch_projects_with_total_volumes()
