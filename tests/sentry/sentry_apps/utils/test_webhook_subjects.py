from unittest import mock

from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.utils import webhook_subjects
from sentry.sentry_apps.utils.webhook_subjects import SubjectSpec, extract_webhook_subject
from sentry.sentry_apps.utils.webhooks import SentryAppResourceType

# sentry_apps.py `_process_resource_change` -> `_webhook_event_data` (Event.as_dict()).
ERROR_CREATED_PAYLOAD = {
    "error": {
        "event_id": "9b3d8a3b2a5f4b1c8e6d0a1f2c3b4a5e",
        "project": 42,
        "release": "backend@1.0.0",
        "platform": "python",
        "datetime": "2023-08-27T18:24:00.123456+00:00",
        "tags": [["level", "error"], ["environment", "production"]],
        "environment": "production",
        "level": "error",
        "culprit": "sentry.tasks.foo.run",
        "title": "ValueError: bad value",
        "web_url": (
            "https://sentry.io/organizations/my-org/issues/123456/events/"
            "9b3d8a3b2a5f4b1c8e6d0a1f2c3b4a5e/"
        ),
        "issue_id": "123456",
    }
}

# sentry_apps.py `send_alert_webhook_v2` (event context + triggered rule).
EVENT_ALERT_TRIGGERED_PAYLOAD = {
    "event": {
        "event_id": "abc1230000000000000000000000abcd",
        "project": 42,
        "release": None,
        "platform": "python",
        "datetime": "2023-08-27T18:24:00+00:00",
        "tags": [["level", "error"]],
        "title": "ValueError: bad value",
        "issue_id": "123456",
    },
    "triggered_rule": "My alert rule",
    "issue_alert": {
        "id": 7,
        "title": "My alert rule",
        "sentry_app_id": 5,
        "settings": [{"name": "channel", "value": "#alerts"}],
    },
}

# sentry_apps.py `_webhook_issue_data` (urls prepended to a serialized Group).
ISSUE_CREATED_PAYLOAD = {
    "issue": {
        "url": "https://sentry.io/api/0/organizations/my-org/issues/123456/",
        "web_url": "https://sentry.io/organizations/my-org/issues/123456/",
        "project_url": "https://sentry.io/organizations/my-org/projects/my-proj/",
        "id": "123456",
        "shortId": "MY-PROJ-1",
        "title": "ValueError: bad value",
        "culprit": "sentry.tasks.foo.run",
        "level": "error",
        "status": "unresolved",
        "isPublic": False,
        "platform": "python",
        "project": {"id": "42", "name": "my-proj", "slug": "my-proj"},
        "type": "error",
        "metadata": {"type": "ValueError", "value": "bad value"},
        "count": "5",
        "userCount": 2,
        "firstSeen": "2023-08-27T18:00:00Z",
        "lastSeen": "2023-08-27T18:24:00Z",
    }
}

# sentry_apps.py `build_comment_webhook` (Activity id is top-level comment_id).
COMMENT_CREATED_PAYLOAD = {
    "comment_id": 3405,
    "issue_id": 123456,
    "project_slug": "my-proj",
    "timestamp": "2023-08-27T18:24:00.000000+00:00",
    "comment": "hello world",
}

# notify_event_service.py `build_incident_attachment` (snake_cased Incident).
METRIC_ALERT_CRITICAL_PAYLOAD = {
    "metric_alert": {
        "id": "1",
        "identifier": "1",
        "organization_id": "12345",
        "projects": ["my-proj"],
        "alert_rule": {
            "id": "7",
            "name": "My Metric Alert",
            "organization_id": "12345",
            "status": 0,
            "aggregate": "count()",
            "time_window": 60,
            "threshold_type": 0,
            "triggers": [{"id": "1", "label": "critical", "alert_threshold": 100.0}],
            "date_created": "2023-08-27T17:00:00Z",
            "detection_type": "static",
        },
        "status": 20,
        "status_method": 3,
        "type": 2,
        "title": "My Metric Alert",
        "date_started": "2023-08-27T18:24:00Z",
        "date_closed": None,
    },
    "description_text": "100 events in the last 10 minutes",
    "description_title": "Critical: My Metric Alert",
    "web_url": "https://sentry.io/organizations/my-org/alerts/rules/details/7/",
}

