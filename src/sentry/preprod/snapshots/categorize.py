from __future__ import annotations

from difflib import SequenceMatcher
from typing import NamedTuple

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


class _ImageDiffResult(NamedTuple):
    renamed_pairs: list[tuple[str, str]]
    added: set[str]
    removed: set[str]
    matched: set[str]
    head_by_name: dict[str, str]
    base_by_name: dict[str, str]
    skipped: set[str]


# When multiple added/removed files share the same content hash (e.g. dark/light
# theme variants), greedily pair them by filename similarity for rename detection.
def _match_by_name_similarity(
    added_names: list[str], removed_names: list[str]
) -> list[tuple[str, str]]:
    scored: list[tuple[float, int, int]] = []
    for ai, a in enumerate(added_names):
        for ri, r in enumerate(removed_names):
            scored.append((SequenceMatcher(None, a, r).ratio(), ai, ri))

    scored.sort(reverse=True)

    pairs: list[tuple[str, str]] = []
    used_added: set[int] = set()
    used_removed: set[int] = set()

    for _, ai, ri in scored:
        if ai in used_added or ri in used_removed:
            continue
        pairs.append((added_names[ai], removed_names[ri]))
        used_added.add(ai)
        used_removed.add(ri)

    return pairs


def categorize_image_diff(
    head_manifest: SnapshotManifest, base_manifest: SnapshotManifest
) -> _ImageDiffResult:
    head_by_name = {key: meta.content_hash for key, meta in head_manifest.images.items()}
    base_by_name = {key: meta.content_hash for key, meta in base_manifest.images.items()}

    matched, added, removed, skipped = categorize_image_sets(head_manifest, base_manifest)

    added_hash_to_names: dict[str, list[str]] = {}
    for name in added:
        h = head_by_name[name]
        added_hash_to_names.setdefault(h, []).append(name)

    removed_hash_to_names: dict[str, list[str]] = {}
    for name in removed:
        h = base_by_name[name]
        removed_hash_to_names.setdefault(h, []).append(name)

    renamed_pairs: list[tuple[str, str]] = []
    for h in added_hash_to_names.keys() & removed_hash_to_names.keys():
        a_names = added_hash_to_names[h]
        r_names = removed_hash_to_names[h]
        if len(a_names) == 1 and len(r_names) == 1:
            renamed_pairs.append((a_names[0], r_names[0]))
        else:
            renamed_pairs.extend(_match_by_name_similarity(a_names, r_names))

    for new_name, old_name in renamed_pairs:
        added.discard(new_name)
        removed.discard(old_name)
        h = head_by_name[new_name]
        if h in added_hash_to_names:
            names = added_hash_to_names[h]
            if new_name in names:
                names.remove(new_name)
            if not names:
                del added_hash_to_names[h]

    if skipped:
        skipped_hash_to_names: dict[str, list[str]] = {}
        for name in skipped:
            h = base_by_name[name]
            skipped_hash_to_names.setdefault(h, []).append(name)

        for h in added_hash_to_names.keys() & skipped_hash_to_names.keys():
            a_names = added_hash_to_names[h]
            s_names = skipped_hash_to_names[h]
            if len(a_names) == 1 and len(s_names) == 1:
                matched_pairs = [(a_names[0], s_names[0])]
            else:
                matched_pairs = _match_by_name_similarity(a_names, s_names)
            for a_name, s_name in matched_pairs:
                renamed_pairs.append((a_name, s_name))
                added.discard(a_name)
                skipped.discard(s_name)

    return _ImageDiffResult(
        renamed_pairs, added, removed, matched, head_by_name, base_by_name, skipped
    )
