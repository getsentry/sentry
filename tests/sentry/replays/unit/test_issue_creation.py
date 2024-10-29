from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.issues.grouptype import ReplayHydrationErrorType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.group import Group
from sentry.replays.testutils import mock_replay_event
from sentry.replays.usecases.ingest.issue_creation import (
    _make_clicked_element,
    report_hydration_error_issue_with_replay_event,
    report_rage_click_issue_with_replay_event,
)
from sentry.testutils.helpers.features import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


def test_make_clicked_element():
    node = {
        "tagName": "a",
        "attributes": {
            "id": "id",
            "class": "class1 class2",
            "role": "button",
            "aria-label": "test",
            "alt": "1",
            "data-testid": "2",
            "title": "3",
            "data-sentry-component": "SignUpForm",
        },
    }
    assert (
        _make_clicked_element(node)
        == 'a#id.class1.class2[role="button"][aria="test"][alt="1"][data-test-id="2"][title="3"][data-sentry-component="SignUpForm"]'
    )

    node_whitespace = {
        "tagName": "a",
        "attributes": {
            "id": "id",
            "class": " class1 class2 ",
            "data-sentry-component": "SignUpForm",
        },
    }
    assert (
        _make_clicked_element(node_whitespace)
        == 'a#id.class1.class2[data-sentry-component="SignUpForm"]'
    )


@django_db_all
@patch("sentry.replays.usecases.ingest.issue_creation.new_issue_occurrence")
def test_report_rage_click_issue_with_replay_event(mock_new_issue_occurrence, default_project):
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)

    replay_id = "b58a67446c914f44a4e329763420047b"
    report_rage_click_issue_with_replay_event(
        project_id=default_project.id,
        replay_id=replay_id,
        selector="div.xyz > SmartSearchBar",
        timestamp=seq1_timestamp.timestamp(),
        url="https://www.sentry.io",
        node={
            "tagName": "a",
            "attributes": {
                "id": "id",
                "class": "class1 class2",
                "role": "button",
                "aria-label": "test",
                "alt": "1",
                "data-testid": "2",
                "title": "3",
                "data-sentry-component": "SignUpForm",
            },
        },
        component_name="SmartSearchBar",
        replay_event=mock_replay_event(),
    )
    issue_occurence_call = mock_new_issue_occurrence.call_args[1]
    assert issue_occurence_call["culprit"] == "https://www.sentry.io"
    assert issue_occurence_call["environment"] == "production"
    assert issue_occurence_call["fingerprint"] == ["div.xyz > SmartSearchBar"]
    assert issue_occurence_call["issue_type"].type_id == 5002
    assert issue_occurence_call["level"] == "error"
    assert issue_occurence_call["platform"] == "javascript"
    assert issue_occurence_call["project_id"] == default_project.id
    assert issue_occurence_call["subtitle"] == "div.xyz > SmartSearchBar"
    assert issue_occurence_call["title"] == "Rage Click"
    assert issue_occurence_call["evidence_data"] == {
        "node": {
            "tagName": "a",
            "attributes": {
                "id": "id",
                "class": "class1 class2",
                "role": "button",
                "aria-label": "test",
                "alt": "1",
                "data-testid": "2",
                "title": "3",
                "data-sentry-component": "SignUpForm",
            },
        },
        "selector": "div.xyz > SmartSearchBar",
        "component_name": "SmartSearchBar",
    }

    assert (
        issue_occurence_call["evidence_display"][0].to_dict()
        == IssueEvidence(
            name="Clicked Element",
            value='a#id.class1.class2[role="button"][aria="test"][alt="1"][data-test-id="2"][title="3"][data-sentry-component="SignUpForm"]',
            important=False,
        ).to_dict()
    )
    assert (
        issue_occurence_call["evidence_display"][1].to_dict()
        == IssueEvidence(
            name="Selector Path", value="div.xyz > SmartSearchBar", important=False
        ).to_dict()
    )
    assert (
        issue_occurence_call["evidence_display"][2].to_dict()
        == IssueEvidence(
            name="React Component Name", value="SmartSearchBar", important=True
        ).to_dict()
    )

    assert issue_occurence_call["extra_event_data"] == {
        "contexts": {
            "browser": {"name": "Chrome", "version": "103.0.38"},
            "device": {
                "brand": "Apple",
                "family": "iPhone",
                "model": "13 Pro",
                "name": "iPhone 13 Pro",
            },
            "os": {"name": "iOS", "version": "16.2"},
            "replay": {"replay_id": "b58a67446c914f44a4e329763420047b"},
            "trace": {
                "trace_id": "4491657243ba4dbebd2f6bd62b733080",
            },
        },
        "dist": "abc123",
        "level": "error",
        "release": "version@1.3",
        "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
        "tags": {
            "replayId": "b58a67446c914f44a4e329763420047b",
            "transaction": "Title",
            "url": "https://www.sentry.io",
        },
        "user": {
            "email": "test@test.com",
            "id": "1",
            "ip_address": "127.0.0.1",
            "username": "username",
        },
    }


