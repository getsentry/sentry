from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.tasks import (
    _chunk_result_key,
    _comparison_key,
    _diff_mask_key,
    _plan_key,
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


def test_build_comparison_plan_exceeds_pixel_limit():
    from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
    from sentry.preprod.snapshots.tasks import MAX_DIFF_PIXELS, _build_comparison_plan

    oversized = MAX_DIFF_PIXELS + 1
    head = SnapshotManifest(
        images={"huge.png": ImageMetadata(content_hash="h1", width=oversized, height=1)},
        diff_threshold=None,
    )
    base = SnapshotManifest(
        images={"huge.png": ImageMetadata(content_hash="h0", width=oversized, height=1)},
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
