import pytest

from sentry.lang.native.project_symbol_sources import (
    InvalidSourcesError,
    backfill_secrets,
    parse_sources,
    validate_sources,
)
from sentry.lang.native.source_kinds import HIDDEN_SECRET


def http_source(**overrides: object) -> dict:
    return {
        "id": "honk",
        "layout": {"type": "native"},
        "type": "http",
        "url": "http://honk.beep",
        "password": "beepbeep",
        **overrides,
    }


def test_validate_sources_accepts_valid_sources() -> None:
    validate_sources([http_source(), http_source(id="beep")])


@pytest.mark.parametrize(
    ("source", "message"),
    [
        ({"id": "honk"}, "Unknown source type: None"),
        ({"id": "honk", "type": "ftp"}, "Unknown source type: 'ftp'"),
        ({"type": "http", "layout": {"type": "native"}}, "url: This field is required."),
        (
            http_source(layout={"type": "hexagonal"}),
            'layout.type: "hexagonal" is not a valid choice.',
        ),
        (http_source(bucket="nope"), "bucket: Unknown field."),
        (http_source(password=HIDDEN_SECRET), "password: Not a valid string."),
        (http_source(id="sentry:project"), 'must not start with "sentry:"'),
    ],
)
def test_validate_sources_rejects(source: dict, message: str) -> None:
    with pytest.raises(InvalidSourcesError) as excinfo:
        validate_sources([source])
    assert message in str(excinfo.value)


def test_validate_sources_requires_an_id() -> None:
    source = http_source()
    del source["id"]
    with pytest.raises(InvalidSourcesError, match="missing an id"):
        validate_sources([source])


def test_validate_sources_rejects_duplicate_ids() -> None:
    with pytest.raises(InvalidSourcesError, match="Duplicate source id: honk"):
        validate_sources([http_source(), http_source()])


def test_parse_sources_drops_legacy_sources() -> None:
    config = '[{"type": "appStoreConnect", "id": "old"}, %s]' % (
        '{"id": "honk", "type": "http", "url": "http://honk.beep", "layout": {"type": "native"}}'
    )
    assert [source["id"] for source in parse_sources(config)] == ["honk"]
    assert parse_sources(None) == []
    assert parse_sources("") == []


def test_backfill_secrets_without_previous_value() -> None:
    source = http_source(password=HIDDEN_SECRET)
    with pytest.raises(InvalidSourcesError):
        backfill_secrets(source, None)
    with pytest.raises(InvalidSourcesError):
        backfill_secrets(source, http_source(password=None))
