import pytest

from sentry.dynamic_sampling.tasks import fetch_projects_with_total_volumes


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
    fetch_projects_with_total_volumes()
