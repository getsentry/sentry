import io
from unittest.mock import MagicMock, patch

from PIL import Image, PngImagePlugin

from sentry.preprod.snapshots.image_diff.types import DiffResult
from sentry.preprod.snapshots.manifest import (
    ChunkAssignment,
    ChunkCandidate,
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonSummary,
    ImageMetadata,
    SnapshotManifest,
)
from sentry.preprod.snapshots.tasks import (
    SiblingComparison,
    _build_comparison_plan,
    _chunk_result_key,
    _comparison_key,
    _diff_mask_key,
    _effective_diff_threshold,
    _plan_key,
    _process_chunk,
    categorize_image_diff,
)


def test_objectstore_key_layout():
    assert _plan_key(1, 2, 3, 4) == "1/2/3/4/plan.json"
    assert _chunk_result_key(1, 2, 3, 4, 5) == "1/2/3/4/chunks/5.json"
    assert _comparison_key(1, 2, 3, 4) == "1/2/3/4/comparison.json"
    assert _diff_mask_key(1, 2, 3, 4, "foo/bar") == "1/2/3/4/diff/foo/bar.png"


def _meta(content_hash: str) -> ImageMetadata:
    return ImageMetadata(content_hash=content_hash, width=100, height=200)


class TestCategorizeImageDiff:
    def test_basic_rename(self) -> None:
        head = SnapshotManifest(images={"new.png": _meta("hash_a")})
        base = SnapshotManifest(images={"old.png": _meta("hash_a")})

        result = categorize_image_diff(head, base)

        assert result.renamed_pairs == [("new.png", "old.png")]
        assert result.added == set()
        assert result.removed == set()

    def test_no_rename_when_hashes_differ(self) -> None:
        head = SnapshotManifest(images={"a.png": _meta("hash_1")})
        base = SnapshotManifest(images={"b.png": _meta("hash_2")})

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 0
        assert result.added == {"a.png"}
        assert result.removed == {"b.png"}

    def test_same_name_same_hash_is_matched_not_renamed(self) -> None:
        head = SnapshotManifest(images={"screen.png": _meta("hash_a")})
        base = SnapshotManifest(images={"screen.png": _meta("hash_a")})

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 0
        assert result.added == set()
        assert result.removed == set()
        assert result.matched == {"screen.png"}

    def test_mixed_renames_adds_removes(self) -> None:
        head = SnapshotManifest(
            images={
                "renamed.png": _meta("hash_shared"),
                "brand_new.png": _meta("hash_new"),
                "unchanged.png": _meta("hash_same"),
            }
        )
        base = SnapshotManifest(
            images={
                "old_name.png": _meta("hash_shared"),
                "deleted.png": _meta("hash_gone"),
                "unchanged.png": _meta("hash_same"),
            }
        )

        result = categorize_image_diff(head, base)

        assert result.renamed_pairs == [("renamed.png", "old_name.png")]
        assert result.added == {"brand_new.png"}
        assert result.removed == {"deleted.png"}

    def test_multiple_independent_renames(self) -> None:
        head = SnapshotManifest(images={"new_a.png": _meta("hash_a"), "new_b.png": _meta("hash_b")})
        base = SnapshotManifest(images={"old_a.png": _meta("hash_a"), "old_b.png": _meta("hash_b")})

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 2
        rename_dict = dict(result.renamed_pairs)
        assert rename_dict["new_a.png"] == "old_a.png"
        assert rename_dict["new_b.png"] == "old_b.png"

    def test_duplicate_hash_renames_matched_by_name_similarity(self) -> None:
        head = SnapshotManifest(
            images={
                "badge-dark-beta.png": _meta("hash_same"),
                "badge-light-beta.png": _meta("hash_same"),
            }
        )
        base = SnapshotManifest(
            images={
                "old/badge-dark-beta.png": _meta("hash_same"),
                "old/badge-light-beta.png": _meta("hash_same"),
            }
        )

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 2
        rename_dict = dict(result.renamed_pairs)
        assert rename_dict["badge-dark-beta.png"] == "old/badge-dark-beta.png"
        assert rename_dict["badge-light-beta.png"] == "old/badge-light-beta.png"
        assert result.added == set()
        assert result.removed == set()

    def test_asymmetric_duplicate_hash_partial_rename(self) -> None:
        head = SnapshotManifest(
            images={
                "new-a.png": _meta("hash_dup"),
                "new-b.png": _meta("hash_dup"),
                "new-c.png": _meta("hash_dup"),
            }
        )
        base = SnapshotManifest(
            images={
                "old-a.png": _meta("hash_dup"),
                "old-b.png": _meta("hash_dup"),
            }
        )

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 2
        assert result.removed == set()
        assert len(result.added) == 1


