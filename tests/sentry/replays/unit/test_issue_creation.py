from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.group import Group
from sentry.replays.testutils import mock_replay_event
from sentry.replays.usecases.ingest.issue_creation import report_rage_click_issue_with_replay_event
from sentry.testutils.helpers.features import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@django_db_all
@patch("sentry.replays.usecases.ingest.issue_creation.new_issue_occurrence")
def test_report_rage_click_issue_with_replay_event(mock_new_issue_occurrence, default_project):
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)

    replay_id = "b58a67446c914f44a4e329763420047b"
    report_rage_click_issue_with_replay_event(
        project_id=default_project.id,
        replay_id=replay_id,
        selector="div.xyz > a",
        timestamp=seq1_timestamp.timestamp(),
        url="https://www.sentry.io",
        node={"tagName": "a"},
        replay_event=mock_replay_event(),
    )
    issue_occurence_call = mock_new_issue_occurrence.call_args[1]
    assert issue_occurence_call["culprit"] == "https://www.sentry.io"
    assert issue_occurence_call["environment"] == "production"
    assert issue_occurence_call["fingerprint"] == ["div.xyz > a"]
    assert issue_occurence_call["issue_type"].type_id == 5002
    assert issue_occurence_call["level"] == "error"
    assert issue_occurence_call["platform"] == "javascript"
    assert issue_occurence_call["project_id"] == default_project.id
    assert issue_occurence_call["subtitle"] == "div.xyz > a"
    assert issue_occurence_call["title"] == "Rage Click"
    assert issue_occurence_call["evidence_data"] == {
        "node": {"tagName": "a"},
        "selector": "div.xyz > a",
    }

    assert (
        issue_occurence_call["evidence_display"][0].to_dict()
        == IssueEvidence(name="Clicked Element", value="a", important=True).to_dict()
    )
    assert (
        issue_occurence_call["evidence_display"][1].to_dict()
        == IssueEvidence(name="Selector Path", value="div.xyz > a", important=True).to_dict()
    )

    assert issue_occurence_call["extra_event_data"] == {
        "contexts": {"replay": {"replay_id": "b58a67446c914f44a4e329763420047b"}},
        "level": "error",
        "tags": {"replayId": "b58a67446c914f44a4e329763420047b", "url": "https://www.sentry.io"},
        "user": {
            "id": "1",
            "email": "test@test.com",
            "ip_address": "127.0.0.1",
            "username": "username",
        },
    }


@pytest.mark.snuba
@django_db_all
def test_report_rage_click_long_url(default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    with Feature(
        {
            "organizations:replay-click-rage-ingest": True,
        }
    ):
        report_rage_click_issue_with_replay_event(
            project_id=default_project.id,
            replay_id=replay_id,
            selector="div.xyz > a",
            timestamp=seq1_timestamp.timestamp(),
            url=f"https://www.sentry.io{'a' * 300}",
            node={"tagName": "a"},
            replay_event=mock_replay_event(),
        )

    # test that the Issue gets created with the truncated url
    assert Group.objects.get(message__contains="div.xyz > a")
    assert Group.objects.get(culprit__contains="www.sentry.io")
