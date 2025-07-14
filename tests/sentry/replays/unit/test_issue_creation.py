from unittest.mock import patch

from sentry.issues.grouptype import ReplayHydrationErrorType, ReplayRageClickType
from sentry.replays.testutils import mock_replay_event
from sentry.replays.usecases.ingest.issue_creation import (
    _make_clicked_element,
    report_hydration_error_issue_with_replay_event,
    report_rage_click_issue_with_replay_event,
)


@patch("sentry.replays.usecases.issue.produce_occurrence_to_kafka")
def test_report_hydration_error(produce_occurrence_to_kafka):
    replay_event = mock_replay_event()

    report_hydration_error_issue_with_replay_event(
        project_id=1,
        replay_id="1",
        timestamp=1.0,
        url="https://sentry.io/",
        replay_event=replay_event,
    )

    assert produce_occurrence_to_kafka.called

    event_data = produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]
    assert event_data == {
        "id": event_data["id"],
        "environment": "production",
        "platform": "javascript",
        "project_id": 1,
        "received": "1970-01-01T00:00:01+00:00",
        "tags": {"replayId": "1", "url": "https://sentry.io/", "transaction": "Title"},
        "timestamp": "1970-01-01T00:00:01+00:00",
        "contexts": {
            "replay": {"replay_id": "1"},
            "trace": {"trace_id": "4491657243ba4dbebd2f6bd62b733080"},
            "os": {"name": "iOS", "version": "16.2"},
            "browser": {"name": "Chrome", "version": "103.0.38"},
            "device": {
                "name": "iPhone 13 Pro",
                "brand": "Apple",
                "family": "iPhone",
                "model": "13 Pro",
            },
        },
        "level": "error",
        "user": {
            "id": "1",
            "username": "username",
            "email": "test@test.com",
            "ip_address": "127.0.0.1",
        },
        "release": "version@1.3",
        "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
        "dist": "abc123",
        "event_id": event_data["event_id"],
    }

    occurrence = produce_occurrence_to_kafka.call_args_list[0][1]["occurrence"]
    assert occurrence.project_id == 1
    assert occurrence.fingerprint == ["1"]
    assert occurrence.issue_title == "Hydration Error"
    assert (
        occurrence.subtitle
        == "Hydration failed - the server rendered HTML didn't match the client."
    )
    assert occurrence.evidence_data == {}
    assert occurrence.evidence_display == []
    assert occurrence.type == ReplayHydrationErrorType
    assert occurrence.level == "error"
    assert occurrence.culprit == "https://sentry.io/"
    assert occurrence.resource_id is None
    assert occurrence.priority is None
    assert occurrence.assignee is None
    assert occurrence.initial_issue_priority is None


@patch("sentry.replays.usecases.issue.produce_occurrence_to_kafka")
def test_report_hydration_error_no_url(produce_occurrence_to_kafka):
    replay_event = mock_replay_event()

    report_hydration_error_issue_with_replay_event(
        project_id=1,
        replay_id="1",
        timestamp=1.0,
        url=None,
        replay_event=replay_event,
    )

    assert produce_occurrence_to_kafka.called
    assert produce_occurrence_to_kafka.call_args_list[0][1]["occurrence"].culprit == ""


@patch("sentry.replays.usecases.issue.produce_occurrence_to_kafka")
def test_report_rage_click_issue(produce_occurrence_to_kafka):
    replay_event = mock_replay_event()

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
            "data-sentry-component": "SmartSearchBar",
        },
    }

    report_rage_click_issue_with_replay_event(
        project_id=1,
        replay_id="1",
        selector="div.xyz > SmartSearchBar",
        timestamp=1.0,
        url="https://www.sentry.io",
        node=node,
        component_name="SmartSearchBar",
        replay_event=replay_event,
    )

    assert produce_occurrence_to_kafka.called

    event_data = produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]
    assert event_data == {
        "id": event_data["id"],
        "environment": "production",
        "platform": "javascript",
        "project_id": 1,
        "received": "1970-01-01T00:00:01+00:00",
        "tags": {"replayId": "1", "url": "https://www.sentry.io", "transaction": "Title"},
        "timestamp": "1970-01-01T00:00:01+00:00",
        "contexts": {
            "replay": {"replay_id": "1"},
            "trace": {"trace_id": "4491657243ba4dbebd2f6bd62b733080"},
            "os": {"name": "iOS", "version": "16.2"},
            "browser": {"name": "Chrome", "version": "103.0.38"},
            "device": {
                "name": "iPhone 13 Pro",
                "brand": "Apple",
                "family": "iPhone",
                "model": "13 Pro",
            },
        },
        "level": "error",
        "user": {
            "id": "1",
            "username": "username",
            "email": "test@test.com",
            "ip_address": "127.0.0.1",
        },
        "release": "version@1.3",
        "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
        "dist": "abc123",
        "event_id": event_data["event_id"],
    }

    occurrence = produce_occurrence_to_kafka.call_args_list[0][1]["occurrence"]
    assert occurrence.project_id == 1
    assert occurrence.fingerprint == ["div.xyz > SmartSearchBar"]
    assert occurrence.issue_title == "Rage Click"
    assert occurrence.subtitle == "div.xyz > SmartSearchBar"
    assert occurrence.evidence_data == {
        "node": node,
        "selector": "div.xyz > SmartSearchBar",
        "component_name": "SmartSearchBar",
    }
    assert occurrence.type == ReplayRageClickType
    assert occurrence.level == "error"
    assert occurrence.culprit == "https://www.sentry.io"
    assert occurrence.resource_id is None
    assert occurrence.priority is None
    assert occurrence.assignee is None
    assert occurrence.initial_issue_priority is None

    assert len(occurrence.evidence_display) == 3
    assert occurrence.evidence_display[0].name == "Clicked Element"
    assert occurrence.evidence_display[0].important is False
    assert occurrence.evidence_display[1].name == "Selector Path"
    assert occurrence.evidence_display[1].important is False
    assert occurrence.evidence_display[2].name == "React Component Name"
    assert occurrence.evidence_display[2].important is True


@patch("sentry.replays.usecases.issue.produce_occurrence_to_kafka")
def test_report_rage_click_issue_no_component(produce_occurrence_to_kafka):
    replay_event = mock_replay_event()

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
        },
    }

    report_rage_click_issue_with_replay_event(
        project_id=1,
        replay_id="1",
        selector="div.xyz",
        timestamp=1.0,
        url="https://www.sentry.io",
        node=node,
        component_name=None,
        replay_event=replay_event,
    )

    assert produce_occurrence_to_kafka.called
    occurrence = produce_occurrence_to_kafka.call_args_list[0][1]["occurrence"]
    assert len(occurrence.evidence_display) == 2
    assert occurrence.evidence_display[0].name == "Clicked Element"
    assert occurrence.evidence_display[0].important is False
    assert occurrence.evidence_display[1].name == "Selector Path"
    assert occurrence.evidence_display[1].important is True


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
