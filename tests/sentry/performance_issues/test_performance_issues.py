import logging
import uuid

from sentry.event_manager import EventManager
from sentry.spans.grouping.utils import hash_values
from sentry.testutils import TestCase


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


class EventManagerTestMixin:
    def make_release_event(self, release_name, project_id):
        manager = EventManager(make_event(release=release_name))
        manager.normalize()
        event = manager.save(project_id)
        return event


class EventManagerTest(TestCase, EventManagerTestMixin):

    # GROUPS TESTS
    def test_transaction_event_type_and_group(self):
        manager = EventManager(
            make_event(
                **{
                    "transaction": "wait",
                    "contexts": {
                        "trace": {
                            "parent_span_id": "bce14471e0e9654d",
                            "op": "foobar",
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "span_id": "bf5be759039ede9a",
                        }
                    },
                    "spans": [],
                    "timestamp": "2019-06-14T14:01:40Z",
                    "start_timestamp": "2019-06-14T14:01:40Z",
                    "type": "transaction",
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)
        data = event.data
        assert data["type"] == "transaction"
        group = event.group
        assert group is not None

    def test_transaction_event_span_grouping_and_group(self):
        with self.feature("projects:performance-suspect-spans-ingestion"):
            manager = EventManager(
                make_event(
                    **{
                        "transaction": "wait",
                        "contexts": {
                            "trace": {
                                "parent_span_id": "bce14471e0e9654d",
                                "op": "foobar",
                                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                                "span_id": "bf5be759039ede9a",
                            }
                        },
                        "spans": [
                            {
                                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                                "parent_span_id": "bf5be759039ede9a",
                                "span_id": "a" * 16,
                                "start_timestamp": 0,
                                "timestamp": 1,
                                "same_process_as_parent": True,
                                "op": "default",
                                "description": "span a",
                            },
                            {
                                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                                "parent_span_id": "bf5be759039ede9a",
                                "span_id": "b" * 16,
                                "start_timestamp": 0,
                                "timestamp": 1,
                                "same_process_as_parent": True,
                                "op": "default",
                                "description": "span a",
                            },
                            {
                                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                                "parent_span_id": "bf5be759039ede9a",
                                "span_id": "c" * 16,
                                "start_timestamp": 0,
                                "timestamp": 1,
                                "same_process_as_parent": True,
                                "op": "default",
                                "description": "span b",
                            },
                        ],
                        "timestamp": "2019-06-14T14:01:40Z",
                        "start_timestamp": "2019-06-14T14:01:40Z",
                        "type": "transaction",
                    }
                )
            )
            manager.normalize()
            event = manager.save(self.project.id)
            data = event.data
            assert data["type"] == "transaction"
            assert data["span_grouping_config"]["id"] == "default:2021-08-25"
            spans = [{"hash": span["hash"]} for span in data["spans"]]
            # the basic strategy is to simply use the description
            assert spans == [{"hash": hash_values([span["description"]])} for span in data["spans"]]
            group = event.group
            assert group is not None