class TestCategorizeImageDiffSelective:
    def test_selective_all_categories(self) -> None:
        head = SnapshotManifest(
            images={"new.png": _meta("h_new"), "matched.png": _meta("h1")},
            selective=True,
            all_image_file_names=["new.png", "matched.png", "skipped.png"],
        )
        base = SnapshotManifest(
            images={
                "matched.png": _meta("h1"),
                "skipped.png": _meta("h2"),
                "deleted.png": _meta("h3"),
            }
        )

        result = categorize_image_diff(head, base)

        assert result.added == {"new.png"}
        assert result.matched == {"matched.png"}
        assert result.skipped == {"skipped.png"}
        assert result.removed == {"deleted.png"}

    def test_selective_none_is_full_build(self) -> None:
        head = SnapshotManifest(images={"a.png": _meta("h1")})
        base = SnapshotManifest(images={"a.png": _meta("h1"), "b.png": _meta("h2")})

        result = categorize_image_diff(head, base)

        assert result.removed == {"b.png"}
        assert result.skipped == set()

    def test_selective_rename_old_name_not_in_list(self) -> None:
        head = SnapshotManifest(
            images={"new.png": _meta("shared")},
            selective=True,
            all_image_file_names=["new.png"],
        )
        base = SnapshotManifest(images={"old.png": _meta("shared")})

        result = categorize_image_diff(head, base)

        assert result.renamed_pairs == [("new.png", "old.png")]
        assert result.removed == set()

    def test_selective_rename_old_name_in_list(self) -> None:
        head = SnapshotManifest(
            images={"new.png": _meta("shared")},
            selective=True,
            all_image_file_names=["new.png", "old.png"],
        )
        base = SnapshotManifest(images={"old.png": _meta("shared")})

        result = categorize_image_diff(head, base)

        assert result.renamed_pairs == [("new.png", "old.png")]
        assert result.skipped == set()

    def test_selective_rename_same_hash_in_removed_and_skipped(self) -> None:
        head = SnapshotManifest(
            images={"new.png": _meta("shared")},
            selective=True,
            all_image_file_names=["new.png", "in_list.png"],
        )
        base = SnapshotManifest(
            images={
                "not_in_list.png": _meta("shared"),
                "in_list.png": _meta("shared"),
            }
        )

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 1
        assert result.renamed_pairs[0] == ("new.png", "not_in_list.png")
        assert result.skipped == {"in_list.png"}
        assert result.added == set()
        assert result.removed == set()

    def test_selective_duplicate_hash_skipped_rename(self) -> None:
        head = SnapshotManifest(
            images={
                "new-dark.png": _meta("hash_dup"),
                "new-light.png": _meta("hash_dup"),
                "new-extra.png": _meta("hash_dup"),
            },
            selective=True,
            all_image_file_names=["new-dark.png", "new-light.png", "new-extra.png", "skip.png"],
        )
        base = SnapshotManifest(
            images={
                "old-dark.png": _meta("hash_dup"),
                "old-light.png": _meta("hash_dup"),
                "skip.png": _meta("hash_dup"),
            }
        )

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 3
        assert result.added == set()
        assert result.removed == set()
        assert result.skipped == set()

    def test_selective_empty_subset(self) -> None:
        head = SnapshotManifest(images={}, selective=True, all_image_file_names=["a.png", "b.png"])
        base = SnapshotManifest(images={"a.png": _meta("h1"), "b.png": _meta("h2")})

        result = categorize_image_diff(head, base)

        assert result.skipped == {"a.png", "b.png"}
        assert result.removed == set()

    def test_selective_without_names_all_missing_are_skipped(self) -> None:
        head = SnapshotManifest(
            images={"a.png": _meta("h1")},
            selective=True,
        )
        base = SnapshotManifest(
            images={"a.png": _meta("h1"), "b.png": _meta("h2"), "c.png": _meta("h3")}
        )

        result = categorize_image_diff(head, base)

        assert result.skipped == {"b.png", "c.png"}
        assert result.removed == set()
        assert result.matched == {"a.png"}


