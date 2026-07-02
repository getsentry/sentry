from __future__ import annotations

from sentry.preprod.snapshots.categorize import categorize_image_sets
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest


def _m(
    names_to_hashes: dict[str, str],
    *,
    selective: bool = False,
    all_image_file_names: list[str] | None = None,
) -> SnapshotManifest:
    return SnapshotManifest(
        images={
            n: ImageMetadata(content_hash=h, width=10, height=10)
            for n, h in names_to_hashes.items()
        },
        selective=selective,
        all_image_file_names=all_image_file_names,
    )


def test_full_head_marks_missing_base_images_removed():
    head = _m({"a": "h1", "b": "h2"})
    base = _m({"a": "h0", "c": "h3"})
    matched, added, removed, skipped = categorize_image_sets(head, base)
    assert matched == {"a"}
    assert added == {"b"}
    assert removed == {"c"}
    assert skipped == set()


def test_selective_no_list_skips_uninvolved_base_images():
    head = _m({"a": "h1"}, selective=True)
    base = _m({"a": "h0", "c": "h3"})
    matched, added, removed, skipped = categorize_image_sets(head, base)
    assert matched == {"a"}
    assert added == set()
    assert removed == set()
    assert skipped == {"c"}


def test_selective_with_all_names_expresses_removals():
    head = _m({"a": "h1"}, selective=True, all_image_file_names=["a", "c"])
    base = _m({"a": "h0", "c": "h3", "d": "h4"})
    matched, added, removed, skipped = categorize_image_sets(head, base)
    assert matched == {"a"}
    assert added == set()
    assert removed == {"d"}  # in base but not in declared full set
    assert skipped == {"c"}  # declared, not uploaded, present in base
