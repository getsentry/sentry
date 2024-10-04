from typing import Any

from sentry.integrations.services.assignment_source import AssignmentSource
from sentry.testutils.cases import TestCase


class TestAssignmentSource(TestCase):
    def test_from_dict_empty_array(self):
        data: dict[str, Any] = {}
        result = AssignmentSource.from_dict(data)
        assert result is None

    def test_from_dict_inalid_data(self):
        data = {
            "foo": "bar",
        }

        result = AssignmentSource.from_dict(data)
        assert result is None

    def test_from_dict_valid_data(self):
        data = {"source_name": "foo-source", "integration_id": 123}

        result = AssignmentSource.from_dict(data)
        assert result is not None
        assert result.source_name == "foo-source"
        assert result.integration_id == 123

    def test_to_dict(self):
        source = AssignmentSource(
            source_name="foo-source",
            integration_id=123,
        )

        result = source.to_dict()
        assert result.get("queued") is not None
        assert result.get("source_name") == "foo-source"
        assert result.get("integration_id") == 123
