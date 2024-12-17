from dataclasses import dataclass

import pytest
from jsonschema import ValidationError

from sentry.incidents.grouptype import MetricAlertFire
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.testutils.cases import APITestCase
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest


class TestJsonConfigBase(BaseGroupTypeTest):
    def setUp(self):
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

        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.ERROR.value
            detector_config_schema = self.example_schema

        @dataclass(frozen=True)
        class ExampleGroupType(GroupType):
            type_id = 2
            slug = "example"
            description = "Example"
            category = GroupCategory.PERFORMANCE.value
            detector_config_schema = {"type": "object", "additionalProperties": False}


class TestDetectorConfig(TestJsonConfigBase):
    def test_detector_no_registration(self):
        with pytest.raises(ValueError):
            self.create_detector(name="test_detector", type="no_registration")

    def test_detector_schema(self):
        self.create_detector(name="test_detector", type="test", config=self.correct_config)

        with pytest.raises(ValidationError):
            self.create_detector(name="test_detector", type="test", config={"hi": "there"})

    def test_detector_empty_schema(self):
        self.create_detector(name="example_detector", type="example", config={})

        with pytest.raises(ValidationError):
            self.create_detector(name="test_detector", type="example", config={"hi": "there"})


class TestWorkflowConfig(TestJsonConfigBase):
    def test_workflow_mismatched_schema(self):
        with pytest.raises(ValidationError):
            self.create_workflow(
                organization=self.organization, name="test_workflow", config={"hi": "there"}
            )

    def test_workflow_correct_schema(self):
        self.create_workflow(organization=self.organization, name="test_workflow", config={})
        self.create_workflow(
            organization=self.organization, name="test_workflow2", config={"frequency": 30}
        )


class TestMetricAlertFireDetectorConfig(TestJsonConfigBase, APITestCase):
    def setUp(self):
        super().setUp()
        self.metric_alert = self.create_alert_rule(threshold_period=1)
        self.config = (
            {
                "threshold_period": self.metric_alert.threshold_period,
                "sensitivity": self.metric_alert.sensitivity,
                "seasonality": self.metric_alert.seasonality,
                "comparison_delta": self.metric_alert.comparison_delta,
            },
        )

        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 2
            slug = "test_metric_alert_fire"
            description = "Metric alert fired"
            category = GroupCategory.METRIC_ALERT.value
            detector_config_schema = MetricAlertFire.detector_config_schema

    def test_mismatched_schema(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.metric_alert.name,
                project_id=self.project.id,
                type="test_metric_alert_fire",
                owner_user_id=self.metric_alert.user_id,
                config={
                    "threshold_period": self.metric_alert.threshold_period,
                    "comparison_delta": self.metric_alert.comparison_delta,
                    "detection_type": self.metric_alert.detection_type,
                    "sensitivity": self.metric_alert.sensitivity,
                    "seasonality": 42,
                },
            )

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.metric_alert.name,
                project_id=self.project.id,
                type="test_metric_alert_fire",
                owner_user_id=self.metric_alert.user_id,
                config={
                    "threshold_period": self.metric_alert.threshold_period,
                    "comparison_delta": self.metric_alert.comparison_delta,
                    "sensitivity": self.metric_alert.sensitivity,
                    "seasonality": self.metric_alert.seasonality,
                },
            )

    def test_detector_correct_schema(self):
        self.create_detector(
            name=self.metric_alert.name,
            project_id=self.project.id,
            type="test_metric_alert_fire",
            owner_user_id=self.metric_alert.user_id,
            config={
                "threshold_period": self.metric_alert.threshold_period,
                "comparison_delta": self.metric_alert.comparison_delta,
                "detection_type": self.metric_alert.detection_type,
                "sensitivity": self.metric_alert.sensitivity,
                "seasonality": self.metric_alert.seasonality,
            },
        )
