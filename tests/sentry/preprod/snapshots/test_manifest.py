import pytest
from pydantic import ValidationError

from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest


def _meta(**kwargs: object) -> dict:
    defaults: dict = {"content_hash": "abc123", "width": 100, "height": 200}
    defaults.update(kwargs)
    return defaults


class TestImageMetadataTags:
    def test_tags_none(self) -> None:
        meta = ImageMetadata(**_meta())
        assert meta.tags is None

    def test_tags_dict(self) -> None:
        tags = {"theme": "dark", "device": "phone"}
        meta = ImageMetadata(**_meta(tags=tags))
        assert meta.tags == tags

    def test_tags_empty_dict(self) -> None:
        meta = ImageMetadata(**_meta(tags={}))
        assert meta.tags == {}

    def test_tags_list_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ImageMetadata(**_meta(tags=["dark", "mobile"]))

    def test_tags_string_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ImageMetadata(**_meta(tags="not_a_dict"))

    def test_tags_int_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ImageMetadata(**_meta(tags=42))

    def test_manifest_with_dict_tags(self) -> None:
        manifest = SnapshotManifest(
            images={
                "screen.png": _meta(tags={"theme": "dark", "size": "large"}),
            }
        )
        assert manifest.images["screen.png"].tags == {"theme": "dark", "size": "large"}
