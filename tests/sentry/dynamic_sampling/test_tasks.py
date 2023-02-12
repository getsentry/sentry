from collections import defaultdict

import pytest

from sentry.dynamic_sampling.tasks import fetch_projects_with_total_volumes


@pytest.mark.django_db
def test_simple_no_data(default_project):
    _ = [
        {
            "org_id": [default_project.organization.id],
            "project_id": [default_project.id],
        },
    ]
    project_volumes_total = fetch_projects_with_total_volumes()

    assert project_volumes_total == defaultdict(list)
