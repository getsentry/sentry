import logging
from typing import Any, cast

import pytest

from sentry.preprod.api.models.public.snapshots import SnapshotImageResponseDict
from sentry.preprod.snapshots.comparison_categorizer import (
    CategorizedComparison,
    categorize_comparison_images,
)

_SKIPPED = {
    "status": "skipped",
    "base_hash": "base_hash",
    "before_width": 300,
    "before_height": 400,
}


class TestCategorizeComparisonImagesSkipped:
    def test_skipped_falls_back_without_base_manifest(self) -> None:
        result = categorize_comparison_images({"s.png": _SKIPPED}, {}, None)

        assert len(result.skipped) == 1
        assert result.skipped[0]["key"] == "base_hash"
        assert result.skipped[0]["width"] == 300


class TestCategorizeComparisonImagesUnexpectedStatus:
    def test_unexpected_status_is_dropped_and_logged(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        with caplog.at_level(
            logging.WARNING, logger="sentry.preprod.snapshots.comparison_categorizer"
        ):
            result = categorize_comparison_images(
                {"weird.png": {"status": "bogus", "base_hash": "b"}}, {}, {}
            )

        assert result == CategorizedComparison()
        assert len(caplog.records) == 1
        record = caplog.records[0]
        assert record.getMessage() == "preprod.snapshot.unexpected_comparison_status"
        assert record.__dict__["status"] == "bogus"
        assert record.__dict__["image_file_name"] == "weird.png"


class TestCategorizeComparisonImagesAllStatuses:
    def _base_images(self) -> dict[str, dict]:
        return {
            "changed_a.png": {
                "content_hash": "base_ca",
                "display_name": "Changed A",
                "group": "g1",
                "width": 10,
                "height": 20,
                "description": "desc-ca",
                "tags": {"t": "v"},
                "platform": "ios",
            },
            "changed_b.png": {"content_hash": "base_cb", "width": 11, "height": 21},
            "removed.png": {
                "content_hash": "base_rm",
                "display_name": "Removed",
                "group": "g2",
                "width": 12,
                "height": 22,
                "description": "desc-rm",
                "tags": {"k": "1"},
                "canvas_theme": "dark",
                "region": "eu",
            },
            "old_name.png": {"content_hash": "base_old", "width": 13, "height": 23},
            "unchanged.png": {"content_hash": "base_un", "width": 14, "height": 24},
            "errored.png": {"content_hash": "base_er", "width": 15, "height": 25},
            "skipped.png": {"content_hash": "base_sk", "width": 16, "height": 26},
        }

    def _comparison_images(self) -> dict[str, dict]:
        return {
            "changed_a.png": {
                "status": "changed",
                "changed_pixels": 25,
                "total_pixels": 100,
                "diff_mask_image_id": "mask_a",
            },
            "changed_b.png": {
                "status": "changed",
                "changed_pixels": 90,
                "total_pixels": 100,
                "diff_mask_image_id": "mask_b",
            },
            "added.png": {"status": "added"},
            "removed.png": {"status": "removed", "base_hash": "base_rm"},
            "renamed.png": {"status": "renamed", "previous_image_file_name": "old_name.png"},
            "unchanged.png": {"status": "unchanged"},
            "errored.png": {"status": "errored", "head_hash": "head_er", "base_hash": "base_er"},
            "skipped.png": {
                "status": "skipped",
                "base_hash": "base_sk",
                "before_width": 99,
                "before_height": 98,
            },
        }

    def _head_images(self) -> dict[str, SnapshotImageResponseDict]:
        names = [
            "changed_a.png",
            "changed_b.png",
            "added.png",
            "renamed.png",
            "unchanged.png",
            "errored.png",
        ]
        return {
            n: SnapshotImageResponseDict(
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
        result = categorize_comparison_images(self._comparison_images(), heads, self._base_images())

        assert len(result.changed) == 2
        # sorted by diff descending: changed_b (0.9) before changed_a (0.25)
        assert result.changed[0]["head_image"]["image_file_name"] == "changed_b.png"
        assert result.changed[0]["diff"] == 0.9
        assert result.changed[0]["diff_image_key"] == "mask_b"
        assert result.changed[0]["base_image"]["key"] == "base_cb"
        assert result.changed[1]["head_image"]["image_file_name"] == "changed_a.png"
        assert result.changed[1]["diff"] == 0.25
        assert result.changed[1]["base_image"]["key"] == "base_ca"
        assert result.changed[1]["base_image"]["group"] == "g1"
        # description/tags/platform are passthrough extras not declared on the TypedDict.
        changed_base = cast(dict[str, Any], result.changed[1]["base_image"])
        assert changed_base["description"] == "desc-ca"
        assert changed_base["tags"] == {"t": "v"}
        assert changed_base["platform"] == "ios"

    def test_buckets_partition_all_images(self) -> None:
        result = categorize_comparison_images(
            self._comparison_images(), self._head_images(), self._base_images()
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
        result = categorize_comparison_images(self._comparison_images(), heads, self._base_images())
        assert len(result.added) == 1
        assert result.added[0] is heads["added.png"]

    def test_removed_uses_base_manifest(self) -> None:
        result = categorize_comparison_images(
            self._comparison_images(), self._head_images(), self._base_images()
        )
        assert len(result.removed) == 1
        assert result.removed[0]["key"] == "base_rm"
        assert result.removed[0]["width"] == 12
        assert result.removed[0]["canvas_theme"] == "dark"
        # region is a passthrough extra not declared on the TypedDict.
        assert cast(dict[str, Any], result.removed[0])["region"] == "eu"

    def test_renamed_resolves_base_via_previous_name(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison_images(), heads, self._base_images())
        assert len(result.renamed) == 1
        assert result.renamed[0]["head_image"] == heads["renamed.png"]
        assert result.renamed[0]["base_image"]["key"] == "base_old"

    def test_unchanged_uses_head_only(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison_images(), heads, self._base_images())
        assert len(result.unchanged) == 1
        assert result.unchanged[0] is heads["unchanged.png"]

    def test_errored_uses_base_and_head(self) -> None:
        heads = self._head_images()
        result = categorize_comparison_images(self._comparison_images(), heads, self._base_images())
        assert len(result.errored) == 1
        assert result.errored[0]["head_image"] == heads["errored.png"]
        assert result.errored[0]["base_image"]["key"] == "base_er"

    def test_skipped_uses_base_manifest(self) -> None:
        result = categorize_comparison_images(
            self._comparison_images(), self._head_images(), self._base_images()
        )
        assert len(result.skipped) == 1
        assert result.skipped[0]["key"] == "base_sk"
        assert result.skipped[0]["width"] == 16

    def test_changed_falls_back_when_base_missing(self) -> None:
        comparison_images = {
            "only_head.png": {
                "status": "changed",
                "base_hash": "cmp_base",
                "changed_pixels": 1,
                "total_pixels": 4,
                "before_width": 7,
                "before_height": 8,
            }
        }
        heads = {
            "only_head.png": SnapshotImageResponseDict(
                key="h",
                display_name="only_head.png",
                image_file_name="only_head.png",
                width=1,
                height=2,
            )
        }
        # base manifest does NOT contain only_head.png
        result = categorize_comparison_images(comparison_images, heads, {})
        assert len(result.changed) == 1
        assert result.changed[0]["base_image"]["key"] == "cmp_base"
        assert result.changed[0]["base_image"]["width"] == 7
