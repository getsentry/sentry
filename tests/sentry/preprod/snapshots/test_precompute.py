from typing import Any, cast
from unittest.mock import MagicMock

import orjson

from sentry.preprod.snapshots.comparison_categorizer import CategorizedComparison
from sentry.preprod.snapshots.precompute import (
    COMPARISON_SCHEMA_VERSION,
    HEAD_IMAGES_SCHEMA_VERSION,
    build_comparison_payload,
    build_head_images_payload,
    comparison_response_key,
    head_images_key,
    load_precomputed_comparison,
    load_precomputed_head_images,
    refresh_expiration,
    refresh_manifest_expiration,
)

_IMAGES = {
    "b.png": {"content_hash": "hb", "display_name": "B", "width": 1, "height": 2},
    "a.png": {"content_hash": "ha", "display_name": "A", "width": 3, "height": 4},
}


class TestHeadImagesKey:
    def test_key_format(self) -> None:
        assert head_images_key(1, 2, 3) == "1/2/3/snapshot_head_images.json"


class TestBuildHeadImagesPayload:
    def test_schema_version_and_diff_threshold(self) -> None:
        payload = build_head_images_payload(_IMAGES, 0.1)

        assert payload["schema_version"] == HEAD_IMAGES_SCHEMA_VERSION
        assert payload["diff_threshold"] == 0.1

    def test_images_sorted_by_file_name(self) -> None:
        payload = build_head_images_payload(_IMAGES, None)

        assert [img["image_file_name"] for img in payload["images"]] == ["a.png", "b.png"]
        assert payload["images"][0]["key"] == "ha"

    def test_global_diff_threshold_baked_into_images(self) -> None:
        payload = build_head_images_payload(_IMAGES, 0.1)

        assert all(cast(dict[str, Any], img)["diff_threshold"] == 0.1 for img in payload["images"])


class TestRefreshManifestExpiration:
    def test_heads_the_manifest_key(self) -> None:
        session = MagicMock()

        refresh_manifest_expiration(session, "mk")

        session.head.assert_called_once_with("mk")

    def test_noop_when_key_missing(self) -> None:
        session = MagicMock()

        refresh_manifest_expiration(session, None)

        session.head.assert_not_called()

    def test_swallows_errors(self) -> None:
        session = MagicMock()
        session.head.side_effect = OSError("boom")

        refresh_manifest_expiration(session, "mk")


class TestRefreshExpiration:
    def test_heads_every_present_key(self) -> None:
        session = MagicMock()

        refresh_expiration(session, ("a", None, "b"))

        assert [c.args[0] for c in session.head.call_args_list] == ["a", "b"]

    def test_swallows_errors_and_continues(self) -> None:
        session = MagicMock()
        session.head.side_effect = [OSError("boom"), None]

        refresh_expiration(session, ("a", "b"))

        assert [c.args[0] for c in session.head.call_args_list] == ["a", "b"]


_PAIR = {
    "base_image": {"key": "b", "image_file_name": "x.png"},
    "head_image": {"key": "h", "image_file_name": "x.png"},
    "diff_image_key": "d",
    "diff": 0.5,
}
_IMG = {"key": "k", "image_file_name": "y.png", "width": 1, "height": 2}


def _categorized() -> CategorizedComparison:
    return CategorizedComparison(
        changed=[cast(Any, _PAIR)],
        added=[cast(Any, _IMG)],
        unchanged=[cast(Any, _IMG), cast(Any, _IMG)],
    )


class TestComparisonResponseKey:
    def test_key_format(self) -> None:
        assert comparison_response_key(1, 2, 3, 4) == "1/2/3/4/snapshot_comparison_response.json"


class TestBuildComparisonPayload:
    def test_carries_schema_metadata_and_buckets(self) -> None:
        payload = build_comparison_payload(_categorized(), "diff", "4", 0.1)

        assert payload["schema_version"] == COMPARISON_SCHEMA_VERSION
        assert payload["comparison_type"] == "diff"
        assert payload["base_artifact_id"] == "4"
        assert payload["diff_threshold"] == 0.1
        assert payload["changed"] == [_PAIR]
        assert payload["added"] == [_IMG]
        assert len(payload["unchanged"]) == 2
        assert payload["removed"] == []


class TestLoadPrecomputedComparison:
    def test_returns_none_when_key_missing(self) -> None:
        assert load_precomputed_comparison(_mock_session(b""), None) is None

    def test_returns_none_when_object_missing(self) -> None:
        assert load_precomputed_comparison(_mock_session(None), "k") is None

    def test_returns_payload_on_hit(self) -> None:
        raw = orjson.dumps(build_comparison_payload(_categorized(), "diff", "4", 0.1))

        result = load_precomputed_comparison(_mock_session(raw), "k")

        assert result is not None
        assert result["comparison_type"] == "diff"
        assert result["changed"] == [_PAIR]

    def test_returns_none_on_schema_version_mismatch(self) -> None:
        payload = build_comparison_payload(_categorized(), "diff", "4", 0.1)
        payload["schema_version"] = COMPARISON_SCHEMA_VERSION + 999
        raw = orjson.dumps(payload)

        assert load_precomputed_comparison(_mock_session(raw), "k") is None

    def test_returns_none_when_a_bucket_is_absent(self) -> None:
        payload = build_comparison_payload(_categorized(), "diff", "4", 0.1)
        del cast(dict[str, Any], payload)["unchanged"]
        raw = orjson.dumps(payload)

        assert load_precomputed_comparison(_mock_session(raw), "k") is None

    def test_returns_none_on_read_error(self) -> None:
        session = MagicMock()
        result = MagicMock()
        result.payload.read.side_effect = OSError("boom")
        session.get.return_value = result

        assert load_precomputed_comparison(session, "k") is None


def _mock_session(raw: bytes | None) -> MagicMock:
    session = MagicMock()
    if raw is None:
        session.get.return_value = None
    else:
        result = MagicMock()
        result.payload.read.return_value = raw
        session.get.return_value = result
    return session


class TestLoadPrecomputedHeadImages:
    def test_returns_none_when_key_missing(self) -> None:
        assert load_precomputed_head_images(_mock_session(b""), None) is None

    def test_returns_none_when_object_missing(self) -> None:
        assert load_precomputed_head_images(_mock_session(None), "k") is None

    def test_returns_images_and_threshold_on_hit(self) -> None:
        raw = orjson.dumps(build_head_images_payload(_IMAGES, 0.1))

        result = load_precomputed_head_images(_mock_session(raw), "k")

        assert result is not None
        images, diff_threshold = result
        assert diff_threshold == 0.1
        assert [img["image_file_name"] for img in images] == ["a.png", "b.png"]

    def test_returns_none_on_schema_version_mismatch(self) -> None:
        payload = build_head_images_payload(_IMAGES, 0.1)
        payload["schema_version"] = HEAD_IMAGES_SCHEMA_VERSION + 999
        raw = orjson.dumps(payload)

        assert load_precomputed_head_images(_mock_session(raw), "k") is None

    def test_returns_none_when_images_key_absent(self) -> None:
        raw = orjson.dumps({"schema_version": HEAD_IMAGES_SCHEMA_VERSION, "diff_threshold": 0.1})

        assert load_precomputed_head_images(_mock_session(raw), "k") is None

    def test_returns_none_on_read_error(self) -> None:
        session = MagicMock()
        result = MagicMock()
        result.payload.read.side_effect = OSError("boom")
        session.get.return_value = result

        assert load_precomputed_head_images(session, "k") is None