def test_build_comparison_plan_splits_diff_and_non_diff():
    from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
    from sentry.preprod.snapshots.tasks import _build_comparison_plan

    head = SnapshotManifest(
        images={
            "changed.png": ImageMetadata(content_hash="h1", width=100, height=100),
            "same.png": ImageMetadata(content_hash="sameh", width=10, height=10),
            "new.png": ImageMetadata(content_hash="n1", width=10, height=10),
        },
        diff_threshold=None,
    )
    base = SnapshotManifest(
        images={
            "changed.png": ImageMetadata(content_hash="h0", width=100, height=100),
            "same.png": ImageMetadata(content_hash="sameh", width=10, height=10),
            "gone.png": ImageMetadata(content_hash="g0", width=10, height=10),
        },
        diff_threshold=None,
    )

    plan = _build_comparison_plan(head, base, head_artifact_id=1, base_artifact_id=2)

    diff_names = {c.name for chunk in plan.chunks for c in chunk.candidates}
    assert diff_names == {"changed.png"}
    assert plan.non_diff_images["same.png"].status == "unchanged"
    assert plan.non_diff_images["new.png"].status == "added"
    assert plan.non_diff_images["gone.png"].status == "removed"


def test_build_comparison_plan_diff_threshold_precedence():
    from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
    from sentry.preprod.snapshots.tasks import _build_comparison_plan

    head = SnapshotManifest(
        images={
            "per_image.png": ImageMetadata(
                content_hash="h1", width=10, height=10, diff_threshold=0.25
            ),
            "manifest_level.png": ImageMetadata(content_hash="m1", width=10, height=10),
        },
        diff_threshold=0.1,
    )
    base = SnapshotManifest(
        images={
            "per_image.png": ImageMetadata(content_hash="h0", width=10, height=10),
            "manifest_level.png": ImageMetadata(content_hash="m0", width=10, height=10),
        },
        diff_threshold=0.1,
    )

    plan = _build_comparison_plan(head, base, head_artifact_id=1, base_artifact_id=2)

    thresholds = {c.name: c.diff_threshold for chunk in plan.chunks for c in chunk.candidates}
    assert thresholds == {"per_image.png": 0.25, "manifest_level.png": 0.1}


def test_build_comparison_plan_diff_threshold_defaults_to_zero():
    from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
    from sentry.preprod.snapshots.tasks import _build_comparison_plan

    head = SnapshotManifest(
        images={"default.png": ImageMetadata(content_hash="h1", width=10, height=10)},
        diff_threshold=None,
    )
    base = SnapshotManifest(
        images={"default.png": ImageMetadata(content_hash="h0", width=10, height=10)},
        diff_threshold=None,
    )

    plan = _build_comparison_plan(head, base, head_artifact_id=1, base_artifact_id=2)

    thresholds = {c.name: c.diff_threshold for chunk in plan.chunks for c in chunk.candidates}
    assert thresholds == {"default.png": 0.0}


