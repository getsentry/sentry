from typing import int
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.replays.usecases.ingest.event_logger import (
    _should_report_hydration_error_issue,
    _should_report_rage_click_issue,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_should_report_hydration_error_issue_no_value(default_project: Project) -> None:
    result = _should_report_hydration_error_issue(
        default_project.id, {"options_cache": None, "has_sent_replays_cache": None}
    )
    assert result is True


@django_db_all
def test_should_report_hydration_error_issue(default_project: Project) -> None:
    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_hydration_error_issues", value=True
    )

    result = _should_report_hydration_error_issue(
        default_project.id, {"options_cache": None, "has_sent_replays_cache": None}
    )
    assert result is True


@django_db_all
def test_should_report_hydration_error_issue_no_project() -> None:
    result = _should_report_hydration_error_issue(
        210492104914, {"options_cache": None, "has_sent_replays_cache": None}
    )
    assert result is True


@django_db_all
def test_should_report_rage_click_issue_no_value(default_project: Project) -> None:
    result = _should_report_rage_click_issue(
        default_project.id, {"options_cache": None, "has_sent_replays_cache": None}
    )
    assert result is True


@django_db_all
def test_should_report_rage_click_issue_no_project() -> None:
    result = _should_report_rage_click_issue(
        210492104914, {"options_cache": None, "has_sent_replays_cache": None}
    )
    assert result is True


@django_db_all
def test_should_report_rage_click_issue(default_project: Project) -> None:
    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_rage_click_issues", value=True
    )

    result = _should_report_rage_click_issue(
        default_project.id, {"options_cache": None, "has_sent_replays_cache": None}
    )
    assert result is True
