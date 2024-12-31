import pytest

from sentry.eventstream.base import GroupState
from sentry.rules.conditions.event_attribute import EventAttributeCondition, attribute_registry
from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.rules.match import MatchType
from sentry.utils import json
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEveryEventCondition(ConditionTestCase):
    condition = Condition.EVERY_EVENT
    rule_cls = EveryEventCondition
    payload = {"id": EveryEventCondition.id}

    def test(self):
        job = WorkflowJob(
            {
                "event": self.group_event,
                "group_state": GroupState(
                    {
                        "id": 1,
                        "is_regression": False,
                        "is_new": False,
                        "is_new_group_environment": False,
                    }
                ),
            }
        )
        dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

        self.assert_passes(dc, job)

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg


class TestEventAttributeCondition(ConditionTestCase):
    condition = Condition.EVENT_ATTRIBUTE
    rule_cls = EventAttributeCondition
    payload = {"id": EventAttributeCondition.id}

    def get_event(self, **kwargs):
        data = {
            "message": "hello world",
            "request": {"method": "GET", "url": "http://example.com/"},
            "user": {
                "id": "1",
                "ip_address": "127.0.0.1",
                "email": "foo@example.com",
                "username": "foo",
            },
            "exception": {
                "values": [
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "example.php",
                                    "module": "example",
                                    "context_line": 'echo "hello";',
                                    "abs_path": "path/to/example.php",
                                }
                            ]
                        },
                        "thread_id": 1,
                    }
                ]
            },
            "tags": [("environment", "production")],
            "extra": {"foo": {"bar": "baz"}, "biz": ["baz"], "bar": "foo"},
            "platform": "php",
            "sdk": {"name": "sentry.javascript.react", "version": "6.16.1"},
            "contexts": {
                "response": {
                    "type": "response",
                    "status_code": 500,
                },
                "device": {
                    "screen_width_pixels": 1920,
                    "screen_height_pixels": 1080,
                    "screen_dpi": 123,
                    "screen_density": 2.5,
                },
                "app": {
                    "in_foreground": True,
                },
                "unreal": {
                    "crash_type": "crash",
                },
                "os": {"distribution_name": "ubuntu", "distribution_version": "22.04"},
            },
            "threads": {
                "values": [
                    {
                        "id": 1,
                        "main": True,
                    },
                ],
            },
        }
        data.update(kwargs)
        event = self.store_event(data, project_id=self.project.id)
        return event

    def setUp(self):
        self.event = self.get_event()
        self.group = self.create_group(project=self.project)
        self.group_event = self.event.for_group(self.group)
        self.job = WorkflowJob(
            {
                "event": self.group_event,
                "group_state": GroupState(
                    {
                        "id": 1,
                        "is_regression": False,
                        "is_new": False,
                        "is_new_group_environment": False,
                    }
                ),
            }
        )

    def test_not_in_registry(self):
        with pytest.raises(NoRegistrationExistsError):
            attribute_registry.get("transaction")
        dc = self.create_data_condition(
            type=self.condition,
            comparison=json.dumps(
                {
                    "match": MatchType.EQUAL,
                    "attribute": "transaction",
                    "value": "asdf",
                }
            ),
            condition_result=True,
        )
        self.assert_does_not_pass(dc, self.job)

    def test_equals(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison=json.dumps(
                {"match": MatchType.EQUAL, "attribute": "platform", "value": "php"}
            ),
            condition_result=True,
        )
        self.assert_passes(dc, self.job)

    def test_not_equals(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison=json.dumps(
                {"match": MatchType.NOT_EQUAL, "attribute": "platform", "value": "php"}
            ),
            condition_result=True,
        )
        self.assert_does_not_pass(dc, self.job)

        dc = self.create_data_condition(
            type=self.condition,
            comparison=json.dumps(
                {"match": MatchType.NOT_EQUAL, "attribute": "platform", "value": "python"}
            ),
            condition_result=True,
        )
        self.assert_passes(dc, self.job)

    def test_starts_with(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison=json.dumps(
                {"match": MatchType.STARTS_WITH, "attribute": "platform", "value": "ph"}
            ),
            condition_result=True,
        )
        self.assert_passes(dc, self.job)

    def test_does_not_start_with(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison=json.dumps(
                {"match": MatchType.NOT_STARTS_WITH, "attribute": "platform", "value": "ph"}
            ),
            condition_result=True,
        )
        self.assert_does_not_pass(dc, self.job)

        dc = self.create_data_condition(
            type=self.condition,
            comparison=json.dumps(
                {"match": MatchType.NOT_STARTS_WITH, "attribute": "platform", "value": "py"}
            ),
            condition_result=True,
        )
        self.assert_passes(dc, self.job)

    def test_dual_write(self):
        comparison = {
            "match": MatchType.EQUAL,
            "value": "php",
            "attribute": "platform",
        }
        self.payload.update(comparison)
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == json.dumps(comparison)
        assert dc.condition_result is True
        assert dc.condition_group == dcg
