from __future__ import annotations

from sentry.preprod.snapshots.manifest import SnapshotManifest


def categorize_image_sets(
    head_manifest: SnapshotManifest, base_manifest: SnapshotManifest
) -> tuple[set[str], set[str], set[str], set[str]]:
    """Categorize image *names* into (matched, added, removed, skipped) by selective mode.

    The base is treated as the authoritative complete set. Only the head's selective flags
    drive classification:
      - all_image_file_names given: removals are names in base but not in the declared set.
      - selective, no list: nothing removed; base names not uploaded are skipped.
      - full: base names not in head are removed.
    """
    head_names = set(head_manifest.images.keys())
    base_names = set(base_manifest.images.keys())

    matched = head_names & base_names
    added = head_names - base_names

    all_image_file_names = head_manifest.all_image_file_names
    if all_image_file_names is not None:
        all_names_set = set(all_image_file_names)
        removed = base_names - all_names_set
        skipped = (all_names_set - head_names) & base_names
    elif head_manifest.selective:
        removed = set()
        skipped = base_names - head_names
    else:
        removed = base_names - head_names
        skipped = set()

    return matched, added, removed, skipped
