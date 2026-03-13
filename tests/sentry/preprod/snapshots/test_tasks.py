from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.tasks import categorize_image_diff


def _meta(name: str) -> ImageMetadata:
    return ImageMetadata(image_file_name=name, width=100, height=200)


class TestCategorizeImageDiff:
    def test_basic_rename(self):
        head = SnapshotManifest(images={"hash_a": _meta("new.png")})
        base = SnapshotManifest(images={"hash_a": _meta("old.png")})

        result = categorize_image_diff(head, base)

        assert result.renamed_pairs == [("new.png", "old.png")]
        assert result.added == set()
        assert result.removed == set()

    def test_no_rename_when_hashes_differ(self):
        head = SnapshotManifest(images={"hash_1": _meta("a.png")})
        base = SnapshotManifest(images={"hash_2": _meta("b.png")})

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 0
        assert result.added == {"a.png"}
        assert result.removed == {"b.png"}

    def test_same_name_same_hash_is_matched_not_renamed(self):
        head = SnapshotManifest(images={"hash_a": _meta("screen.png")})
        base = SnapshotManifest(images={"hash_a": _meta("screen.png")})

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 0
        assert result.added == set()
        assert result.removed == set()
        assert result.matched == {"screen.png"}

    def test_mixed_renames_adds_removes(self):
        head = SnapshotManifest(
            images={
                "hash_shared": _meta("renamed.png"),
                "hash_new": _meta("brand_new.png"),
                "hash_same": _meta("unchanged.png"),
            }
        )
        base = SnapshotManifest(
            images={
                "hash_shared": _meta("old_name.png"),
                "hash_gone": _meta("deleted.png"),
                "hash_same": _meta("unchanged.png"),
            }
        )

        result = categorize_image_diff(head, base)

        assert result.renamed_pairs == [("renamed.png", "old_name.png")]
        assert result.added == {"brand_new.png"}
        assert result.removed == {"deleted.png"}

    def test_multiple_independent_renames(self):
        head = SnapshotManifest(images={"hash_a": _meta("new_a.png"), "hash_b": _meta("new_b.png")})
        base = SnapshotManifest(images={"hash_a": _meta("old_a.png"), "hash_b": _meta("old_b.png")})

        result = categorize_image_diff(head, base)

        assert len(result.renamed_pairs) == 2
        rename_dict = dict(result.renamed_pairs)
        assert rename_dict["new_a.png"] == "old_a.png"
        assert rename_dict["new_b.png"] == "old_b.png"
