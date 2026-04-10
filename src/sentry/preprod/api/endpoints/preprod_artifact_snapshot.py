from __future__ import annotations

import logging
from typing import Any

import jsonschema
import orjson
from django.conf import settings
from django.db import IntegrityError, router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationReleasePermission,
)
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models.commitcomparison import CommitComparison
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.objectstore import get_preprod_session
from sentry.preprod.analytics import (
    PreprodArtifactApiDeleteEvent,
    PreprodArtifactApiGetSnapshotDetailsEvent,
)
from sentry.preprod.api.models.project_preprod_build_details_models import (
    BuildDetailsVcsInfo,
)
from sentry.preprod.api.models.snapshots.project_preprod_snapshot_models import (
    SnapshotApprovalInfo,
    SnapshotApprover,
    SnapshotComparisonRunInfo,
    SnapshotDetailsApiResponse,
    SnapshotImageResponse,
)
from sentry.preprod.api.schemas import VCS_ERROR_MESSAGES, VCS_SCHEMA_PROPERTIES
from sentry.preprod.helpers.deletion import delete_artifacts_and_eap_data
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.comparison_categorizer import (
    CategorizedComparison,
    categorize_comparison_images,
)
from sentry.preprod.snapshots.manifest import (
    ComparisonManifest,
    ImageMetadata,
    SnapshotManifest,
)
from sentry.preprod.snapshots.models import (
    PreprodSnapshotComparison,
    PreprodSnapshotMetrics,
)
from sentry.preprod.snapshots.tasks import compare_snapshots
from sentry.preprod.snapshots.utils import (
    find_base_snapshot_artifact,
    find_head_snapshot_artifacts_awaiting_base,
)
from sentry.preprod.url_utils import get_preprod_artifact_url
from sentry.preprod.vcs.status_checks.snapshots.tasks import (
    create_preprod_snapshot_status_check_task,
)
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SNAPSHOT_POST_REQUEST_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "app_id": {"type": "string", "maxLength": 255},
        "images": {
            "type": "object",
            "additionalProperties": ImageMetadata.schema(),
            "maxProperties": 50000,
        },
        "diff_threshold": {"type": "number", "minimum": 0.0, "exclusiveMaximum": 1.0},
        **VCS_SCHEMA_PROPERTIES,
    },
    "required": ["app_id", "images"],
    "additionalProperties": True,
}

SNAPSHOT_POST_REQUEST_ERROR_MESSAGES: dict[str, str] = {
    "app_id": "The app_id field is required and must be a string with maximum length of 255 characters.",
    "images": "The images field is required and must be an object mapping image names to image metadata.",
    **VCS_ERROR_MESSAGES,
}


def validate_preprod_snapshot_post_schema(
    request_body: bytes,
) -> tuple[dict[str, Any], str | None]:
    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, SNAPSHOT_POST_REQUEST_SCHEMA)
        return data, None
    except jsonschema.ValidationError as e:
        error_message = e.message
        if e.path:
            if field := e.path[0]:
                error_message = SNAPSHOT_POST_REQUEST_ERROR_MESSAGES.get(str(field), error_message)
        return {}, error_message
    except (orjson.JSONDecodeError, TypeError):
        return {}, "Invalid json body"