def test_build_comparison_plan_uses_comparison_dimensions_for_pixel_limit():
    from sentry.preprod.snapshots.image_diff.compare import MAX_DIFF_PIXELS
    from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
    from sentry.preprod.snapshots.tasks import _build_comparison_plan

    head = SnapshotManifest(
        images={"huge.png": ImageMetadata(content_hash="h1", width=MAX_DIFF_PIXELS, height=1)},
        diff_threshold=None,
    )
    base = SnapshotManifest(
        images={"huge.png": ImageMetadata(content_hash="h0", width=1, height=2)},
        diff_threshold=None,
    )

    plan = _build_comparison_plan(head, base, head_artifact_id=1, base_artifact_id=2)

    diff_names = {c.name for chunk in plan.chunks for c in chunk.candidates}
    assert "huge.png" not in diff_names
    assert plan.non_diff_images["huge.png"].status == "errored"
    assert plan.non_diff_images["huge.png"].reason == "exceeds_pixel_limit"


def test_build_comparison_plan_detects_rename():
    from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
    from sentry.preprod.snapshots.tasks import _build_comparison_plan

    head = SnapshotManifest(
        images={"new.png": ImageMetadata(content_hash="shared", width=10, height=10)},
        diff_threshold=None,
    )
    base = SnapshotManifest(
        images={"old.png": ImageMetadata(content_hash="shared", width=10, height=10)},
        diff_threshold=None,
    )

    plan = _build_comparison_plan(head, base, head_artifact_id=1, base_artifact_id=2)

    assert plan.non_diff_images["new.png"].status == "renamed"
    assert plan.non_diff_images["new.png"].previous_image_file_name == "old.png"
    assert "old.png" not in plan.non_diff_images


def test_process_chunk_enforces_actual_batch_pixel_limit():
    assignment = ChunkAssignment(
        chunk_index=0,
        candidates=[
            ChunkCandidate(
                name=name,
                head_hash=f"{name}-head",
                base_hash=f"{name}-base",
                pixel_count=1,
                diff_threshold=0,
            )
            for name in ("first", "second")
        ],
    )
    buffer = io.BytesIO()
    Image.new("RGBA", (10, 10)).save(buffer, format="PNG")
    fetched = {
        image_hash: buffer.getvalue()
        for candidate in assignment.candidates
        for image_hash in (candidate.head_hash, candidate.base_hash)
    }

    with (
        patch("sentry.preprod.snapshots.tasks.MAX_PIXELS_PER_BATCH", 150),
        patch(
            "sentry.preprod.snapshots.tasks._fetch_batch_images",
            return_value=(fetched, set()),
        ),
        patch(
            "sentry.preprod.snapshots.tasks.compare_images_batch", return_value=[None]
        ) as compare,
        patch.object(PngImagePlugin.PngImageFile, "load") as load,
        patch("sentry.preprod.snapshots.tasks.OdiffServer"),
    ):
        result = _process_chunk(MagicMock(), assignment, 1, 2, 3, 4)

    assert result.images["first"].reason == "image_processing_failed"
    assert result.images["second"].reason == "exceeds_batch_pixel_limit"
    assert len(compare.call_args.args[0]) == 1
    load.assert_not_called()


