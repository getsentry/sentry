import time

import pytest

from sentry.replays.usecases.ingest.click_issue import (
    report_dead_click_issue,
    report_rage_click_issue,
)


@pytest.mark.django_db
def test_report_dead_click_issue_a_tag():
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

    reported = report_dead_click_issue(project_id=1, replay_id="", click_event=event)
    assert reported is True


@pytest.mark.django_db
def test_report_dead_click_issue_other_tag():
    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "div"}, "endReason": "timeout"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_dead_click_issue(project_id=1, replay_id="", click_event=event)
    assert reported is False


@pytest.mark.django_db
def test_report_dead_click_issue_mutation_reason():
    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "a"}, "endReason": "mutation"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_dead_click_issue(project_id=1, replay_id="", click_event=event)
    assert reported is False


@pytest.mark.django_db
def test_report_rage_click_issue():
    event = {
        "data": {
            "payload": {
                "data": {
                    "node": {"tagName": "div"},
                    "url": "https://www.sentry.io",
                },
                "message": "div.xyz > div",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_rage_click_issue(project_id=1, replay_id="", click_event=event)
    assert reported is True
