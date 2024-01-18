import time
from typing import cast

from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.ingest.issue_creation import report_rage_click_issue
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@django_db_all
def test_report_rage_click_issue_a_tag():
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

    report_rage_click_issue(project_id=project.id, replay_id="", event=cast(SentryEvent, event))
