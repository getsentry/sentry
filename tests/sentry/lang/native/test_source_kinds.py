import jsonschema
import pytest

from sentry.lang.native.project_symbol_sources import (
    InvalidSourcesError,
    backfill_secrets,
    redact_source_secrets,
    validate_sources,
)
from sentry.lang.native.source_kinds import SOURCE_KINDS
from sentry.lang.native.source_schema import HIDDEN_SECRET

CUSTOM_SOURCE_SAMPLES = {
    "http": {
        "id": "honk",
        "name": "honk source",
        "layout": {"type": "native"},
        "type": "http",
        "url": "http://honk.beep",
        "username": "honkhonk",
        "password": "beepbeep",
    },
    "s3": {
        "id": "honk",
        "layout": {"type": "native", "casing": "lowercase"},
        "type": "s3",
        "bucket": "mybucket",
        "region": "us-east-1",
        "access_key": "AKIA",
        "secret_key": "hunter2",
        "prefix": "symbols/",
    },
    "gcs": {
        "id": "honk",
        "layout": {"type": "native"},
        "filters": {"filetypes": ["pe", "pdb"]},
        "type": "gcs",
        "bucket": "mybucket",
        "client_email": "honk@beep.com",
        "private_key": "-----BEGIN PRIVATE KEY-----",
    },
}


@pytest.mark.parametrize("source_type", sorted(SOURCE_KINDS))
def test_source_kind_schemas_and_redaction(source_type: str) -> None:
    kind = SOURCE_KINDS[source_type]
    source = CUSTOM_SOURCE_SAMPLES[source_type]
    jsonschema.validate(source, kind.schema)
    validate_sources([source])

    redacted = redact_source_secrets([source])[0]
    jsonschema.validate(redacted, kind.redacted_schema)
    assert {key for key, value in redacted.items() if value == HIDDEN_SECRET} == set(kind.secrets)

    backfill_secrets(redacted, source)
    assert redacted == source

    anonymous = {key: value for key, value in source.items() if key != "id"}
    jsonschema.validate(anonymous, kind.request_schema)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(anonymous, kind.schema)


def test_backfill_secrets_without_previous_value() -> None:
    source = {**CUSTOM_SOURCE_SAMPLES["http"], "password": HIDDEN_SECRET}
    with pytest.raises(InvalidSourcesError):
        backfill_secrets(source, None)
    with pytest.raises(InvalidSourcesError):
        backfill_secrets(source, {**CUSTOM_SOURCE_SAMPLES["http"], "password": None})