@cell_silo_endpoint
class OrganizationPreprodSnapshotEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationReleasePermission,)

    def delete(self, request: Request, organization: Organization, snapshot_id: str) -> Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.select_related("project").get(
                id=snapshot_id, project__organization_id=organization.id
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "Snapshot not found"}, status=404)

        try:
            artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Artifact is not a snapshot"}, status=400)

        try:
            result = delete_artifacts_and_eap_data([artifact])
        except Exception:
            logger.exception(
                "preprod_snapshot.delete_failed",
                extra={"artifact_id": artifact.id},
            )
            return Response(
                {"detail": "Internal error deleting snapshot."},
                status=500,
            )

        analytics.record(
            PreprodArtifactApiDeleteEvent(
                organization_id=organization.id,
                project_id=artifact.project_id,
                user_id=(
                    request.user.id if request.user and request.user.is_authenticated else None
                ),
                artifact_id=str(artifact.id),
            )
        )

        logger.info(
            "preprod_snapshot.deleted",
            extra={
                "artifact_id": artifact.id,
                "user_id": request.user.id if request.user else None,
                "files_deleted": result.files_deleted,
                "size_metrics_deleted": result.size_metrics_deleted,
                "artifacts_deleted": result.artifacts_deleted,
            },
        )

        return Response(status=204)

    def get(self, request: Request, organization: Organization, snapshot_id: str) -> Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.select_related("commit_comparison").get(
                id=snapshot_id, project__organization_id=organization.id
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "Snapshot not found"}, status=404)

        try:
            snapshot_metrics = artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Snapshot metrics not found"}, status=404)

        manifest_key = (snapshot_metrics.extras or {}).get("manifest_key")
        if not manifest_key:
            return Response({"detail": "Manifest key not found"}, status=404)

        try:
            session = get_preprod_session(organization.id, artifact.project_id)
            get_response = session.get(manifest_key)
            manifest_data = orjson.loads(get_response.payload.read())
            manifest = SnapshotManifest(**manifest_data)
        except Exception:
            logger.exception(
                "Failed to retrieve snapshot manifest",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "manifest_key": manifest_key,
                },
            )
            return Response({"detail": "Internal server error"}, status=500)

        # Build VCS info from commit_comparison
        commit_comparison = artifact.commit_comparison
        if commit_comparison:
            vcs_info = BuildDetailsVcsInfo(
                head_sha=commit_comparison.head_sha,
                base_sha=commit_comparison.base_sha,
                provider=commit_comparison.provider,
                head_repo_name=commit_comparison.head_repo_name,
                base_repo_name=commit_comparison.base_repo_name,
                head_ref=commit_comparison.head_ref,
                base_ref=commit_comparison.base_ref,
                pr_number=commit_comparison.pr_number,
            )
        else:
            vcs_info = BuildDetailsVcsInfo()

        comparison_manifest: ComparisonManifest | None = None
        base_manifest: SnapshotManifest | None = None
        comparison = (
            PreprodSnapshotComparison.objects.select_related(
                "base_snapshot_metrics",
            )
            .filter(
                head_snapshot_metrics=snapshot_metrics,
                state=PreprodSnapshotComparison.State.SUCCESS,
            )
            .order_by("-id")
            .first()
        )
        if comparison:
            comparison_key = (comparison.extras or {}).get("comparison_key")
            if comparison_key:
                try:
                    comparison_manifest = ComparisonManifest(
                        **orjson.loads(session.get(comparison_key).payload.read())
                    )
                except Exception:
                    comparison_manifest = None
                    logger.exception(
                        "Failed to fetch comparison manifest",
                        extra={
                            "preprod_artifact_id": artifact.id,
                        },
                    )

        if comparison_manifest is not None and comparison is not None:
            base_manifest_key = (comparison.base_snapshot_metrics.extras or {}).get("manifest_key")
            if base_manifest_key:
                try:
                    base_manifest = SnapshotManifest(
                        **orjson.loads(session.get(base_manifest_key).payload.read())
                    )
                except Exception:
                    logger.exception(
                        "Failed to fetch base manifest",
                        extra={"preprod_artifact_id": artifact.id},
                    )

        analytics.record(
            PreprodArtifactApiGetSnapshotDetailsEvent(
                organization_id=organization.id,
                project_id=artifact.project_id,
                user_id=(
                    request.user.id if request.user and request.user.is_authenticated else None
                ),
                artifact_id=str(artifact.id),
            )
        )

        first_class = SnapshotImageResponse.__fields__
        image_list = [
            SnapshotImageResponse(
                **{k: v for k, v in metadata.dict().items() if k not in first_class},
                key=metadata.content_hash
                or key,  # TODO(EME-977): Remove backwards fallback for hash-keyed manifests once near EA/GA
                display_name=metadata.display_name,
                image_file_name=key,
                group=metadata.group,
                width=metadata.width,
                height=metadata.height,
            )
            for key, metadata in sorted(manifest.images.items())
        ]

        images_by_file_name: dict[str, SnapshotImageResponse] = {
            img.image_file_name: img for img in image_list
        }

        base_artifact_id: str | None = None
        comparison_state: str | None = None

        if comparison_manifest is not None:
            base_artifact_id = str(comparison_manifest.base_artifact_id)
            categorized = categorize_comparison_images(
                comparison_manifest, images_by_file_name, base_manifest
            )
        else:
            if comparison is not None:
                base_artifact_id = str(comparison.base_snapshot_metrics.preprod_artifact_id)
            categorized = CategorizedComparison()
            pending_or_failed_state = (
                PreprodSnapshotComparison.objects.filter(
                    head_snapshot_metrics=snapshot_metrics,
                    state__in=[
                        PreprodSnapshotComparison.State.PENDING,
                        PreprodSnapshotComparison.State.PROCESSING,
                        PreprodSnapshotComparison.State.FAILED,
                    ],
                )
                .values_list("state", flat=True)
                .order_by("-id")
                .first()
            )
            if pending_or_failed_state is not None:
                comparison_state = PreprodSnapshotComparison.State(pending_or_failed_state).name

        comparison_type = "diff" if comparison_manifest is not None else "solo"

        run_info: SnapshotComparisonRunInfo | None = None
        if comparison_state is not None:
            run_info = SnapshotComparisonRunInfo(state=comparison_state)
        elif comparison is not None:
            duration = comparison.date_updated - comparison.date_added
            run_info = SnapshotComparisonRunInfo(
                state=PreprodSnapshotComparison.State(comparison.state).name,
                completed_at=comparison.date_updated.isoformat(),
                duration_ms=int(duration.total_seconds() * 1000),
            )

        approval_info: SnapshotApprovalInfo | None = None
        all_approvals = list(
            PreprodComparisonApproval.objects.filter(
                preprod_artifact=artifact,
                preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            )
        )
        approved = [
            a
            for a in all_approvals
            if a.approval_status == PreprodComparisonApproval.ApprovalStatus.APPROVED
        ]

        if approved:
            sentry_user_ids = list({a.approved_by_id for a in approved if a.approved_by_id})
            users_by_id = {u.id: u for u in user_service.get_many_by_id(ids=sentry_user_ids)}

            approver_list: list[SnapshotApprover] = []
            seen_approver_keys: set[str] = set()
            for approval in approved:
                if approval.approved_by_id:
                    key = f"sentry:{approval.approved_by_id}"
                    if key in seen_approver_keys:
                        continue
                    seen_approver_keys.add(key)
                    user = users_by_id.get(approval.approved_by_id)
                    if user:
                        approver_list.append(
                            SnapshotApprover(
                                id=str(user.id),
                                name=user.get_display_name(),
                                email=user.email,
                                username=user.username,
                                approved_at=approval.approved_at.isoformat()
                                if approval.approved_at
                                else None,
                                source="sentry",
                            )
                        )
                elif approval.extras and "github" in approval.extras:
                    gh = approval.extras["github"]
                    gh_id = gh.get("id")
                    key = f"github:{gh_id or gh.get('login')}"
                    if key in seen_approver_keys:
                        continue
                    seen_approver_keys.add(key)
                    approver_list.append(
                        SnapshotApprover(
                            id=str(gh_id) if gh_id is not None else None,
                            name=gh.get("login"),
                            username=gh.get("login"),
                            avatar_url=f"https://avatars.githubusercontent.com/u/{gh_id}"
                            if gh_id is not None
                            else None,
                            approved_at=approval.approved_at.isoformat()
                            if approval.approved_at
                            else None,
                            source="github",
                        )
                    )
            is_auto_approved = any((a.extras or {}).get("auto_approval") is True for a in approved)
            approval_info = SnapshotApprovalInfo(
                status="approved",
                approvers=approver_list,
                is_auto_approved=is_auto_approved,
            )
        elif all_approvals:
            # If records exist but none are APPROVED, they must be NEEDS_APPROVAL
            approval_info = SnapshotApprovalInfo(
                status="requires_approval",
                approvers=[],
            )

        return Response(
            SnapshotDetailsApiResponse(
                head_artifact_id=str(artifact.id),
                base_artifact_id=base_artifact_id,
                project_id=str(artifact.project_id),
                comparison_type=comparison_type,
                state=artifact.state,
                vcs_info=vcs_info,
                images=image_list,
                image_count=snapshot_metrics.image_count,
                changed=categorized.changed,
                changed_count=len(categorized.changed),
                added=categorized.added,
                added_count=len(categorized.added),
                removed=categorized.removed,
                removed_count=len(categorized.removed),
                renamed=categorized.renamed,
                renamed_count=len(categorized.renamed),
                unchanged=categorized.unchanged,
                unchanged_count=len(categorized.unchanged),
                errored=categorized.errored,
                errored_count=len(categorized.errored),
                comparison_run_info=run_info,
                approval_info=approval_info,
            ).dict()
        )


