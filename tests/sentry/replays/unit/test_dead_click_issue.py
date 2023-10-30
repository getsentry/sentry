import time

from sentry.replays.usecases.ingest.dead_click import report_dead_click_issue
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@django_db_all
def test_report_dead_click_issue_a_tag():
    project = Factories.create_project(organization=Factories.create_organization())

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

    reported = report_dead_click_issue(project_id=project.id, replay_id="", event=event)
    assert reported is True


@django_db_all
def test_report_dead_click_issue_other_tag():
    project = Factories.create_project(organization=Factories.create_organization())

    event = {
        "data": {
            "payload": {
                "data": {"node": {"tagName": "div"}, "endReason": "timeout"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    reported = report_dead_click_issue(project_id=project.id, replay_id="", event=event)
    assert reported is False


@django_db_all
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

    reported = report_dead_click_issue(project_id=1, replay_id="", event=event)
    assert reported is False


@django_db_all
def test_report_dead_click_issue_no_node_object():
    event = {
        "data": {
            "payload": {
                "data": {"endReason": "mutation"},
                "message": "div.xyz > a",
                "timestamp": time.time(),
            }
        }
    }

    assert report_dead_click_issue(project_id=1, replay_id="", event=event) is False
