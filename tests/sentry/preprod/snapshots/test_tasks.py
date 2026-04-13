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
