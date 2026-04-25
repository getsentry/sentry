from typing import Any
from unittest import mock

import pytest
from jsonschema import ValidationError

from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.testutils.cases import APITestCase
from sentry.workflow_engine.types import DetectorSettings
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest

_GET_DETECTOR_SETTINGS = "sentry.workflow_engine.types.get_detector_settings"


class JSONConfigBaseTest(BaseGroupTypeTest):
    def setUp(self) -> None:
        super().setUp()
        self.correct_config = {
            "username": "user123",
            "email": "user@example.com",
            "fullName": "John Doe",
            "age": 30,
            "location": "Cityville",
            "interests": ["Travel", "Technology"],
        }

        self.example_schema = {
            "$id": "https://example.com/user-profile.schema.json",
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of a user profile",
            "type": "object",
            "required": ["username", "email"],
            "properties": {
                "username": {"type": "string"},
                "email": {"type": "string", "format": "email"},
                "fullName": {"type": "string"},
                "age": {"type": "integer", "minimum": 0},
                "location": {"type": "string"},
                "interests": {"type": "array", "items": {"type": "string"}},
            },
        }

        self._settings_by_slug: dict[str, DetectorSettings] = {}

        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.ERROR.value
            category_v2 = GroupCategory.ERROR.value

        class ExampleGroupType(GroupType):
            type_id = 2
            slug = "example"
            description = "Example"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value

        self._register_settings("test", config_schema=self.example_schema)
        self._register_settings(
            "example", config_schema={"type": "object", "additionalProperties": False}
        )

        self._gds_patcher = mock.patch(
            _GET_DETECTOR_SETTINGS, side_effect=self._mock_get_detector_settings
        )
        self._gds_patcher.start()

    def tearDown(self) -> None:
        super().tearDown()
        self._gds_patcher.stop()

    def _register_settings(self, slug: str, **kwargs: Any) -> None:
        self._settings_by_slug[slug] = DetectorSettings(**kwargs)

    def _mock_get_detector_settings(self, group_type: type[GroupType]) -> DetectorSettings | None:
        return self._settings_by_slug.get(group_type.slug)


# TODO - Move this to the detector model test
class TestDetectorConfig(JSONConfigBaseTest):
    def test_detector_no_registration(self) -> None:
        with pytest.raises(ValueError):
            self.create_detector(name="test_detector", type="no_registration")

    def test_detector_schema(self) -> None:
        self.create_detector(name="test_detector", type="test", config=self.correct_config)

        with pytest.raises(ValidationError):
            self.create_detector(name="test_detector", type="test", config={"hi": "there"})

    def test_detector_empty_schema(self) -> None:
        self.create_detector(name="example_detector", type="example", config={})

        with pytest.raises(ValidationError):
            self.create_detector(name="test_detector", type="example", config={"hi": "there"})


# TODO - Move this to the workflow model test
class TestWorkflowConfig(JSONConfigBaseTest):
    def test_workflow_mismatched_schema(self) -> None:
        with pytest.raises(ValidationError):
            self.create_workflow(
                organization=self.organization, name="test_workflow", config={"hi": "there"}
            )

    def test_workflow_correct_schema(self) -> None:
        self.create_workflow(organization=self.organization, name="test_workflow", config={})
        self.create_workflow(
            organization=self.organization, name="test_workflow2", config={"frequency": 30}
        )


# TODO - This should be moved into incidents directory
class TestMetricIssueDetectorConfig(JSONConfigBaseTest, APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.metric_alert = self.create_alert_rule(threshold_period=1)

        class TestGroupType(GroupType):
            type_id = 3
            slug = "test_metric_issue"
            description = "Metric alert fired"
            category = GroupCategory.METRIC_ALERT.value
            category_v2 = GroupCategory.METRIC.value

        self._register_settings(
            "test_metric_issue",
            config_schema={
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "description": "A representation of a metric detector config dict",
                "type": "object",
                "required": ["detection_type"],
                "properties": {
                    "comparison_delta": {
                        "type": ["integer", "null"],
                    },
                    "detection_type": {
                        "type": "string",
                        "enum": [dt.value for dt in AlertRuleDetectionType],
                    },
                },
            },
        )

    def test_detector_correct_schema(self) -> None:
        self.create_detector(
            name=self.metric_alert.name,
            project_id=self.project.id,
            type="test_metric_issue",
            owner_user_id=self.metric_alert.user_id,
            config={
                "threshold_period": self.metric_alert.threshold_period,
                "comparison_delta": self.metric_alert.comparison_delta,
                "detection_type": self.metric_alert.detection_type,
                "sensitivity": self.metric_alert.sensitivity,
                "seasonality": self.metric_alert.seasonality,
            },
        )

    def test_empty_config(self) -> None:
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.metric_alert.name,
                project_id=self.project.id,
                type="test_metric_issue",
                owner_user_id=self.metric_alert.user_id,
                config={},
            )

    def test_no_config(self) -> None:
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.metric_alert.name,
                project_id=self.project.id,
                type="test_metric_issue",
                owner_user_id=self.metric_alert.user_id,
            )

    def test_incorrect_config(self) -> None:
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.metric_alert.name,
                project_id=self.project.id,
                type="test_metric_issue",
                owner_user_id=self.metric_alert.user_id,
                config=["some", "stuff"],
            )

    def test_mismatched_schema(self) -> None:
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.metric_alert.name,
                project_id=self.project.id,
                type="test_metric_issue",
                owner_user_id=self.metric_alert.user_id,
                config={
                    "comparison_delta": "matcha",
                    "detection_type": self.metric_alert.detection_type,
                },
            )

    def test_missing_required(self) -> None:
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.metric_alert.name,
                project_id=self.project.id,
                type="test_metric_issue",
                owner_user_id=self.metric_alert.user_id,
                config={
                    "threshold_period": self.metric_alert.threshold_period,
                    "comparison_delta": self.metric_alert.comparison_delta,
                    "sensitivity": self.metric_alert.sensitivity,
                    "seasonality": self.metric_alert.seasonality,
                },
            )