def test_process_chunk_routes_sibling_candidates_without_diff_mask() -> None:
    assignment = ChunkAssignment(
        chunk_index=0,
        candidates=[
            ChunkCandidate(
                name="a.png",
                head_hash="a-head",
                base_hash="a-base",
                pixel_count=1,
                diff_threshold=0.0,
            ),
            ChunkCandidate(
                name="a.png",
                head_hash="a-head",
                base_hash="a-sib",
                pixel_count=1,
                diff_threshold=0.5,
                kind="sibling",
            ),
        ],
    )
    buffer = io.BytesIO()
    Image.new("RGBA", (10, 10)).save(buffer, format="PNG")
    fetched = {h: buffer.getvalue() for h in ("a-head", "a-base", "a-sib")}
    diff_result = DiffResult(
        diff_mask_png=b"png",
        changed_pixels=10,
        total_pixels=100,
        aligned_height=10,
        before_width=10,
        before_height=10,
        after_width=10,
        after_height=10,
    )
    session = MagicMock()
    with (
        patch("sentry.preprod.snapshots.tasks._fetch_batch_images", return_value=(fetched, set())),
        patch(
            "sentry.preprod.snapshots.tasks.compare_images_batch",
            return_value=[diff_result, diff_result],
        ),
        patch("sentry.preprod.snapshots.tasks.OdiffServer"),
        patch("sentry.preprod.snapshots.tasks._put_diff_mask") as put_mask,
    ):
        result = _process_chunk(session, assignment, 1, 2, 3, 4)

    assert set(result.images) == {"a.png"}
    assert result.images["a.png"].status == "changed"
    assert result.images["a.png"].diff_mask_key is not None
    assert set(result.sibling_images) == {"a.png"}
    sibling = result.sibling_images["a.png"]
    assert sibling.status == "unchanged"
    assert sibling.head_hash == "a-head"
    assert sibling.base_hash == "a-sib"
    assert sibling.changed_pixels == 10
    assert sibling.diff_mask_key is None
    assert put_mask.call_count == 1


def test_process_chunk_sibling_fetch_failure_is_errored_in_sibling_images() -> None:
    assignment = ChunkAssignment(
        chunk_index=0,
        candidates=[
            ChunkCandidate(
                name="a.png",
                head_hash="a-head",
                base_hash="a-sib",
                pixel_count=1,
                diff_threshold=0.0,
                kind="sibling",
            ),
        ],
    )
    with (
        patch("sentry.preprod.snapshots.tasks._fetch_batch_images", return_value=({}, {"a-sib"})),
        patch("sentry.preprod.snapshots.tasks.compare_images_batch", return_value=[]),
        patch("sentry.preprod.snapshots.tasks.OdiffServer"),
    ):
        result = _process_chunk(MagicMock(), assignment, 1, 2, 3, 4)

    assert result.images == {}
    assert result.sibling_images["a.png"].status == "errored"
    assert result.sibling_images["a.png"].reason == "image_fetch_failed"


def _threshold_manifest(
    image_threshold: float | None, manifest_threshold: float | None
) -> SnapshotManifest:
    return SnapshotManifest(
        images={
            "screen.png": ImageMetadata(
                content_hash="abc", width=10, height=10, diff_threshold=image_threshold
            )
        },
        diff_threshold=manifest_threshold,
    )


def test_effective_diff_threshold_prefers_image_value() -> None:
    manifest = _threshold_manifest(image_threshold=0.2, manifest_threshold=0.5)
    assert _effective_diff_threshold(manifest, "screen.png") == 0.2


def test_effective_diff_threshold_falls_back_to_manifest_value() -> None:
    manifest = _threshold_manifest(image_threshold=None, manifest_threshold=0.5)
    assert _effective_diff_threshold(manifest, "screen.png") == 0.5


def test_effective_diff_threshold_defaults_to_zero() -> None:
    manifest = _threshold_manifest(image_threshold=None, manifest_threshold=None)
    assert _effective_diff_threshold(manifest, "screen.png") == 0.0


def test_effective_diff_threshold_unknown_image_uses_manifest_value() -> None:
    manifest = _threshold_manifest(image_threshold=0.2, manifest_threshold=0.5)
    assert _effective_diff_threshold(manifest, "missing.png") == 0.5


def test_chunk_candidate_kind_defaults_to_base() -> None:
    candidate = ChunkCandidate(
        name="a.png", head_hash="h", base_hash="b", pixel_count=1, diff_threshold=0.0
    )
    assert candidate.kind == "base"


