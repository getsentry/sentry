import time

import pytest
from django.conf import settings

from sentry import options
from sentry.replays.usecases.ingest.slow_click import report_slow_click_issue


@pytest.mark.django_db
def test_report_slow_click_issue_a_tag():
    settings.SENTRY_REPLAYS_DEAD_CLICK_ISSUE_ALLOWLIST = [1]
    options.set("replay.issues.slow_click", True)

    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "a"}, "endReason": "timeout"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_slow_click_issue(org_id=1, project_id=1, replay_id="", event=event)
    assert reported is True


@pytest.mark.django_db
def test_report_slow_click_issue_other_tag():
    options.set("replay.issues.slow_click", True)

    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "div"}, "endReason": "timeout"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_slow_click_issue(org_id=1, project_id=1, replay_id="", event=event)
    assert reported is False


@pytest.mark.django_db
def test_report_slow_click_issue_mutation_reason():
    options.set("replay.issues.slow_click", True)

    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "a"}, "endReason": "mutation"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_slow_click_issue(org_id=1, project_id=1, replay_id="", event=event)
    assert reported is False


@pytest.mark.django_db
def test_report_slow_click_issue_disabled_option():
    options.set("replay.issues.slow_click", False)

    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "a"}, "endReason": "timeout"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_slow_click_issue(org_id=1, project_id=1, replay_id="", event=event)
    assert reported is False


@pytest.mark.django_db
def test_report_slow_click_issue_missing_allowlist_entry():
    settings.SENTRY_REPLAYS_DEAD_CLICK_ISSUE_ALLOWLIST = []
    options.set("replay.issues.slow_click", True)

    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "a"}, "endReason": "timeout"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_slow_click_issue(org_id=1, project_id=1, replay_id="", event=event)
    assert reported is False
