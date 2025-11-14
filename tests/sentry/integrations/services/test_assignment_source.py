from typing import int, Any
from unittest import TestCase

from sentry.integrations.services.assignment_source import AssignmentSource


class TestAssignmentSource(TestCase):
    def test_from_dict_empty_array(self) -> None:
        data: dict[str, Any] = {}
        result = AssignmentSource.from_dict(data)
        assert result is None

    def test_from_dict_inalid_data(self) -> None:
        data = {
            "foo": "bar",
        }

        result = AssignmentSource.from_dict(data)
        assert result is None

    def test_from_dict_valid_data(self) -> None:
        data = {"source_name": "foo-source", "integration_id": 123}

        result = AssignmentSource.from_dict(data)
        assert result is not None
        assert result.source_name == "foo-source"
        assert result.integration_id == 123

    def test_to_dict(self) -> None:
        source = AssignmentSource(
            source_name="foo-source",
            integration_id=123,
        )

        result = source.to_dict()
        assert result.get("queued") is not None
        assert result.get("source_name") == "foo-source"
        assert result.get("integration_id") == 123
