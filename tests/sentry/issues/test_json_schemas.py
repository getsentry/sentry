from collections.abc import Callable, Mapping
from importlib import reload
from typing import Any
from unittest import TestCase, mock

import jsonschema
import pytest

from sentry.issues import json_schemas


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


VALID_EVENT: dict[str, Any] = {
    "event_id": "a" * 32,
    "level": "error",
    "platform": "python",
    "project_id": 1,
    "received": "2020-01-01T00:00:00+00:00",
    "tags": {},
    "timestamp": "2020-01-01T00:00:00+00:00",
}

EVENTS = [
    pytest.param(VALID_EVENT, id="valid"),
    # Formats aren't checked: `jsonschema.validate` passes no format checker.
    pytest.param({**VALID_EVENT, "received": "not-a-date", "timestamp": "nope"}, id="bad-format"),
    # Invalid under the event schema, valid under the legacy one.
    pytest.param({**VALID_EVENT, "tags": {"nan-tag": float("nan")}}, id="nan-tag"),
    pytest.param({k: v for k, v in VALID_EVENT.items() if k != "timestamp"}, id="no-timestamp"),
    # Several errors at once, so the one raised depends on `best_match`.
    pytest.param({**VALID_EVENT, "level": 5, "platform": 0, "tags": "tagged"}, id="many-errors"),
]


def _error(validate: Callable[[], None]) -> tuple[Any, ...] | None:
    try:
        validate()
    except jsonschema.ValidationError as e:
        return (type(e), e.message, list(e.absolute_path), list(e.absolute_schema_path))
    return None


@pytest.mark.parametrize(
    "schema", [json_schemas.EVENT_PAYLOAD_SCHEMA, json_schemas.LEGACY_EVENT_PAYLOAD_SCHEMA]
)
def test_schema_is_valid(schema: Mapping[str, Any]) -> None:
    jsonschema.validators.validator_for(schema).check_schema(schema)


@pytest.mark.parametrize("event", EVENTS)
def test_validate_event_payload_matches_jsonschema_validate(event: dict[str, Any]) -> None:
    assert _error(lambda: json_schemas.validate_event_payload(event)) == _error(
        lambda: jsonschema.validate(event, json_schemas.EVENT_PAYLOAD_SCHEMA)
    )


@pytest.mark.parametrize("event", EVENTS)
def test_validate_legacy_event_payload_matches_jsonschema_validate(
    event: dict[str, Any],
) -> None:
    assert _error(lambda: json_schemas.validate_legacy_event_payload(event)) == _error(
        lambda: jsonschema.validate(event, json_schemas.LEGACY_EVENT_PAYLOAD_SCHEMA)
    )


def _raised(validate: Callable[[], None]) -> tuple[Any, ...] | None:
    error = _error(validate)
    return error[:3] if error else None


def test_validate_event_payload_errors() -> None:
    assert _raised(lambda: json_schemas.validate_event_payload(VALID_EVENT)) is None
    assert _raised(
        lambda: json_schemas.validate_event_payload(
            {**VALID_EVENT, "tags": {"nan-tag": float("nan")}}
        )
    ) == (jsonschema.ValidationError, "nan is not of type 'string', 'null'", ["tags", "nan-tag"])
    assert _raised(lambda: json_schemas.validate_legacy_event_payload(VALID_EVENT)) is None
    assert _raised(
        lambda: json_schemas.validate_legacy_event_payload(
            {k: v for k, v in VALID_EVENT.items() if k != "timestamp"}
        )
    ) == (jsonschema.ValidationError, "'timestamp' is a required property", [])


# By name: `test_falls_back_to_legacy` reloads the module, replacing these after collection.
@pytest.mark.parametrize(
    ("validator_name", "schema_name"),
    [
        ("_event_payload_validator", "EVENT_PAYLOAD_SCHEMA"),
        ("_legacy_event_payload_validator", "LEGACY_EVENT_PAYLOAD_SCHEMA"),
    ],
)
def test_validator_matches_jsonschema_validate(validator_name: str, schema_name: str) -> None:
    validator = getattr(json_schemas, validator_name)()
    schema = getattr(json_schemas, schema_name)
    assert type(validator) is jsonschema.validators.validator_for(schema)
    assert validator.schema is schema
    assert validator.format_checker is None


def test_validators_are_built_once() -> None:
    json_schemas._event_payload_validator.cache_clear()
    json_schemas._legacy_event_payload_validator.cache_clear()
    with mock.patch.object(
        json_schemas, "_build_validator", wraps=json_schemas._build_validator
    ) as build_validator:
        for _ in range(3):
            json_schemas.validate_event_payload(VALID_EVENT)
            json_schemas.validate_legacy_event_payload(VALID_EVENT)

    assert build_validator.call_args_list == [
        mock.call(json_schemas.EVENT_PAYLOAD_SCHEMA),
        mock.call(json_schemas.LEGACY_EVENT_PAYLOAD_SCHEMA),
    ]
