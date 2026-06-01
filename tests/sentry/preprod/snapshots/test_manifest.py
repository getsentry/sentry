import jsonschema
import pydantic
import pytest

from sentry.preprod.snapshots.manifest import (
    ImageMetadata,
    InvalidImageNamePattern,
    SnapshotManifest,
    make_image_name_matcher,
)


def _meta(**kwargs: object) -> dict:
    defaults: dict = {"content_hash": "abc123", "width": 100, "height": 200}
    defaults.update(kwargs)
    return defaults


class TestSnapshotManifestHeadImageNameMatcher:
    def test_no_declared_set_returns_none(self) -> None:
        manifest = SnapshotManifest(images={})
        assert manifest.head_image_name_matcher() is None

    def test_literal_names_matcher(self) -> None:
        manifest = SnapshotManifest(images={}, all_image_file_names=["a.png", "b.png"])
        matches_head_image = manifest.head_image_name_matcher()
        assert matches_head_image is not None
        assert matches_head_image("a.png")
        assert not matches_head_image("c.png")

    def test_regex_matcher_uses_full_match(self) -> None:
        manifest = SnapshotManifest(images={}, all_image_file_names_as_regex=[r"login\.png"])
        matches_head_image = manifest.head_image_name_matcher()
        assert matches_head_image is not None
        assert matches_head_image("login.png")
        assert not matches_head_image("screens/login.png")

    def test_both_fields_set_is_rejected(self) -> None:
        with pytest.raises(pydantic.ValidationError):
            SnapshotManifest(
                images={},
                all_image_file_names=["a.png"],
                all_image_file_names_as_regex=[r"a\.png"],
            )

    def test_make_image_name_matcher_rejects_unsupported_construct(self) -> None:
        with pytest.raises(InvalidImageNamePattern) as exc:
            make_image_name_matcher([r"a(?=b)"])
        assert exc.value.pattern == r"a(?=b)"
        with pytest.raises(InvalidImageNamePattern):
            make_image_name_matcher([r"(a)\1"])


class TestImageMetadataTagsCoercion:
    def test_tags_none(self) -> None:
        meta = ImageMetadata(**_meta())
        assert meta.tags is None

    def test_tags_dict_passthrough(self) -> None:
        tags = {"theme": "dark", "device": "phone"}
        meta = ImageMetadata(**_meta(tags=tags))
        assert meta.tags == tags

    def test_tags_list_converted_to_dict(self) -> None:
        meta = ImageMetadata(**_meta(tags=["dark", "mobile"]))
        assert meta.tags == {"dark": "dark", "mobile": "mobile"}

    def test_tags_single_item_list(self) -> None:
        meta = ImageMetadata(**_meta(tags=["solo"]))
        assert meta.tags == {"solo": "solo"}

    def test_tags_empty_list(self) -> None:
        meta = ImageMetadata(**_meta(tags=[]))
        assert meta.tags == {}

    def test_tags_empty_dict(self) -> None:
        meta = ImageMetadata(**_meta(tags={}))
        assert meta.tags == {}

    def test_tags_unexpected_type_becomes_none(self) -> None:
        meta = ImageMetadata(**_meta(tags=42))
        assert meta.tags is None

    def test_tags_string_becomes_none(self) -> None:
        meta = ImageMetadata(**_meta(tags="not_a_dict_or_list"))
        assert meta.tags is None

    def test_manifest_with_dict_tags(self) -> None:
        manifest = SnapshotManifest(
            images={
                "screen.png": _meta(tags={"theme": "dark", "size": "large"}),
            }
        )
        assert manifest.images["screen.png"].tags == {"theme": "dark", "size": "large"}

    def test_manifest_with_legacy_list_tags(self) -> None:
        manifest = SnapshotManifest(
            images={
                "screen.png": _meta(tags=["dark", "mobile"]),
            }
        )
        assert manifest.images["screen.png"].tags == {"dark": "dark", "mobile": "mobile"}

    def test_tags_boolean_values_coerced_to_strings(self) -> None:
        meta = ImageMetadata(**_meta(tags={"dark_mode": True, "rtl": False}))
        assert meta.tags == {"dark_mode": "True", "rtl": "False"}

    def test_tags_numeric_values_coerced_to_strings(self) -> None:
        meta = ImageMetadata(**_meta(tags={"count": 42, "ratio": 1.5}))
        assert meta.tags == {"count": "42", "ratio": "1.5"}


class TestImageMetadataJsonSchema:
    def test_schema_accepts_dict_tags(self) -> None:
        schema = ImageMetadata.schema()
        jsonschema.validate(_meta(tags={"theme": "dark"}), schema)

    def test_schema_accepts_list_tags(self) -> None:
        schema = ImageMetadata.schema()
        jsonschema.validate(_meta(tags=["dark", "mobile"]), schema)

    def test_schema_accepts_null_tags(self) -> None:
        schema = ImageMetadata.schema()
        jsonschema.validate(_meta(tags=None), schema)

    def test_schema_accepts_no_tags(self) -> None:
        schema = ImageMetadata.schema()
        jsonschema.validate(_meta(), schema)

    def test_schema_accepts_boolean_tag_values(self) -> None:
        schema = ImageMetadata.schema()
        jsonschema.validate(_meta(tags={"dark_mode": True}), schema)

    def test_schema_accepts_numeric_tag_values(self) -> None:
        schema = ImageMetadata.schema()
        jsonschema.validate(_meta(tags={"count": 42}), schema)
