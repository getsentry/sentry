from __future__ import annotations

from concurrent.futures import as_completed
from dataclasses import dataclass
from typing import NamedTuple

import orjson
from objectstore_client import RequestError, Session
from pydantic import ValidationError

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.categorize import categorize_image_sets
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

MAX_CHAIN_DEPTH = 50
MANIFEST_FETCH_MAX_WORKERS = 16


def fold_child_onto_parent(
    child: SnapshotManifest, parent_complete: SnapshotManifest
) -> SnapshotManifest:
    """Project a selective child manifest onto its complete parent to produce the child's
    complete post-build state.

    matched + added -> the child's image version
    skipped         -> inherited from the (complete) parent
    removed         -> dropped

    The result is a complete (non-selective) manifest. diff_threshold is intentionally left
    unset: the comparison engine reads thresholds only from the head, never the base.
    """
    matched, added, removed, skipped = categorize_image_sets(child, parent_complete)

    resolved: dict[str, ImageMetadata] = {}
    # Safe to index directly: categorize_image_sets guarantees matched|added are child
    # names and skipped are parent names.
    for name in matched | added:
        resolved[name] = child.images[name]
    for name in skipped:
        resolved[name] = parent_complete.images[name]

    return SnapshotManifest(images=resolved, selective=False)


@dataclass
class ReconstructionResult:
    manifest: SnapshotManifest | None = None
    incomplete: bool = False  # an ancestor manifest is not uploaded yet -> defer
    unresolvable: bool = False  # no complete ancestor / cycle / depth cap / corrupt -> terminal
    error_message: str | None = None  # accurate detail for the terminal (unresolvable) case


class _ManifestRead(NamedTuple):
    manifest: SnapshotManifest | None
    corrupt: bool = False  # the object exists but is malformed -> permanent (terminal)


def _manifest_key(artifact: PreprodArtifact) -> str | None:
    metrics = getattr(artifact, "preprodsnapshotmetrics", None)
    if metrics is None:
        return None
    return (metrics.extras or {}).get("manifest_key")


def _read_manifest_by_key(session: Session, key: str) -> _ManifestRead:
    """Fetch and parse a manifest. Pure objectstore I/O — no ORM access, so this is safe to
    run from a worker thread (see _fetch_manifests)."""
    try:
        payload = session.get(key).payload.read()
    except RequestError:
        # Object not found / transient objectstore error: may still arrive -> defer.
        return _ManifestRead(None)
    try:
        return _ManifestRead(SnapshotManifest(**orjson.loads(payload)))
    except (orjson.JSONDecodeError, ValidationError, TypeError):
        # The object exists but is malformed: this never self-heals by waiting, so flag
        # it as corrupt and let the walk terminate instead of burning the grace window.
        return _ManifestRead(None, corrupt=True)


def _resolve_ancestor(artifact: PreprodArtifact) -> PreprodArtifact | None:
    cc = artifact.commit_comparison
    if cc is None or not cc.base_sha:
        return None
    return (
        PreprodArtifact.objects.filter(
            commit_comparison__organization_id=cc.organization_id,
            commit_comparison__head_sha=cc.base_sha,
            commit_comparison__head_repo_name=cc.base_repo_name or cc.head_repo_name,
            project_id=artifact.project_id,
            preprodsnapshotmetrics__isnull=False,
            app_id=artifact.app_id,
            artifact_type=artifact.artifact_type,
            build_configuration=artifact.build_configuration,
        )
        .select_related("preprodsnapshotmetrics", "commit_comparison")
        .order_by("-date_added")
        .first()
    )