def test_plan_and_chunk_result_parse_without_sibling_fields() -> None:
    from sentry.preprod.snapshots.manifest import ChunkResult, ComparisonPlan

    plan = ComparisonPlan(head_artifact_id=1, base_artifact_id=2, chunks=[], non_diff_images={})
    assert plan.sibling_artifact_id is None
    assert plan.sibling_comparison_key is None
    result = ChunkResult(chunk_index=0, images={})
    assert result.sibling_images == {}


def _sibling(artifact_id: int, images: dict[str, ComparisonImageResult]) -> SiblingComparison:
    manifest = ComparisonManifest(
        head_artifact_id=artifact_id,
        base_artifact_id=0,
        summary=ComparisonSummary(
            total=len(images), changed=0, unchanged=0, added=0, removed=0, errored=0, renamed=0
        ),
        images=images,
    )
    return SiblingComparison(artifact_id, f"key/{artifact_id}/comparison.json", manifest)


def _manifest(
    images: dict[str, tuple[str, int, int]], diff_threshold: float | None = None
) -> SnapshotManifest:
    return SnapshotManifest(
        images={
            name: ImageMetadata(content_hash=h, width=w, height=hgt)
            for name, (h, w, hgt) in images.items()
        },
        diff_threshold=diff_threshold,
    )


def test_build_comparison_plan_without_sibling_has_no_sibling_candidates() -> None:
    head = _manifest({"a.png": ("a2", 10, 10)})
    base = _manifest({"a.png": ("a1", 10, 10)})
    plan = _build_comparison_plan(head, base, 1, 2)
    assert plan.sibling_artifact_id is None
    assert plan.sibling_comparison_key is None
    kinds = [c.kind for chunk in plan.chunks for c in chunk.candidates]
    assert kinds == ["base"]


def test_build_comparison_plan_adds_sibling_candidates_for_hash_differing_interesting_images() -> (
    None
):
    head = _manifest(
        {
            "changed.png": ("c-head", 10, 10),
            "added.png": ("add-head", 20, 20),
            "renamed.png": ("ren-head", 10, 10),
            "same.png": ("same", 10, 10),
        },
        diff_threshold=0.05,
    )
    base = _manifest(
        {
            "changed.png": ("c-base", 10, 10),
            "old.png": ("ren-head", 10, 10),
            "same.png": ("same", 10, 10),
        }
    )
    sibling = _sibling(
        7,
        {
            "changed.png": ComparisonImageResult(
                status="changed", head_hash="c-sib", base_hash="c-base"
            ),
            "added.png": ComparisonImageResult(status="added", head_hash="add-head"),
            "renamed.png": ComparisonImageResult(
                status="renamed", head_hash="ren-sib", previous_image_file_name="old.png"
            ),
            "same.png": ComparisonImageResult(
                status="unchanged", head_hash="same", base_hash="same"
            ),
        },
    )
    plan = _build_comparison_plan(head, base, 1, 2, sibling=sibling)
    assert plan.sibling_artifact_id == 7
    assert plan.sibling_comparison_key == "key/7/comparison.json"
    sibling_candidates = {
        c.name: c for chunk in plan.chunks for c in chunk.candidates if c.kind == "sibling"
    }
    assert set(sibling_candidates) == {"changed.png", "renamed.png"}
    assert sibling_candidates["changed.png"].head_hash == "c-head"
    assert sibling_candidates["changed.png"].base_hash == "c-sib"
    assert sibling_candidates["changed.png"].pixel_count == 100
    assert sibling_candidates["changed.png"].diff_threshold == 0.05
    assert sibling_candidates["renamed.png"].base_hash == "ren-sib"
    base_names = {c.name for chunk in plan.chunks for c in chunk.candidates if c.kind == "base"}
    assert base_names == {"changed.png"}


