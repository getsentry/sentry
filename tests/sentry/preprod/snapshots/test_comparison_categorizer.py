from sentry.preprod.snapshots.comparison_categorizer import categorize_comparison_images
from sentry.preprod.snapshots.manifest import (
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonSummary,
    ImageMetadata,
    SnapshotManifest,
)

_SKIPPED = ComparisonImageResult(
    status="skipped", base_hash="base_hash", before_width=300, before_height=400
)

_EMPTY_SUMMARY = ComparisonSummary(
    total=1, changed=0, unchanged=0, added=0, removed=0, errored=0, renamed=0, skipped=1
)


class TestCategorizeComparisonImagesSkipped:
    def test_skipped_uses_base_image(self) -> None:
        base = SnapshotManifest(
            images={"s.png": ImageMetadata(content_hash="base_hash", width=300, height=400)}
        )
        manifest = ComparisonManifest(
            head_artifact_id=1,
            base_artifact_id=2,
            summary=_EMPTY_SUMMARY,
            images={"s.png": _SKIPPED},
        )

        result = categorize_comparison_images(manifest, {}, base)

        assert len(result.skipped) == 1
        assert result.skipped[0].image_file_name == "s.png"
        assert result.skipped[0].width == 300

    def test_skipped_falls_back_without_base_manifest(self) -> None:
        manifest = ComparisonManifest(
            head_artifact_id=1,
            base_artifact_id=2,
            summary=_EMPTY_SUMMARY,
            images={"s.png": _SKIPPED},
        )

        result = categorize_comparison_images(manifest, {}, None)

        assert len(result.skipped) == 1
        assert result.skipped[0].key == "base_hash"
        assert result.skipped[0].width == 300