def _collect_chain(base_artifact: PreprodArtifact) -> tuple[list[PreprodArtifact], bool]:
    """Walk the commit-ancestry chain from base to its natural terminus using only the
    normalized CommitComparison links — no manifest I/O. Returns (chain, ancestor_missing),
    where chain is [base, ..., deepest ancestor] and ancestor_missing is True iff the deepest
    build references a base_sha whose ancestor build has not been uploaded yet.

    Discovery is kept separate from manifest reads so the reads can be issued in parallel
    (see _fetch_manifests). Completeness is still decided from the manifests themselves
    (in reconstruct_base_manifest), so this never consults the drift-prone is_selective flag.
    """
    chain: list[PreprodArtifact] = []
    visited: set[int] = set()
    current: PreprodArtifact | None = base_artifact

    while current is not None:
        if current.id in visited or len(chain) >= MAX_CHAIN_DEPTH:
            return chain, False
        visited.add(current.id)
        chain.append(current)

        ancestor = _resolve_ancestor(current)
        if ancestor is None:
            cc = current.commit_comparison
            return chain, cc is not None and bool(cc.base_sha)
        current = ancestor

    return chain, False


def _fetch_manifests(
    session: Session, artifacts: list[PreprodArtifact]
) -> dict[int, _ManifestRead]:
    """Read each artifact's manifest, fanning the objectstore gets across a thread pool.

    Manifest keys are resolved here in the calling thread (ORM access); the worker threads do
    pure objectstore I/O only. Concurrent gets on a shared Session are safe (urllib3
    connection pool); this mirrors the fan-out in zip_builder.py.
    """
    keys = {artifact.id: _manifest_key(artifact) for artifact in artifacts}
    results: dict[int, _ManifestRead] = {
        artifact_id: _ManifestRead(None) for artifact_id, key in keys.items() if not key
    }
    pending = {artifact_id: key for artifact_id, key in keys.items() if key}

    if len(pending) <= 1:
        for artifact_id, key in pending.items():
            results[artifact_id] = _read_manifest_by_key(session, key)
        return results

    executor = ContextPropagatingThreadPoolExecutor(max_workers=MANIFEST_FETCH_MAX_WORKERS)
    try:
        futures = {
            executor.submit(_read_manifest_by_key, session, key): artifact_id
            for artifact_id, key in pending.items()
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
    return results


def reconstruct_base_manifest(
    base_artifact: PreprodArtifact, session: Session
) -> ReconstructionResult:
    """Reconstruct the complete manifest for base_artifact by folding the ancestry chain.

    Walks down to the nearest non-selective (complete) ancestor collecting selective layers,
    then folds them back up onto that complete manifest. Chain discovery (cheap CommitComparison
    lookups) and manifest reads (objectstore I/O) are split into two phases so the reads run
    in parallel instead of one sequential round-trip per level.
    """
    chain, ancestor_missing = _collect_chain(base_artifact)
    if not chain:
        return ReconstructionResult(unresolvable=True)

    manifests = _fetch_manifests(session, chain)

    selective_layers: list[SnapshotManifest] = []
    for artifact in chain:
        read = manifests[artifact.id]
        if read.corrupt:
            return ReconstructionResult(
                unresolvable=True,
                error_message="A base snapshot manifest in the ancestry chain is corrupt or unreadable.",
            )
        manifest = read.manifest
        if manifest is None:
            return ReconstructionResult(incomplete=True)

        # The manifest is the single source of truth for completeness. categorize_image_sets
        # (used by the fold) keys off these same manifest flags, so the walk and the fold can
        # never disagree about whether a build is a complete anchor vs a selective layer.
        # (Don't consult the DB is_selective flag here — it could drift from the manifest.)
        if not manifest.selective and manifest.all_image_file_names is None:
            complete = manifest
            for layer in reversed(selective_layers):
                complete = fold_child_onto_parent(layer, complete)
            return ReconstructionResult(manifest=complete)

        selective_layers.append(manifest)

    # The whole chain was selective with no complete anchor. If the deepest build's ancestor
    # simply hasn't been uploaded yet it may still arrive (defer); otherwise no complete
    # reference can ever exist (terminal).
    if ancestor_missing:
        return ReconstructionResult(incomplete=True)
    return ReconstructionResult(unresolvable=True)
