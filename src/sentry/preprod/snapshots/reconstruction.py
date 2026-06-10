from __future__ import annotations

from dataclasses import dataclass

import orjson
from objectstore_client import RequestError, Session
from pydantic import ValidationError

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.categorize import categorize_image_sets
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest

MAX_CHAIN_DEPTH = 50


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
    unresolvable: bool = False  # no complete ancestor / cycle / depth cap -> terminal


def _read_manifest(session: Session, artifact: PreprodArtifact) -> SnapshotManifest | None:
    metrics = getattr(artifact, "preprodsnapshotmetrics", None)
    if metrics is None:
        return None
    key = (metrics.extras or {}).get("manifest_key")
    if not key:
        return None
    try:
        payload = session.get(key).payload.read()
    except RequestError:
        return None
    try:
        return SnapshotManifest(**orjson.loads(payload))
    except (orjson.JSONDecodeError, ValidationError, TypeError):
        # Corrupt/invalid ancestor manifest: treat as unavailable (defer within the
        # grace window) rather than letting the exception escape and bypass the
        # structured reconstruction-incomplete path.
        return None


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


def reconstruct_base_manifest(
    base_artifact: PreprodArtifact, session: Session
) -> ReconstructionResult:
    """Reconstruct the complete manifest for base_artifact by folding the ancestry chain.

    Walks down to the nearest non-selective (complete) ancestor collecting selective layers,
    then folds them back up onto that complete manifest.
    """
    selective_layers: list[SnapshotManifest] = []
    current: PreprodArtifact | None = base_artifact
    visited: set[int] = set()

    while current is not None:
        if current.id in visited or len(visited) >= MAX_CHAIN_DEPTH:
            return ReconstructionResult(unresolvable=True)
        visited.add(current.id)

        manifest = _read_manifest(session, current)
        if manifest is None:
            return ReconstructionResult(incomplete=True)

        metrics = getattr(current, "preprodsnapshotmetrics", None)
        if metrics is not None and not metrics.is_selective:
            complete = manifest
            for layer in reversed(selective_layers):
                complete = fold_child_onto_parent(layer, complete)
            return ReconstructionResult(manifest=complete)

        selective_layers.append(manifest)
        ancestor = _resolve_ancestor(current)
        if ancestor is None:
            cc = current.commit_comparison
            if cc is not None and cc.base_sha:
                # The ancestor build hasn't been uploaded yet; it may still arrive.
                return ReconstructionResult(incomplete=True)
            # Selective build with no base to anchor on -> no complete reference exists.
            return ReconstructionResult(unresolvable=True)
        current = ancestor

    return ReconstructionResult(unresolvable=True)