@pytest.mark.snuba
@django_db_all
def test_report_rage_click_long_url(default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    report_rage_click_issue_with_replay_event(
        project_id=default_project.id,
        replay_id=replay_id,
        selector="div.xyz > a",
        timestamp=seq1_timestamp.timestamp(),
        url=f"https://www.sentry.io{'a' * 300}",
        node={"tagName": "a"},
        component_name="SmartSearchBar",
        replay_event=mock_replay_event(),
    )

    # test that the Issue gets created with the truncated url
    assert Group.objects.get(message__contains="div.xyz > a")
    assert Group.objects.get(culprit__contains="www.sentry.io")


@pytest.mark.snuba
@django_db_all
def test_report_rage_click_no_environment(default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    replay_event = mock_replay_event()
    del replay_event["environment"]
    report_rage_click_issue_with_replay_event(
        project_id=default_project.id,
        replay_id=replay_id,
        selector="div.xyz > a",
        timestamp=seq1_timestamp.timestamp(),
        url="https://www.sentry.io",
        node={"tagName": "a"},
        component_name="SmartSearchBar",
        replay_event=mock_replay_event(),
    )

    assert Group.objects.get(message__contains="div.xyz > a")


@pytest.mark.snuba
@django_db_all
def test_report_rage_click_no_trace(default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    report_rage_click_issue_with_replay_event(
        project_id=default_project.id,
        replay_id=replay_id,
        selector="div.xyz > a",
        timestamp=seq1_timestamp.timestamp(),
        url="https://www.sentry.io",
        node={"tagName": "a"},
        component_name="SmartSearchBar",
        replay_event=mock_replay_event(trace_ids=[]),
    )

    # test that the Issue gets created
    assert Group.objects.get(message__contains="div.xyz > a")


@django_db_all
@patch("sentry.replays.usecases.ingest.issue_creation.new_issue_occurrence")
def test_report_rage_click_no_component_name(mock_new_issue_occurrence, default_project):
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)

    replay_id = "b58a67446c914f44a4e329763420047b"
    report_rage_click_issue_with_replay_event(
        project_id=default_project.id,
        replay_id=replay_id,
        selector="div.xyz > a",
        timestamp=seq1_timestamp.timestamp(),
        url="https://www.sentry.io",
        node={"tagName": "a"},
        component_name=None,
        replay_event=mock_replay_event(),
    )
    issue_occurence_call = mock_new_issue_occurrence.call_args[1]
    assert issue_occurence_call["culprit"] == "https://www.sentry.io"
    assert issue_occurence_call["environment"] == "production"
    assert issue_occurence_call["fingerprint"] == ["div.xyz > a"]

    assert issue_occurence_call["evidence_data"] == {
        "node": {"tagName": "a"},
        "selector": "div.xyz > a",
    }

    assert (
        issue_occurence_call["evidence_display"][0].to_dict()
        == IssueEvidence(name="Clicked Element", value="a", important=False).to_dict()
    )
    assert (
        issue_occurence_call["evidence_display"][1].to_dict()
        == IssueEvidence(name="Selector Path", value="div.xyz > a", important=True).to_dict()
    )


@django_db_all
@patch("sentry.replays.usecases.ingest.issue_creation.new_issue_occurrence")
def test_report_hydration_error_issue_with_replay_event(mock_new_issue_occurrence, default_project):
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)

    replay_id = "b58a67446c914f44a4e329763420047b"
    report_hydration_error_issue_with_replay_event(
        project_id=default_project.id,
        replay_id=replay_id,
        timestamp=seq1_timestamp.timestamp(),
        url="https://www.sentry.io",
        replay_event=mock_replay_event(),
    )
    issue_occurence_call = mock_new_issue_occurrence.call_args[1]
    assert issue_occurence_call["culprit"] == "https://www.sentry.io"
    assert issue_occurence_call["environment"] == "production"
    assert issue_occurence_call["fingerprint"][0] == "1"
    assert issue_occurence_call["issue_type"].type_id == 5003
    assert issue_occurence_call["level"] == "error"
    assert issue_occurence_call["platform"] == "javascript"
    assert issue_occurence_call["project_id"] == default_project.id
    assert issue_occurence_call["title"] == "Hydration Error"

    assert issue_occurence_call["extra_event_data"] == {
        "contexts": {
            "browser": {"name": "Chrome", "version": "103.0.38"},
            "device": {
                "brand": "Apple",
                "family": "iPhone",
                "model": "13 Pro",
                "name": "iPhone 13 Pro",
            },
            "os": {"name": "iOS", "version": "16.2"},
            "replay": {"replay_id": "b58a67446c914f44a4e329763420047b"},
            "trace": {
                "trace_id": "4491657243ba4dbebd2f6bd62b733080",
            },
        },
        "dist": "abc123",
        "level": "error",
        "release": "version@1.3",
        "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
        "tags": {
            "replayId": "b58a67446c914f44a4e329763420047b",
            "transaction": "Title",
            "url": "https://www.sentry.io",
        },
        "user": {
            "email": "test@test.com",
            "id": "1",
            "ip_address": "127.0.0.1",
            "username": "username",
        },
    }


@pytest.mark.snuba
@django_db_all
def test_report_hydration_error_creates_issue(default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    with Feature(
        {
            ReplayHydrationErrorType.build_ingest_feature_name(): True,
        }
    ):
        report_hydration_error_issue_with_replay_event(
            project_id=default_project.id,
            replay_id=replay_id,
            timestamp=seq1_timestamp.timestamp(),
            url="https://www.sentry.io",
            replay_event=mock_replay_event(),
        )

    # test that the Issue gets created
    assert Group.objects.get(message__contains="Hydration Error")


@pytest.mark.snuba
@django_db_all
def test_report_hydration_error_long_url(default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    with Feature(
        {
            ReplayHydrationErrorType.build_ingest_feature_name(): True,
        }
    ):
        report_hydration_error_issue_with_replay_event(
            project_id=default_project.id,
            replay_id=replay_id,
            timestamp=seq1_timestamp.timestamp(),
            url=f"https://www.sentry.io{'a' * 300}",
            replay_event=mock_replay_event(),
        )

    # test that the Issue gets created with the truncated url
    assert Group.objects.get(culprit__contains="www.sentry.io")
    assert Group.objects.get(message__contains="Hydration Error")


@pytest.mark.snuba
@django_db_all
def test_report_hydration_error_no_url(default_project):
    replay_id = "b58a67446c914f44a4e329763420047b"
    seq1_timestamp = datetime.now() - timedelta(minutes=10, seconds=52)
    with Feature(
        {
            ReplayHydrationErrorType.build_ingest_feature_name(): True,
        }
    ):
        report_hydration_error_issue_with_replay_event(
            project_id=default_project.id,
            replay_id=replay_id,
            timestamp=seq1_timestamp.timestamp(),
            url=None,
            replay_event=mock_replay_event(),
        )

    # test that the Issue gets created
    assert Group.objects.get(message__contains="Hydration Error")
