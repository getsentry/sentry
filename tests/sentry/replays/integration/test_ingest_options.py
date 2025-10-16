from sentry.models.options.project_option import ProjectOption
from sentry.replays.usecases.ingest.event_logger import (
    _should_report_hydration_error_issue,
    _should_report_rage_click_issue,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_should_report_hydration_error_issue_no_value(default_project):
    result = _should_report_hydration_error_issue(default_project.id)
    assert result is False


@django_db_all
def test_should_report_hydration_error_issue(default_project):
    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_hydration_error_issues", value=True
    )

    result = _should_report_hydration_error_issue(default_project.id)
    assert result is True


@django_db_all
def test_should_report_hydration_error_issue_no_project():
    result = _should_report_hydration_error_issue(210492104914)
    assert result is False


@django_db_all
def test_should_report_rage_click_issue_no_value(default_project):
    result = _should_report_rage_click_issue(default_project.id)
    assert result is False


@django_db_all
def test_should_report_rage_click_issue_no_project():
    result = _should_report_rage_click_issue(210492104914)
    assert result is False


@django_db_all
def test_should_report_rage_click_issue(default_project):
    ProjectOption.objects.set_value(
        project=default_project, key="sentry:replay_rage_click_issues", value=True
    )

    result = _should_report_rage_click_issue(default_project.id)
    assert result is True
