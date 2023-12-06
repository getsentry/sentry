from importlib import reload
from unittest import mock

from sentry.issues import json_schemas
from sentry.testutils.cases import TestCase


class JsonSchemasTest(TestCase):
    def test_loads_json_schema(self) -> None:
        assert json_schemas.EVENT_PAYLOAD_SCHEMA != json_schemas.LEGACY_EVENT_PAYLOAD_SCHEMA
        assert (
            json_schemas.EVENT_PAYLOAD_SCHEMA.get("description")
            == " The sentry v7 event structure."
        )

    def test_falls_back_to_legacy(self) -> None:
        with mock.patch(
            "sentry.issues.json_schemas.open", mock.mock_open(read_data="invalid json")
        ):
            reload(json_schemas)
            assert json_schemas.EVENT_PAYLOAD_SCHEMA == json_schemas.LEGACY_EVENT_PAYLOAD_SCHEMA
        reload(json_schemas)
