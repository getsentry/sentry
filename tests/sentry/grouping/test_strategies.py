from typing import Any

from sentry.eventstore.models import Event
from sentry.testutils.cases import TestCase


class ChainedExceptionTest(TestCase):
    def test_ignores_mechanism_in_python_sdk_version_3_chained_exception_events(self):
        # First, get hashes for an event with no `mechanism` data
        event_data: dict[str, Any] = {
            "platform": "python",
            "sdk": {"name": "python", "version": "3.1"},
            "exception": {
                "values": [
                    {"type": "FetchError", "value": "Charlie didn't bring the ball back"},
                    {"type": "ShoeError", "value": "Oh, no! Charlie ate the flip-flops!"},
                    {"type": "AggregateException", "value": "She's a very good dog, but..."},
                ]
            },
        }

        no_mechanism_hashes = Event(
            event_id="1121123104150908",
            project_id=self.project.id,
            data=event_data,
        ).get_hashes()

        # Now add in `mechanism` data, and we'll see that the hash doesn't change
        event_data["exception"]["values"][0]["mechanism"] = {
            "type": "chained",
            "handled": True,
            "source": "InnerExceptions[1]",
            "exception_id": 2,
            "parent_id": 0,
        }
        event_data["exception"]["values"][1]["mechanism"] = {
            "type": "chained",
            "handled": True,
            "source": "InnerExceptions[0]",
            "exception_id": 1,
            "parent_id": 0,
        }
        event_data["exception"]["values"][2]["mechanism"] = {
            "type": "AppDomain.UnhandledException",
            "handled": False,
            "is_exception_group": True,
            "exception_id": 0,
        }

        with_mechanism_hashes = Event(
            event_id="1231112109080415",
            project_id=self.project.id,
            data=event_data,
        ).get_hashes()

        assert no_mechanism_hashes == with_mechanism_hashes

        # Just to prove that were it not for the hack, the grouping *would* change with the addition
        # of mechanism data, we switch the platform
        event_data["platform"] = "javascript"

        js_with_mechanism_hashes = Event(
            event_id="1121201212312012",
            project_id=self.project.id,
            data=event_data,
        ).get_hashes()

        assert js_with_mechanism_hashes != no_mechanism_hashes