# activity_registry/sentry_app.py `ActivityAlertWebhookPayload` (issue + activity + alert).
ACTIVITY_ALERT_TRIGGERED_PAYLOAD = {
    "issue": {
        "url": "https://sentry.io/api/0/organizations/my-org/issues/123456/",
        "web_url": "https://sentry.io/organizations/my-org/issues/123456/",
        "id": "123456",
        "shortId": "MY-PROJ-1",
        "title": "ValueError: bad value",
        "level": "error",
        "status": "unresolved",
        "project": {"id": "42", "slug": "my-proj"},
        "metadata": {"type": "ValueError", "value": "bad value"},
    },
    "activity": {
        "type": "seer_root_cause_completed",
        "details": {"summary": "The crash is caused by a null pointer in foo()."},
    },
    "alert": {
        "id": 88,
        "title": "My Workflow",
        "sentry_app_id": 5,
        "web_url": "https://sentry.io/organizations/my-org/monitors/alerts/88/",
    },
}

# installations.py `SentryAppInstallationNotifier` (serialized SentryAppInstallation).
INSTALLATION_CREATED_PAYLOAD = {
    "installation": {
        "app": {"uuid": "a1b2c3d4-1111-4aaa-8bbb-222233334444", "slug": "my-app", "sentryAppId": 5},
        "organization": {"slug": "my-org", "id": 12345},
        "uuid": "e5f6a7b8-1234-4cde-9012-3456789abcde",
        "status": "installed",
        "code": "f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d",
    }
}

# autofix_agent.py `_handle_step_started_events` (run_id + sentry_run_id + group_id).
SEER_ROOT_CAUSE_STARTED_PAYLOAD = {
    "run_id": 90123,
    "sentry_run_id": "d1e2f3a4-5678-4b9c-8d0e-1f2a3b4c5d6e",
    "group_id": 123456,
}

# size_analysis.py `build_size_analysis_summary` (buildId + app/git info + sizes).
PREPROD_SIZE_ANALYSIS_COMPLETED_PAYLOAD = {
    "buildId": "456",
    "organizationSlug": "my-org",
    "projectSlug": "my-proj",
    "platform": "IOS",
    "state": "COMPLETED",
    "appInfo": {
        "appId": "com.example.app",
        "name": "My App",
        "version": "2.4.1",
        "buildNumber": 42,
        "artifactType": "XCARCHIVE",
    },
    "gitInfo": {
        "headSha": "abc123",
        "baseSha": "def456",
        "provider": "github",
        "headRepoName": "my-org/my-repo",
        "headRef": "feature/x",
        "prNumber": 123,
    },
    "downloadSize": 28311552,
    "installSize": 41943040,
    "analysisDuration": 1.5,
}

_REALISTIC_PAYLOADS = [
    ERROR_CREATED_PAYLOAD,
    EVENT_ALERT_TRIGGERED_PAYLOAD,
    ISSUE_CREATED_PAYLOAD,
    COMMENT_CREATED_PAYLOAD,
    METRIC_ALERT_CRITICAL_PAYLOAD,
    ACTIVITY_ALERT_TRIGGERED_PAYLOAD,
    INSTALLATION_CREATED_PAYLOAD,
    SEER_ROOT_CAUSE_STARTED_PAYLOAD,
    PREPROD_SIZE_ANALYSIS_COMPLETED_PAYLOAD,
]


