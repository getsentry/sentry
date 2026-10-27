import pytest
from django.urls import resolve


@pytest.mark.parametrize(
    "path",
    [
        "/api/0/organizations/org-slug/alert-rules/",
        "/api/0/organizations/org-slug/alert-rules/available-actions/",
        "/api/0/organizations/org-slug/alert-rules/1/",
        "/api/0/organizations/org-slug/combined-rules/",
        "/api/0/organizations/org-slug/ondemand-rules-stats/",
        "/api/0/organizations/org-slug/incidents/",
        "/api/0/organizations/org-slug/incidents/1/",
        "/api/0/projects/org-slug/project-slug/alert-rules/",
        "/api/0/projects/org-slug/project-slug/alert-rules/1/",
        "/api/0/projects/org-slug/project-slug/alert-rules/1/snooze/",
        "/api/0/projects/org-slug/project-slug/alert-rule-task/task-id/",
        "/api/0/projects/org-slug/project-slug/rules/",
        "/api/0/projects/org-slug/project-slug/rules/configuration/",
        "/api/0/projects/org-slug/project-slug/rules/1/",
        "/api/0/projects/org-slug/project-slug/rules/1/enable/",
        "/api/0/projects/org-slug/project-slug/rules/1/snooze/",
        "/api/0/projects/org-slug/project-slug/rules/preview/",
        "/api/0/projects/org-slug/project-slug/rule-actions/",
        "/api/0/projects/org-slug/project-slug/rule-task/task-id/",
    ],
)
def test_deprecated_alert_endpoint_removed(path: str) -> None:
    assert resolve(path).url_name == "sentry-api-catchall"