@cell_silo_endpoint
class ProjectPreprodSnapshotEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectReleasePermission,)

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    def post(self, request: Request, project: Project) -> Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        data, error_message = validate_preprod_snapshot_post_schema(request.body)
        if error_message:
            return Response({"detail": error_message}, status=400)

        app_id = data.get("app_id")
        images = data.get("images", {})
        diff_threshold = data.get("diff_threshold")

        # VCS info
        head_sha = data.get("head_sha")
        base_sha = data.get("base_sha")
        provider = data.get("provider")
        head_repo_name = data.get("head_repo_name")
        head_ref = data.get("head_ref")
        base_repo_name = data.get("base_repo_name")
        base_ref = data.get("base_ref")
        pr_number = data.get("pr_number")

        # has_vcs tag differentiates transactions that include a CommitComparison
        # lookup from those that skip it, so we can isolate their latency on dashboards.
        with (
            metrics.timer(
                "preprod.snapshot.transaction_duration",
                sample_rate=1.0,
                tags={
                    "has_vcs": bool(head_sha and provider and head_repo_name and head_ref),
                    "organization_id_value": project.organization_id,
                },
            ),
            transaction.atomic(router.db_for_write(PreprodArtifact)),
        ):
            commit_comparison = None
            if head_sha and provider and head_repo_name and head_ref:
                commit_comparison, _ = CommitComparison.objects.get_or_create(
                    organization_id=project.organization_id,
                    head_repo_name=head_repo_name,
                    head_sha=head_sha,
                    base_sha=base_sha,
                    defaults={
                        "provider": provider,
                        "base_repo_name": base_repo_name,
                        "head_ref": head_ref,
                        "base_ref": base_ref,
                        "pr_number": pr_number,
                    },
                )

            artifact = PreprodArtifact.objects.create(
                project=project,
                state=PreprodArtifact.ArtifactState.UPLOADED,
                app_id=app_id,
                commit_comparison=commit_comparison,
            )

            manifest_key = f"{project.organization_id}/{project.id}/{artifact.id}/manifest.json"

            snapshot_metrics = PreprodSnapshotMetrics.objects.create(
                preprod_artifact=artifact,
                image_count=len(images),
                extras={"manifest_key": manifest_key},
            )

            # Write manifest inside the transaction so that a failed objectstore
            # write rolls back the DB records, ensuring both succeed or neither does.
            session = get_preprod_session(project.organization_id, project.id)
            manifest = SnapshotManifest(images=images, diff_threshold=diff_threshold)
            manifest_json = manifest.json(exclude_none=True)
            session.put(manifest_json.encode(), key=manifest_key)

        logger.info(
            "Created preprod artifact and stored snapshot manifest",
            extra={
                "preprod_artifact_id": artifact.id,
                "snapshot_metrics_id": snapshot_metrics.id,
                "project_id": project.id,
                "organization_slug": project.organization.slug,
                "head_sha": head_sha,
                "manifest_key": manifest_key,
                "image_count": len(images),
            },
        )

        has_vcs = commit_comparison is not None

        metric_tags = {
            "org_id_temp": str(project.organization_id),
            "project_id_temp": str(project.id),
            "app_id_temp": artifact.app_id or "",
        }

        metrics.distribution(
            "preprod.snapshots.upload.image_count",
            len(images),
            sample_rate=1.0,
            tags={**metric_tags, "has_vcs": has_vcs},
        )

        if has_vcs:
            try:
                # No composite index on (commit_comparison, project) — acceptable at current
                # Snapshots customer volume (rate-limited to 100 req/min/org).
                bundle_count = PreprodArtifact.objects.filter(
                    commit_comparison=commit_comparison,
                    project=project,
                ).count()
                metrics.distribution(
                    "preprod.snapshots.upload.bundles_per_commit",
                    bundle_count,
                    sample_rate=1.0,
                    tags=metric_tags,
                )
            except Exception:
                logger.exception("Failed to record bundles_per_commit metric")

        create_preprod_snapshot_status_check_task.apply_async(
            kwargs={
                "preprod_artifact_id": artifact.id,
                "caller": "upload_completion",
            },
        )

        if base_sha and base_repo_name:
            try:
                base_artifact = find_base_snapshot_artifact(
                    organization_id=project.organization_id,
                    base_sha=base_sha,
                    base_repo_name=base_repo_name,
                    project_id=project.id,
                    app_id=artifact.app_id,
                    artifact_type=artifact.artifact_type,
                    build_configuration=artifact.build_configuration,
                )
                if base_artifact:
                    logger.info(
                        "Found matching base artifact, triggering snapshot comparison",
                        extra={
                            "head_artifact_id": artifact.id,
                            "base_artifact_id": base_artifact.id,
                            "base_sha": base_sha,
                        },
                    )

                    base_metrics = PreprodSnapshotMetrics.objects.filter(
                        preprod_artifact=base_artifact
                    ).first()
                    if base_metrics:
                        try:
                            PreprodSnapshotComparison.objects.get_or_create(
                                head_snapshot_metrics=snapshot_metrics,
                                base_snapshot_metrics=base_metrics,
                                defaults={"state": PreprodSnapshotComparison.State.PENDING},
                            )
                        except IntegrityError:
                            pass

                    compare_snapshots.apply_async(
                        kwargs={
                            "project_id": project.id,
                            "org_id": project.organization_id,
                            "head_artifact_id": artifact.id,
                            "base_artifact_id": base_artifact.id,
                        },
                    )

                else:
                    logger.info(
                        "No matching base artifact found for snapshot comparison",
                        extra={
                            "head_artifact_id": artifact.id,
                            "base_sha": base_sha,
                            "base_repo_name": base_repo_name,
                            "base_ref": base_ref,
                        },
                    )
            except Exception:
                logger.exception(
                    "Failed to trigger snapshot comparison",
                    extra={
                        "head_artifact_id": artifact.id,
                        "base_sha": base_sha,
                    },
                )

        # Trigger comparisons for any head artifacts that were uploaded before this base.
        # Handles possible out-of-order uploads where heads arrive before their base build.
        if commit_comparison is not None:
            try:
                waiting_heads = find_head_snapshot_artifacts_awaiting_base(
                    organization_id=project.organization_id,
                    base_sha=commit_comparison.head_sha,
                    base_repo_name=commit_comparison.head_repo_name,
                    project_id=project.id,
                    app_id=artifact.app_id,
                    build_configuration=artifact.build_configuration,
                )
                for head_artifact in waiting_heads:
                    head_metrics = head_artifact.preprodsnapshotmetrics
                    logger.info(
                        "Found head artifact awaiting base, triggering snapshot comparison",
                        extra={
                            "head_artifact_id": head_artifact.id,
                            "base_artifact_id": artifact.id,
                            "base_sha": commit_comparison.head_sha,
                        },
                    )
                    try:
                        PreprodSnapshotComparison.objects.get_or_create(
                            head_snapshot_metrics=head_metrics,
                            base_snapshot_metrics=snapshot_metrics,
                            defaults={"state": PreprodSnapshotComparison.State.PENDING},
                        )
                    except IntegrityError:
                        pass

                    compare_snapshots.apply_async(
                        kwargs={
                            "project_id": project.id,
                            "org_id": project.organization_id,
                            "head_artifact_id": head_artifact.id,
                            "base_artifact_id": artifact.id,
                        },
                    )
            except Exception:
                logger.exception(
                    "Failed to trigger comparisons for head artifacts awaiting base",
                    extra={"base_artifact_id": artifact.id},
                )

        return Response(
            {
                "artifactId": str(artifact.id),
                "snapshotMetricsId": str(snapshot_metrics.id),
                "imageCount": snapshot_metrics.image_count,
                "snapshotUrl": get_preprod_artifact_url(artifact, view_type="snapshots"),
            },
            status=200,
        )
