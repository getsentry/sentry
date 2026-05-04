from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.tasks import categorize_image_diff


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