def test_build_comparison_plan_sibling_pixel_count_uses_larger_dimensions() -> None:
    head = _manifest({"changed.png": ("c-head", 10, 10)})
    base = _manifest({"changed.png": ("c-base", 10, 10)})
    sibling = _sibling(
        7,
        {
            "changed.png": ComparisonImageResult(
                status="changed",
                head_hash="c-sib",
                base_hash="c-base",
                after_width=30,
                after_height=20,
            ),
        },
    )
    plan = _build_comparison_plan(head, base, 1, 2, sibling=sibling)
    candidates = {(c.kind, c.name): c for chunk in plan.chunks for c in chunk.candidates}
    assert candidates[("sibling", "changed.png")].pixel_count == 600
    assert candidates[("base", "changed.png")].pixel_count == 100


def test_build_comparison_plan_sibling_pixel_count_falls_back_to_head_dimensions() -> None:
    head = _manifest({"changed.png": ("c-head", 10, 10)})
    base = _manifest({"changed.png": ("c-base", 10, 10)})
    sibling = _sibling(
        7,
        {"changed.png": ComparisonImageResult(status="added", head_hash="c-sib")},
    )
    plan = _build_comparison_plan(head, base, 1, 2, sibling=sibling)
    sibling_candidates = {
        c.name: c for chunk in plan.chunks for c in chunk.candidates if c.kind == "sibling"
    }
    assert sibling_candidates["changed.png"].pixel_count == 100


def test_build_comparison_plan_records_sibling_without_candidates_when_disabled() -> None:
    head = _manifest(
        {
            "changed.png": ("c-head", 10, 10),
            "added.png": ("add-head", 20, 20),
            "renamed.png": ("ren-head", 10, 10),
            "same.png": ("same", 10, 10),
        },
        diff_threshold=0.05,
    )
    base = _manifest(
        {
            "changed.png": ("c-base", 10, 10),
            "old.png": ("ren-head", 10, 10),
            "same.png": ("same", 10, 10),
        }
    )
    sibling = _sibling(
        7,
        {
            "changed.png": ComparisonImageResult(
                status="changed", head_hash="c-sib", base_hash="c-base"
            ),
            "added.png": ComparisonImageResult(status="added", head_hash="add-head"),
            "renamed.png": ComparisonImageResult(
                status="renamed", head_hash="ren-sib", previous_image_file_name="old.png"
            ),
            "same.png": ComparisonImageResult(
                status="unchanged", head_hash="same", base_hash="same"
            ),
        },
    )
    plan = _build_comparison_plan(head, base, 1, 2, sibling=sibling, diff_sibling_images=False)
    assert plan.sibling_artifact_id == 7
    assert plan.sibling_comparison_key == "key/7/comparison.json"
    kinds = [c.kind for chunk in plan.chunks for c in chunk.candidates]
    assert "sibling" not in kinds


def test_build_comparison_plan_skips_sibling_candidate_for_unchanged_head_image() -> None:
    head = _manifest({"same.png": ("same", 10, 10)})
    base = _manifest({"same.png": ("same", 10, 10)})
    sibling = _sibling(
        7, {"same.png": ComparisonImageResult(status="changed", head_hash="other", base_hash="x")}
    )
    plan = _build_comparison_plan(head, base, 1, 2, sibling=sibling)
    assert plan.chunks == []


def test_build_comparison_plan_skips_sibling_candidate_over_pixel_limit() -> None:
    head = _manifest({"big.png": ("b-head", 7000, 7000)})
    base = _manifest({"big.png": ("b-base", 10, 10)})
    sibling = _sibling(
        7, {"big.png": ComparisonImageResult(status="changed", head_hash="b-sib", base_hash="x")}
    )
    plan = _build_comparison_plan(head, base, 1, 2, sibling=sibling)
    assert all(c.kind == "base" for chunk in plan.chunks for c in chunk.candidates)
    assert plan.non_diff_images["big.png"].reason == "exceeds_pixel_limit"
