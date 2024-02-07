import time
from datetime import datetime, timedelta
from typing import cast
from unittest.mock import patch

import pytest
import requests
from django.conf import settings

from sentry.issues.issue_occurrence import IssueEvidence
from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.ingest.issue_creation import report_rage_click_issue
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@pytest.mark.snuba
@django_db_all
@patch("sentry.replays.usecases.ingest.issue_creation.new_issue_occurrence")
def test_report_rage_click_issue_a_tag(mock_new_issue_occurrence, default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    seq2_timestamp = datetime.now() - timedelta(minutes=10, seconds=35)
    response = requests.post(
        settings.SENTRY_SNUBA + "/tests/entities/replays/insert",
        json=[
            mock_replay(
                seq1_timestamp,
                default_project.id,
                replay_id,
                segment_id=0,
                urls=[
                    "http://localhost/",
                    "http://localhost/home/",
                    "http://localhost/profile/",
                ],
            ),
            mock_replay(seq2_timestamp, default_project.id, replay_id, segment_id=1),
        ],
    )
    assert response.status_code == 200

    event = {
        "data": {
            "payload": {
                "data": {
                    "node": {"tagName": "a"},
                    "endReason": "timeout",
                    "url": "https://www.sentry.io",
                },
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    report_rage_click_issue(
        project_id=default_project.id, replay_id=replay_id, event=cast(SentryEvent, event)
    )
    issue_occurence_call = mock_new_issue_occurrence.call_args[1]
    assert issue_occurence_call["culprit"] == "https://www.sentry.io"
    assert issue_occurence_call["environment"] == "production"
    assert issue_occurence_call["fingerprint"] == ["div.xyz > a"]
    assert issue_occurence_call["issue_type"].type_id == 5002
    assert issue_occurence_call["level"] == "warning"
    assert issue_occurence_call["platform"] == "javascript"
    assert issue_occurence_call["project_id"] == default_project.id
    assert issue_occurence_call["subtitle"] == "div.xyz > a"
    assert issue_occurence_call["title"] == "Suspected Rage Click"
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
    assert (
        issue_occurence_call["evidence_display"][2].to_dict()
        == IssueEvidence(name="Page URL", value="https://www.sentry.io", important=True).to_dict()
    )

    assert issue_occurence_call["extra_event_data"] == {
        "contexts": {"replay": {"replay_id": "b58a67446c914f44a4e329763420047b"}},
        "level": "warning",
        "tags": {"replayId": "b58a67446c914f44a4e329763420047b", "url": "https://www.sentry.io"},
        "user": {
            "id": "123",
            "username": "username",
            "email": "username@example.com",
            "ip": "127.0.0.1",
        },
    }
