import jsonschema

from sentry.preprod.snapshots.manifest import (
    ImageMetadata,
    SnapshotManifest,
    image_metadata_extras,
)


def _meta(**kwargs: object) -> dict:
    defaults: dict = {"content_hash": "abc123", "width": 100, "height": 200}
    defaults.update(kwargs)
    return defaults


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


class TestImageMetadataCanvasTheme:
    def test_canvas_theme_none(self) -> None:
        assert ImageMetadata(**_meta()).canvas_theme is None

    def test_canvas_theme_light(self) -> None:
        assert ImageMetadata(**_meta(canvas_theme="light")).canvas_theme == "light"

    def test_canvas_theme_dark(self) -> None:
        assert ImageMetadata(**_meta(canvas_theme="dark")).canvas_theme == "dark"

    def test_canvas_theme_unknown_value_becomes_none(self) -> None:
        assert ImageMetadata(**_meta(canvas_theme="sepia")).canvas_theme is None

    def test_canvas_theme_unexpected_type_becomes_none(self) -> None:
        assert ImageMetadata(**_meta(canvas_theme=42)).canvas_theme is None

    def test_manifest_round_trip_drops_unknown_theme(self) -> None:
        # Mirrors the POST ingest path, which builds a SnapshotManifest: an
        # invalid theme is coerced to None instead of rejecting the upload.
        manifest = SnapshotManifest(images={"a.png": _meta(canvas_theme="sepia")})
        assert manifest.images["a.png"].canvas_theme is None


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


def test_comparison_plan_round_trip():
    from sentry.preprod.snapshots.manifest import (
        ChunkAssignment,
        ChunkCandidate,
        ComparisonImageResult,
        ComparisonPlan,
    )

    plan = ComparisonPlan(
        head_artifact_id=1,
        base_artifact_id=2,
        chunks=[
            ChunkAssignment(
                chunk_index=0,
                candidates=[
                    ChunkCandidate(
                        name="a.png",
                        head_hash="h",
                        base_hash="b",
                        pixel_count=10,
                        diff_threshold=0.0,
                    )
                ],
            )
        ],
        non_diff_images={"x.png": ComparisonImageResult(status="added")},
    )
    restored = ComparisonPlan(**plan.dict())
    assert restored.chunks[0].candidates[0].name == "a.png"
    assert restored.chunks[0].candidates[0].diff_threshold == 0.0
    assert restored.non_diff_images["x.png"].status == "added"


def test_chunk_result_round_trip():
    from sentry.preprod.snapshots.manifest import ChunkResult, ComparisonImageResult

    result = ChunkResult(chunk_index=3, images={"a.png": ComparisonImageResult(status="changed")})
    restored = ChunkResult(**result.dict())
    assert restored.chunk_index == 3
    assert restored.images["a.png"].status == "changed"


def _reference_extras(metadata: ImageMetadata, exclude: set[str] | None = None) -> dict:
    schema_fields = frozenset(ImageMetadata.__fields__)
    skip = schema_fields | exclude if exclude else schema_fields
    return {k: v for k, v in metadata.dict().items() if k not in skip}


class TestImageMetadataExtras:
    def test_no_extras(self) -> None:
        meta = ImageMetadata(**_meta())
        assert image_metadata_extras(meta) == _reference_extras(meta)
        assert image_metadata_extras(meta) == {}

    def test_scalar_extras(self) -> None:
        meta = ImageMetadata(**_meta(platform="ios", build=42, flagged=True))
        assert image_metadata_extras(meta) == _reference_extras(meta)
        assert image_metadata_extras(meta) == {"platform": "ios", "build": 42, "flagged": True}

    def test_nested_extras(self) -> None:
        meta = ImageMetadata(**_meta(meta_obj={"nested": {"x": 1}}, meta_list=[1, 2, 3]))
        assert image_metadata_extras(meta) == _reference_extras(meta)

    def test_with_exclude_schema_field(self) -> None:
        meta = ImageMetadata(**_meta(platform="android"))
        result = image_metadata_extras(meta, exclude={"key", "image_file_name"})
        assert result == _reference_extras(meta, exclude={"key", "image_file_name"})
        assert result == {"platform": "android"}

    def test_exclude_removes_declared_field(self) -> None:
        meta = ImageMetadata(**_meta(platform="ios"))
        result = image_metadata_extras(meta, exclude={"width"})
        assert result == _reference_extras(meta, exclude={"width"})
