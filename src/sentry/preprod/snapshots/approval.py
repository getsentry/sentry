from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, NamedTuple

from django.utils import timezone
from objectstore_client import Session

from sentry import analytics
from sentry.preprod.analytics import PreprodStatusCheckApprovalCreatedEvent
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.comparison import SnapshotChanges, make_diff_candidate
from sentry.preprod.snapshots.manifest import (
    ChunkCandidate,
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonPlan,
    ImageFingerprint,
    SnapshotManifest,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison
from sentry.preprod.snapshots.storage import _get_json
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def _build_comparison_fingerprints(manifest: ComparisonManifest) -> set[ImageFingerprint]:
    fingerprints: set[ImageFingerprint] = set()
    for name, image in manifest.images.items():
        if image.status in ("unchanged", "skipped"):
            continue
        if image.status in ("changed", "added"):
            if not image.head_hash:
                continue
            fingerprints.add(ImageFingerprint(name, image.status, image.head_hash))
        elif image.status == "renamed":
            if not image.head_hash or not image.previous_image_file_name:
                continue
            fingerprints.add(
                ImageFingerprint(name, "renamed", image.head_hash, image.previous_image_file_name)
            )
        else:
            fingerprints.add(ImageFingerprint(name, image.status))
    return fingerprints


class _HashOnlyDiff(NamedTuple):
    name: str
    head_hash: str
    sibling_hash: str


def _hash_only_diffs(
    head: set[ImageFingerprint], sibling: set[ImageFingerprint]
) -> list[_HashOnlyDiff] | None:
    # None: names or statuses differ (structural). []: identical. Otherwise the
    # pairs that differ only by content hash and need a pixel diff.
    head_by_name = {fp.name: fp for fp in head}
    sibling_by_name = {fp.name: fp for fp in sibling}
    if head_by_name.keys() != sibling_by_name.keys():
        return None

    diffs: list[_HashOnlyDiff] = []
    for name in sorted(head_by_name):
        head_fp = head_by_name[name]
        sibling_fp = sibling_by_name[name]
        if head_fp == sibling_fp:
            continue
        if head_fp._replace(head_hash=None) != sibling_fp._replace(head_hash=None):
            return None
        if head_fp.head_hash is None or sibling_fp.head_hash is None:
            return None
        diffs.append(_HashOnlyDiff(name, head_fp.head_hash, sibling_fp.head_hash))
    return diffs


class SiblingComparison(NamedTuple):
    artifact_id: int
    comparison_key: str
    manifest: ComparisonManifest
    snapshot_manifest: SnapshotManifest


def _find_approved_sibling(
    head_artifact: PreprodArtifact, session: Session
) -> SiblingComparison | None:
    cc = head_artifact.commit_comparison
    if not cc or not cc.pr_number or not cc.head_repo_name:
        return None

    approved_sibling = (
        PreprodArtifact.objects.filter(
            project_id=head_artifact.project_id,
            app_id=head_artifact.app_id,
            build_configuration=head_artifact.build_configuration,
            commit_comparison__pr_number=cc.pr_number,
            commit_comparison__head_repo_name=cc.head_repo_name,
            preprodcomparisonapproval__preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            preprodcomparisonapproval__approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            # Human approvals only: chaining through auto-approvals would let
            # sub-threshold drift compound across rebuilds.
            preprodcomparisonapproval__extras__auto_approval__isnull=True,
            preprodsnapshotmetrics__snapshot_comparisons_head_metrics__state=PreprodSnapshotComparison.State.SUCCESS,
        )
        .exclude(id=head_artifact.id)
        .order_by("-date_added")
        .first()
    )
    if not approved_sibling:
        return None

    sibling_comparison = (
        PreprodSnapshotComparison.objects.filter(
            head_snapshot_metrics__preprod_artifact=approved_sibling,
            state=PreprodSnapshotComparison.State.SUCCESS,
        )
        .select_related("head_snapshot_metrics")
        .order_by("-date_updated")
        .first()
    )
    if not sibling_comparison:
        return None

    comparison_key = (sibling_comparison.extras or {}).get("comparison_key")
    if not comparison_key:
        return None

    try:
        manifest = _get_json(session, comparison_key, ComparisonManifest)
    except Exception:
        logger.exception(
            "auto_approve: failed to load sibling comparison manifest",
            extra={
                "head_artifact_id": head_artifact.id,
                "sibling_artifact_id": approved_sibling.id,
                "comparison_key": comparison_key,
            },
        )
        return None

    snapshot_manifest_key = (sibling_comparison.head_snapshot_metrics.extras or {}).get(
        "manifest_key"
    )
    if not snapshot_manifest_key:
        return None

    try:
        snapshot_manifest = _get_json(session, snapshot_manifest_key, SnapshotManifest)
    except Exception:
        logger.exception(
            "auto_approve: failed to load sibling snapshot manifest",
            extra={
                "head_artifact_id": head_artifact.id,
                "sibling_artifact_id": approved_sibling.id,
                "manifest_key": snapshot_manifest_key,
            },
        )
        return None

    return SiblingComparison(approved_sibling.id, comparison_key, manifest, snapshot_manifest)


def _try_auto_approve_snapshot(
    head_artifact: PreprodArtifact,
    comparison_manifest: ComparisonManifest,
    plan: ComparisonPlan,
    sibling_images: dict[str, ComparisonImageResult],
    session: Session,
) -> None:
    if plan.sibling_artifact_id is None or not plan.sibling_comparison_key:
        return

    head_fingerprints = _build_comparison_fingerprints(comparison_manifest)
    if not head_fingerprints:
        return

    log_extra = {
        "head_artifact_id": head_artifact.id,
        "sibling_artifact_id": plan.sibling_artifact_id,
    }
    if plan.sibling_fingerprints is not None:
        sibling_fingerprints = {ImageFingerprint(*values) for values in plan.sibling_fingerprints}
    else:
        try:
            sibling_manifest = _get_json(session, plan.sibling_comparison_key, ComparisonManifest)
        except Exception:
            logger.exception(
                "auto_approve: failed to load sibling comparison manifest",
                extra={**log_extra, "comparison_key": plan.sibling_comparison_key},
            )
            return
        sibling_fingerprints = _build_comparison_fingerprints(sibling_manifest)

    decision = decide_approval(head_fingerprints, sibling_fingerprints, sibling_images)
    if decision.reason == "structure_mismatch":
        logger.info("auto_approve: fingerprints do not match", extra=log_extra)
        return
    if decision.reason == "evidence_mismatch":
        metrics.incr("preprod.snapshots.auto_approve.threshold_mismatch")
        rejected = sibling_images.get(decision.image_name or "")
        logger.info(
            "auto_approve: sibling diff rejected",
            extra={
                **log_extra,
                "image_name": decision.image_name,
                "status": rejected.status if rejected else None,
            },
        )
        return
    if decision.reason != "approved":
        return
    if decision.threshold_matches:
        metrics.incr("preprod.snapshots.auto_approve.threshold_match")

    PreprodComparisonApproval.objects.create(
        preprod_artifact=head_artifact,
        preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
        approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        approved_at=timezone.now(),
        extras={
            "auto_approval": True,
            "prev_approved_artifact_id": plan.sibling_artifact_id,
            "threshold_matched_image_count": decision.threshold_matches,
        },
    )

    analytics.record(
        PreprodStatusCheckApprovalCreatedEvent(
            organization_id=head_artifact.project.organization_id,
            project_id=head_artifact.project_id,
            artifact_id=head_artifact.id,
            product="snapshots",
            source="auto",
        )
    )

    logger.info(
        "auto_approve: snapshot auto-approved",
        extra={
            **log_extra,
            "prev_approved_artifact_id": plan.sibling_artifact_id,
            "organization_slug": head_artifact.project.organization.slug,
            "threshold_matched_image_count": decision.threshold_matches,
        },
    )


def plan_approval_diffs(
    head_manifest: SnapshotManifest, changes: SnapshotChanges, sibling: SiblingComparison
) -> list[ChunkCandidate]:
    metadata_by_hash = {
        metadata.content_hash: metadata for metadata in sibling.snapshot_manifest.images.values()
    }
    names = {candidate.name for candidate in changes.candidates} | {
        name for name, result in changes.images.items() if result.status in ("added", "renamed")
    }
    candidates: list[ChunkCandidate] = []
    for name in sorted(names):
        previous = sibling.manifest.images.get(name)
        if previous is None or previous.status not in ("changed", "added", "renamed"):
            continue
        if not previous.head_hash or previous.head_hash == head_manifest.images[name].content_hash:
            continue
        metadata = metadata_by_hash.get(previous.head_hash)
        if metadata is None:
            continue
        candidate = make_diff_candidate(head_manifest, name, metadata, kind="sibling")
        if candidate is not None:
            candidates.append(candidate)
    return candidates


@dataclass(frozen=True)
class ApprovalDecision:
    reason: Literal["approved", "no_changes", "structure_mismatch", "evidence_mismatch"]
    threshold_matches: int = 0
    image_name: str | None = None


def decide_approval(
    head: set[ImageFingerprint],
    sibling: set[ImageFingerprint],
    evidence: dict[str, ComparisonImageResult],
) -> ApprovalDecision:
    if not head:
        return ApprovalDecision("no_changes")
    differences = _hash_only_diffs(head, sibling)
    if differences is None:
        return ApprovalDecision("structure_mismatch")
    for difference in differences:
        measurement = evidence.get(difference.name)
        if (
            measurement is None
            or measurement.status != "unchanged"
            or measurement.head_hash != difference.head_hash
            or measurement.base_hash != difference.sibling_hash
        ):
            return ApprovalDecision("evidence_mismatch", image_name=difference.name)
    return ApprovalDecision("approved", threshold_matches=len(differences))
