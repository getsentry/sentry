from sentry.preprod.api.models.snapshots.project_preprod_snapshot_models import (
    SnapshotImageResponse,
)
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


def _full_summary() -> ComparisonSummary:
    return ComparisonSummary(
        total=8, changed=2, unchanged=1, added=1, removed=1, errored=1, renamed=1, skipped=1
    )


class TestCategorizeComparisonImagesAllStatuses:
    def _base_manifest(self) -> SnapshotManifest:
        return SnapshotManifest(
            images={
                "changed_a.png": ImageMetadata(
                    content_hash="base_ca",
                    display_name="Changed A",
                    group="g1",
                    width=10,
                    height=20,
                    description="desc-ca",
                    tags={"t": "v"},
                    platform="ios",
                ),
                "changed_b.png": ImageMetadata(content_hash="base_cb", width=11, height=21),
                "removed.png": ImageMetadata(
                    content_hash="base_rm",
                    display_name="Removed",
                    group="g2",
                    width=12,
                    height=22,
                    description="desc-rm",
                    tags={"k": "1"},
                    region="eu",
                ),
                "old_name.png": ImageMetadata(content_hash="base_old", width=13, height=23),
                "unchanged.png": ImageMetadata(content_hash="base_un", width=14, height=24),
                "errored.png": ImageMetadata(content_hash="base_er", width=15, height=25),
                "skipped.png": ImageMetadata(content_hash="base_sk", width=16, height=26),
            }
        )

    def _comparison(self) -> ComparisonManifest:
        return ComparisonManifest(
            head_artifact_id=1,
            base_artifact_id=2,
            summary=_full_summary(),
            images={
                "changed_a.png": ComparisonImageResult(
                    status="changed",
                    changed_pixels=25,
                    total_pixels=100,
                    diff_mask_image_id="mask_a",
                ),
                "changed_b.png": ComparisonImageResult(
                    status="changed",
                    changed_pixels=90,
                    total_pixels=100,
                    diff_mask_image_id="mask_b",
                ),
                "added.png": ComparisonImageResult(status="added"),
                "removed.png": ComparisonImageResult(status="removed", base_hash="base_rm"),
                "renamed.png": ComparisonImageResult(
                    status="renamed", previous_image_file_name="old_name.png"
                ),
                "unchanged.png": ComparisonImageResult(status="unchanged"),
                "errored.png": ComparisonImageResult(
                    status="errored",
                    head_hash="head_er",
                    base_hash="base_er",
                ),
                "skipped.png": ComparisonImageResult(
                    status="skipped",
                    base_hash="base_sk",
                    before_width=99,
                    before_height=98,
                ),
            },
        )

    def _head_images(self) -> dict[str, SnapshotImageResponse]:
        names = [
            "changed_a.png",
            "changed_b.png",
            "added.png",
            "renamed.png",
            "unchanged.png",
            "errored.png",
        ]
        return {
            n: SnapshotImageResponse(
                key=f"head_{n}",
                display_name=n,
                image_file_name=n,
                width=1,
                height=2,
            )
            for n in names
        }

    def test_changed_uses_base_and_head_and_diff(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison(), heads, self._base_manifest())

        assert len(result.changed) == 2
        # sorted by diff descending: changed_b (0.9) before changed_a (0.25)
        assert result.changed[0].head_image.image_file_name == "changed_b.png"
        assert result.changed[0].diff == 0.9
        assert result.changed[0].diff_image_key == "mask_b"
        assert result.changed[0].base_image.key == "base_cb"
        assert result.changed[1].head_image.image_file_name == "changed_a.png"
        assert result.changed[1].diff == 0.25
        assert result.changed[1].base_image.key == "base_ca"
        assert result.changed[1].base_image.group == "g1"
        changed_base = result.changed[1].base_image.dict()
        assert changed_base["description"] == "desc-ca"
        assert changed_base["tags"] == {"t": "v"}
        assert changed_base["platform"] == "ios"

    def test_buckets_partition_all_images(self) -> None:
        result = categorize_comparison_images(
            self._comparison(), self._head_images(), self._base_manifest()
        )
        assert len(result.changed) == 2
        assert len(result.added) == 1
        assert len(result.removed) == 1
        assert len(result.renamed) == 1
        assert len(result.unchanged) == 1
        assert len(result.errored) == 1
        assert len(result.skipped) == 1

    def test_added_uses_head_only(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison(), heads, self._base_manifest())
        assert len(result.added) == 1
        assert result.added[0] is heads["added.png"]

    def test_removed_uses_base_manifest(self) -> None:
        result = categorize_comparison_images(
            self._comparison(), self._head_images(), self._base_manifest()
        )
        assert len(result.removed) == 1
        assert result.removed[0].key == "base_rm"
        assert result.removed[0].width == 12
        assert result.removed[0].dict()["region"] == "eu"

    def test_renamed_resolves_base_via_previous_name(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison(), heads, self._base_manifest())
        assert len(result.renamed) == 1
        assert result.renamed[0].head_image == heads["renamed.png"]
        assert result.renamed[0].base_image.key == "base_old"

    def test_unchanged_uses_head_only(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison(), heads, self._base_manifest())
        assert len(result.unchanged) == 1
        assert result.unchanged[0] is heads["unchanged.png"]

    def test_errored_uses_base_and_head(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison(), heads, self._base_manifest())
        assert len(result.errored) == 1
        assert result.errored[0].head_image == heads["errored.png"]
        assert result.errored[0].base_image.key == "base_er"

    def test_skipped_uses_base_manifest(self) -> None:
        result = categorize_comparison_images(
            self._comparison(), self._head_images(), self._base_manifest()
        )
        assert len(result.skipped) == 1
        assert result.skipped[0].key == "base_sk"
        assert result.skipped[0].width == 16

    def test_changed_falls_back_when_base_missing(self) -> None:
        comparison = ComparisonManifest(
            head_artifact_id=1,
            base_artifact_id=2,
            summary=_full_summary(),
            images={
                "only_head.png": ComparisonImageResult(
                    status="changed",
                    base_hash="cmp_base",
                    changed_pixels=1,
                    total_pixels=4,
                    before_width=7,
                    before_height=8,
                )
            },
        )
        heads = {
            "only_head.png": SnapshotImageResponse(
                key="h",
                display_name="only_head.png",
                image_file_name="only_head.png",
                width=1,
                height=2,
            )
        }
        # base manifest does NOT contain only_head.png
        result = categorize_comparison_images(comparison, heads, SnapshotManifest(images={}))
        assert len(result.changed) == 1
        assert result.changed[0].base_image.key == "cmp_base"
        assert result.changed[0].base_image.width == 7
