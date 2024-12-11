from unittest.mock import PropertyMock, patch

import pytest
from jsonschema import ValidationError

from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.utils.registry import NoRegistrationExistsError, Registry
from sentry.workflow_engine.models import Detector, Workflow

example_registry = Registry[str]()
example_schema = {
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
example_registry.register_instance("test_type", json.dumps(example_schema))


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


@patch(
    "sentry.workflow_engine.models.Detector.CONFIG_SCHEMA_REGISTRY",
    return_value=example_registry,
    new_callable=PropertyMock,
)
class TestDetectorConfig(TestJsonConfigBase):
    def test_detector_no_registration(self, mock_detector_registry):
        with pytest.raises(NoRegistrationExistsError):
            Detector.objects.create(name="test_detector", type="fake_type")

    def test_detector_mismatched_schema(self, mock_detector_registry):
        with pytest.raises(ValidationError):
            Detector.objects.create(name="test_detector", type="test_type", config={"hi": "there"})

    def test_detector_correct_schema(self, mock_detector_registry):
        Detector.objects.create(name="test_detector", type="test_type", config=self.correct_config)


@patch(
    "sentry.workflow_engine.models.Workflow.CONFIG_SCHEMA",
    return_value=example_schema,
    new_callable=PropertyMock,
)
class TestWorkflowConfig(TestJsonConfigBase):
    def test_workflow_mismatched_schema(self, mock_workflow_config_schema):
        with pytest.raises(ValidationError):
            Workflow.objects.create(
                organization=self.organization, name="test_workflow", config={"hi": "there"}
            )

    def test_workflow_correct_schema(self, mock_workflow_config_schema):
        Workflow.objects.create(
            organization=self.organization, name="test_workflow", config=self.correct_config
        )