def test_extracts_subject_per_event_type() -> None:
    assert extract_webhook_subject(
        SentryAppResourceType.ERROR, SentryAppEventType.ERROR_CREATED, ERROR_CREATED_PAYLOAD
    ) == ("9b3d8a3b2a5f4b1c8e6d0a1f2c3b4a5e", "event")
    assert extract_webhook_subject(
        SentryAppResourceType.EVENT_ALERT,
        SentryAppEventType.EVENT_ALERT_TRIGGERED,
        EVENT_ALERT_TRIGGERED_PAYLOAD,
    ) == ("abc1230000000000000000000000abcd", "event")
    assert extract_webhook_subject(
        SentryAppResourceType.ISSUE, SentryAppEventType.ISSUE_CREATED, ISSUE_CREATED_PAYLOAD
    ) == ("123456", "group")
    # activity_alert payloads carry the triggering issue too.
    assert extract_webhook_subject(
        SentryAppResourceType.ACTIVITY_ALERT,
        SentryAppEventType.ACTIVITY_ALERT_TRIGGERED,
        ACTIVITY_ALERT_TRIGGERED_PAYLOAD,
    ) == ("123456", "group")
    assert extract_webhook_subject(
        SentryAppResourceType.COMMENT, SentryAppEventType.COMMENT_CREATED, COMMENT_CREATED_PAYLOAD
    ) == ("3405", "comment")
    # Keyed on the alert rule (still the source of truth), not the transient incident id.
    assert extract_webhook_subject(
        SentryAppResourceType.METRIC_ALERT,
        SentryAppEventType.METRIC_ALERT_CRITICAL,
        METRIC_ALERT_CRITICAL_PAYLOAD,
    ) == ("7", "alert_rule")
    assert extract_webhook_subject(
        SentryAppResourceType.INSTALLATION,
        SentryAppEventType.INSTALLATION_CREATED,
        INSTALLATION_CREATED_PAYLOAD,
    ) == ("e5f6a7b8-1234-4cde-9012-3456789abcde", "installation")
    assert extract_webhook_subject(
        SentryAppResourceType.SEER,
        SentryAppEventType.SEER_ROOT_CAUSE_STARTED,
        SEER_ROOT_CAUSE_STARTED_PAYLOAD,
    ) == ("90123", "autofix_run")
    assert extract_webhook_subject(
        SentryAppResourceType.PREPROD_ARTIFACT,
        SentryAppEventType.PREPROD_ARTIFACT_SIZE_ANALYSIS_COMPLETED,
        PREPROD_SIZE_ANALYSIS_COMPLETED_PAYLOAD,
    ) == ("456", "preprod_artifact")


def test_seer_falls_back_to_sentry_run_id() -> None:
    # Defensive fallback: if run_id is absent, sentry_run_id is used.
    assert extract_webhook_subject(
        SentryAppResourceType.SEER,
        SentryAppEventType.SEER_CODING_COMPLETED,
        {
            "run_id": None,
            "sentry_run_id": "d1e2f3a4-5678-4b9c-8d0e-1f2a3b4c5d6e",
            "group_id": 123456,
        },
    ) == ("d1e2f3a4-5678-4b9c-8d0e-1f2a3b4c5d6e", "autofix_run")


def test_returns_null_when_no_stable_id() -> None:
    # comment with no note id (payload built with .get()).
    assert extract_webhook_subject(
        SentryAppResourceType.COMMENT,
        SentryAppEventType.COMMENT_CREATED,
        {"comment_id": None, "issue_id": 123456, "project_slug": "my-proj"},
    ) == (None, None)
    # external Seer RPC payload (Seer-service-defined) without a run_id.
    assert extract_webhook_subject(
        SentryAppResourceType.SEER,
        SentryAppEventType.SEER_CODING_COMPLETED,
        {"group_id": 123456},
    ) == (None, None)
    # caller-defined activity_alert payload lacking an issue.
    assert extract_webhook_subject(
        SentryAppResourceType.ACTIVITY_ALERT,
        SentryAppEventType.ACTIVITY_ALERT_TRIGGERED,
        {"activity": {"type": "status_resolved", "details": {}}, "alert": {"id": 88}},
    ) == (None, None)


def test_malformed_payload_does_not_raise() -> None:
    assert extract_webhook_subject(
        SentryAppResourceType.ERROR,
        SentryAppEventType.ERROR_CREATED,
        {"error": "nope"},
    ) == (None, None)
    assert extract_webhook_subject(
        SentryAppResourceType.ISSUE,
        SentryAppEventType.ISSUE_CREATED,
        {},
    ) == (None, None)


def test_event_type_override_takes_precedence_over_resource() -> None:
    override = {SentryAppEventType.ISSUE_ASSIGNED: SubjectSpec("custom", [("custom_id",)])}
    with mock.patch.dict(webhook_subjects._SUBJECT_BY_EVENT_TYPE, override):
        # issue.assigned matches the override...
        assert extract_webhook_subject(
            SentryAppResourceType.ISSUE,
            SentryAppEventType.ISSUE_ASSIGNED,
            {"custom_id": "x", "issue": {"id": "1"}},
        ) == ("x", "custom")
        # ...while other issue.* actions still use the resource default.
        assert extract_webhook_subject(
            SentryAppResourceType.ISSUE,
            SentryAppEventType.ISSUE_CREATED,
            {"issue": {"id": "1"}},
        ) == ("1", "group")
