from unittest.mock import PropertyMock, patch

import pytest
from jsonschema import ValidationError

from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.utils.registry import NoRegistrationExistsError, Registry


class TestJsonConfigBase(TestCase):
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

    @pytest.fixture(autouse=True)
    def initialize_configs(self):
        self.example_registry = Registry[str](enable_reverse_lookup=False)
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
        self.example_registry.register("test_type")(json.dumps(self.example_schema))

        with (
            patch(
                "sentry.workflow_engine.models.Detector.CONFIG_SCHEMA_REGISTRY",
                return_value=self.example_registry,
                new_callable=PropertyMock,
            ),
            patch(
                "sentry.workflow_engine.models.Workflow.CONFIG_SCHEMA",
                return_value=self.example_schema,
                new_callable=PropertyMock,
            ),
        ):
            # Run test case
            yield


class TestDetectorConfig(TestJsonConfigBase):
    def test_detector_no_registration(self):
        with pytest.raises(NoRegistrationExistsError):
            self.create_detector(name="test_detector", type="fake_type")

    def test_detector_mismatched_schema(self):
        with pytest.raises(ValidationError):
            self.create_detector(name="test_detector", type="test_type", config={"hi": "there"})

    def test_detector_correct_schema(self):
        self.create_detector(name="test_detector", type="test_type", config=self.correct_config)


class TestWorkflowConfig(TestJsonConfigBase):
    def test_workflow_mismatched_schema(self):
        with pytest.raises(ValidationError):
            self.create_workflow(
                organization=self.organization, name="test_workflow", config={"hi": "there"}
            )

    def test_workflow_correct_schema(self):
        self.create_workflow(
            organization=self.organization, name="test_workflow", config=self.correct_config
        )
