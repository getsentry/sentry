import pytest

from sentry.lang.native.project_symbol_sources import backfill_secrets, redact_source
from sentry.lang.native.source_kinds import HIDDEN_SECRET, SOURCE_SERIALIZERS, secret_fields

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


@pytest.mark.parametrize("source_type", sorted(SOURCE_SERIALIZERS))
def test_source_kind_validation_and_redaction(source_type: str) -> None:
    serializer_class = SOURCE_SERIALIZERS[source_type]
    source = CUSTOM_SOURCE_SAMPLES[source_type]
    serializer = serializer_class(data=source)
    assert serializer.is_valid(), serializer.errors

    redacted = redact_source(source)
    hidden = {key for key, value in redacted.items() if value == HIDDEN_SECRET}
    assert hidden == set(secret_fields(serializer_class))
    assert not serializer_class(data=redacted).is_valid()

    backfill_secrets(redacted, source)
    assert redacted == source
