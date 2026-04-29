from __future__ import annotations

import logging
import re
from typing import Any, Literal

from sentry import analytics as sentry_analytics
from sentry.api.event_search import SearchConfig, SearchFilter, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.integrations.github.status_check import GitHubCheckStatus
from sentry.integrations.source_code_management.status_check import (
    StatusCheckStatus,
)
from sentry.models.commitcomparison import CommitComparison
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodStatusCheckTriggeredRulePostedEvent
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
    PreprodComparisonApproval,
)
from sentry.preprod.url_utils import get_preprod_artifact_url
from sentry.preprod.vcs.status_checks.size.templates import (
    format_all_skipped_messages,
    format_no_quota_messages,
    format_status_check_messages,
)
from sentry.preprod.vcs.status_checks.size.types import (
    RuleArtifactType,
    StatusCheckRule,
    TriggeredRule,
)
from sentry.preprod.vcs.status_checks.status_check_provider import (
    GITHUB_STATUS_CHECK_STATUS_MAPPING,
)
from sentry.preprod.vcs.status_checks.utils import (
    get_status_check_client,
    get_status_check_provider,
    update_posted_status_check,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks
from sentry.utils import json

logger = logging.getLogger(__name__)

ENABLED_OPTION_KEY = "sentry:preprod_size_status_checks_enabled"
RULES_OPTION_KEY = "sentry:preprod_size_status_checks_rules"

# Action identifier for the "Approve" button on GitHub check runs.
# This is sent back in the webhook payload when the button is clicked.
APPROVE_SIZE_ACTION_IDENTIFIER = "approve_size"

preprod_artifact_search_config = SearchConfig.create_from(
    SearchConfig[Literal[True]](),
    text_operator_keys={
        "platform_name",
        "git_head_ref",
        "app_id",
        "build_configuration_name",
    },
    key_mappings={
        "platform_name": ["platform_name"],
        "git_head_ref": ["git_head_ref"],
        "app_id": ["app_id"],
        "build_configuration_name": ["build_configuration_name"],
    },
    allowed_keys={
        "platform_name",
        "git_head_ref",
        "app_id",
        "build_configuration_name",
    },
)

RULE_ARTIFACT_TYPE_TO_METRICS_ARTIFACT_TYPE = {
    RuleArtifactType.MAIN_ARTIFACT: PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
    RuleArtifactType.WATCH_ARTIFACT: PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
    RuleArtifactType.ANDROID_DYNAMIC_FEATURE_ARTIFACT: PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
    RuleArtifactType.APP_CLIP_ARTIFACT: PreprodArtifactSizeMetrics.MetricsArtifactType.APP_CLIP_ARTIFACT,
}


def _get_candidate_metrics_for_rule(
    rule: StatusCheckRule,
    size_metrics_list: list[PreprodArtifactSizeMetrics],
) -> list[PreprodArtifactSizeMetrics]:
    """Return candidate metrics for a rule based on the rule's artifact type.

    - MAIN/WATCH/DYNAMIC_FEATURE rules only evaluate matching metric types.
    - ALL_ARTIFACTS evaluates all available metrics for the artifact.
    - Returned metrics are sorted for ALL_ARTIFACTS for deterministic behavior.
    """
    resolved_artifact_type = rule.artifact_type or RuleArtifactType.MAIN_ARTIFACT

    if resolved_artifact_type == RuleArtifactType.ALL_ARTIFACTS:
        return sorted(
            size_metrics_list,
            key=lambda metric: (metric.metrics_artifact_type or 0, metric.identifier or ""),
        )

    target_metric_type = RULE_ARTIFACT_TYPE_TO_METRICS_ARTIFACT_TYPE.get(resolved_artifact_type)
    if target_metric_type is None:
        return []

    return [m for m in size_metrics_list if m.metrics_artifact_type == target_metric_type]


def _get_matching_base_metric(
    base_metrics: list[PreprodArtifactSizeMetrics],
    metric: PreprodArtifactSizeMetrics,
) -> PreprodArtifactSizeMetrics | None:
    """Find the base metric that corresponds to a head metric.

    Matching requires both `metrics_artifact_type` and `identifier` to be equal
    so main/watch/dynamic-feature values are compared against the correct peer.
    """
    return next(
        (
            base_metric
            for base_metric in base_metrics
            if base_metric.metrics_artifact_type == metric.metrics_artifact_type
            and base_metric.identifier == metric.identifier
        ),
        None,
    )


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_status_check",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
)
def create_preprod_status_check_task(
    preprod_artifact_id: int, caller: str | None = None, **kwargs: Any
) -> None:
    try:
        preprod_artifact: PreprodArtifact | None = PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=preprod_artifact_id)
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.status_checks.create.artifact_not_found",
            extra={"artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    if not preprod_artifact or not isinstance(preprod_artifact, PreprodArtifact):
        logger.error(
            "preprod.status_checks.create.artifact_not_found",
            extra={"artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    logger.info(
        "preprod.status_checks.create.start",
        extra={"artifact_id": preprod_artifact.id, "caller": caller},
    )

    if not preprod_artifact.commit_comparison:
        logger.info(
            "preprod.status_checks.create.no_commit_comparison",
            extra={"artifact_id": preprod_artifact.id},
        )
        return

    commit_comparison: CommitComparison = preprod_artifact.commit_comparison
    if not commit_comparison.head_sha or not commit_comparison.head_repo_name:
        # if the user provided git information, we should have a head_sha and head_repo_name
        logger.error(
            "preprod.status_checks.create.missing_git_info",
            extra={
                "artifact_id": preprod_artifact.id,
                "commit_comparison_id": commit_comparison.id,
            },
        )
        return

    status_checks_enabled = preprod_artifact.project.get_option(ENABLED_OPTION_KEY, default=True)
    if not status_checks_enabled:
        logger.info(
            "preprod.status_checks.create.disabled",
            extra={
                "artifact_id": preprod_artifact.id,
                "project_id": preprod_artifact.project.id,
            },
        )
        return

    # Get all artifacts for this commit across all projects in the organization
    all_artifacts = list(preprod_artifact.get_sibling_artifacts_for_commit())

    client, repository = get_status_check_client(preprod_artifact.project, commit_comparison)
    if not client or not repository:
        # logging handled in _get_status_check_client. for now we can be lax about users potentially
        # not having their repos integrated into Sentry
        return

    provider = get_status_check_provider(
        client,
        commit_comparison.provider,
        preprod_artifact.project.organization_id,
        preprod_artifact.project.organization.slug,
        repository.integration_id,
    )
    if not provider:
        logger.info(
            "preprod.status_checks.create.not_supported_provider",
            extra={"provider": commit_comparison.provider},
        )
        return

    size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]] = {}
    approvals_map: dict[int, PreprodComparisonApproval] = {}
    if all_artifacts:
        artifact_ids = [artifact.id for artifact in all_artifacts]
        size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=artifact_ids,
        ).select_related("preprod_artifact")

        for metrics in size_metrics_qs:
            if metrics.preprod_artifact_id not in size_metrics_map:
                size_metrics_map[metrics.preprod_artifact_id] = []
            size_metrics_map[metrics.preprod_artifact_id].append(metrics)

        approval_qs = PreprodComparisonApproval.objects.filter(
            preprod_artifact_id__in=artifact_ids,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )
        for approval in approval_qs:
            approvals_map[approval.preprod_artifact_id] = approval

    # Filter out artifacts not in the size analysis pipeline (e.g., snapshot-only artifacts).
    # Symmetric with snapshots/tasks.py which filters to snapshot-only artifacts.
    all_artifacts = [a for a in all_artifacts if a.id in size_metrics_map]

    # Filter out SKIPPED artifacts (user didn't request size analysis)
    all_artifacts = [
        a for a in all_artifacts if not _is_artifact_size_skipped(size_metrics_map.get(a.id, []))
    ]
    if not all_artifacts:
        logger.info(
            "preprod.status_checks.create.all_skipped",
            extra={"artifact_id": preprod_artifact.id},
        )
        title, subtitle, summary = format_all_skipped_messages(preprod_artifact.project)
        status = StatusCheckStatus.NEUTRAL
        completed_at = preprod_artifact.date_updated
        target_url = get_preprod_artifact_url(preprod_artifact)
        triggered_rules: list[TriggeredRule] = []
    else:
        url_artifact = (
            preprod_artifact
            if preprod_artifact.id in {a.id for a in all_artifacts}
            else all_artifacts[0]
        )
        target_url = get_preprod_artifact_url(url_artifact)
        completed_at = None

        # Check if any artifact hit quota limits - show neutral status with quota message
        if _has_no_quota_artifact(all_artifacts, size_metrics_map):
            title, subtitle, summary = format_no_quota_messages()
            status = StatusCheckStatus.NEUTRAL
            completed_at = preprod_artifact.date_updated
            triggered_rules = []
        else:
            rules = _get_status_check_rules(preprod_artifact.project)
            base_artifact_map, base_size_metrics_map = _fetch_base_size_metrics(all_artifacts)

            status, triggered_rules = _compute_overall_status(
                all_artifacts,
                size_metrics_map,
                rules=rules,
                base_artifact_map=base_artifact_map,
                base_metrics_by_artifact=base_size_metrics_map,
                approvals_map=approvals_map,
            )

            title, subtitle, summary = format_status_check_messages(
                all_artifacts,
                size_metrics_map,
                status,
                preprod_artifact.project,
                base_artifact_map,
                base_size_metrics_map,
                triggered_rules,
            )

            if GITHUB_STATUS_CHECK_STATUS_MAPPING[status] == GitHubCheckStatus.COMPLETED:
                completed_at = preprod_artifact.date_updated

            # When no rules are configured, always show neutral status.
            # When rules exist, show actual status (in_progress, failure, success).
            if not rules:
                status = StatusCheckStatus.NEUTRAL
                completed_at = preprod_artifact.date_updated

    try:
        check_id = provider.create_status_check(
            repo=commit_comparison.head_repo_name,
            sha=commit_comparison.head_sha,
            status=status,
            title=title,
            subtitle=subtitle,
            text=None,  # TODO(telkins): add text field support
            summary=summary,
            external_id=str(preprod_artifact.id),
            target_url=target_url,
            started_at=preprod_artifact.date_added,
            completed_at=completed_at,
            approve_action_identifier=APPROVE_SIZE_ACTION_IDENTIFIER if triggered_rules else None,
        )
    except Exception as e:
        extra: dict[str, Any] = {
            "artifact_id": preprod_artifact.id,
            "organization_id": preprod_artifact.project.organization_id,
            "organization_slug": preprod_artifact.project.organization.slug,
            "error_type": type(e).__name__,
        }
        if isinstance(e, ApiError):
            extra["status_code"] = e.code
        logger.exception(
            "preprod.status_checks.create.failed",
            extra=extra,
        )
        update_posted_status_check(preprod_artifact, check_type="size", success=False, error=e)
        raise

    if check_id is None:
        logger.error(
            "preprod.status_checks.create.failed",
            extra={
                "artifact_id": preprod_artifact.id,
                "organization_id": preprod_artifact.project.organization_id,
                "organization_slug": preprod_artifact.project.organization.slug,
                "error_type": "null_check_id",
            },
        )
        update_posted_status_check(preprod_artifact, check_type="size", success=False)
        return

    update_posted_status_check(preprod_artifact, check_type="size", success=True, check_id=check_id)

    if triggered_rules:
        sentry_analytics.record(
            PreprodStatusCheckTriggeredRulePostedEvent(
                organization_id=preprod_artifact.project.organization_id,
                project_id=preprod_artifact.project_id,
                artifact_id=preprod_artifact.id,
                product="size",
            )
        )

    logger.info(
        "preprod.status_checks.create.success",
        extra={
            "artifact_id": preprod_artifact.id,
            "status": status.value,
            "check_id": check_id,
            "organization_id": preprod_artifact.project.organization_id,
            "organization_slug": preprod_artifact.project.organization.slug,
        },
    )


def _get_status_check_rules(project: Project) -> list[StatusCheckRule]:
    """
    Fetch and parse status check rules from project options.

    Returns an empty list if feature is disabled or no rules configured.
    """

    rules_json = project.get_option(RULES_OPTION_KEY, default=None)
    if not rules_json:
        return []

    try:
        # Handle bytes from project options (json.loads requires str, not bytes)
        if isinstance(rules_json, bytes):
            rules_json = rules_json.decode("utf-8")
        rules_data = json.loads(rules_json) if isinstance(rules_json, str) else rules_json
        if not isinstance(rules_data, list):
            logger.warning(
                "preprod.status_checks.rules.invalid_format",
                extra={"project_id": project.id, "rules_type": type(rules_data).__name__},
            )
            return []

        rules: list[StatusCheckRule] = []
        for rule_dict in rules_data:
            if (
                not isinstance(rule_dict.get("id"), str)
                or not isinstance(rule_dict.get("metric"), str)
                or not isinstance(rule_dict.get("measurement"), str)
                or not isinstance(rule_dict.get("value"), (int, float))
            ):
                logger.warning(
                    "preprod.status_checks.rules.invalid_rule",
                    extra={"project_id": project.id, "rule_id": rule_dict.get("id")},
                )
                continue

            filter_query_raw = rule_dict.get("filterQuery", "")
            filter_query = str(filter_query_raw) if filter_query_raw is not None else ""
            artifact_type = (
                RuleArtifactType.from_raw(rule_dict.get("artifactType"))
                or RuleArtifactType.MAIN_ARTIFACT
            )

            rules.append(
                StatusCheckRule(
                    id=rule_dict["id"],
                    metric=rule_dict["metric"],
                    measurement=rule_dict["measurement"],
                    value=float(rule_dict["value"]),
                    filter_query=filter_query,
                    artifact_type=artifact_type,
                )
            )
        return rules
    except (json.JSONDecodeError, TypeError, ValueError, AttributeError) as e:
        logger.warning(
            "preprod.status_checks.rules.parse_error",
            extra={"project_id": project.id, "error": str(e)},
        )
        return []


def _fetch_base_size_metrics(
    artifacts: list[PreprodArtifact],
) -> tuple[dict[int, PreprodArtifact], dict[int, list[PreprodArtifactSizeMetrics]]]:
    """Fetch base artifacts and their size metrics for head artifacts.

    Returns:
        Tuple of (base_artifact_map, base_metrics_by_artifact) where:
        - base_artifact_map: head_artifact_id -> base_artifact
        - base_metrics_by_artifact: base_artifact_id -> list of size metrics
    """
    if not artifacts:
        return {}, {}

    base_artifact_map = PreprodArtifact.get_base_artifacts_for_commit(artifacts)
    if not base_artifact_map:
        return {}, {}

    base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact_id__in=[ba.id for ba in base_artifact_map.values()],
    )

    base_metrics_by_artifact: dict[int, list[PreprodArtifactSizeMetrics]] = {}
    for metrics in base_size_metrics_qs:
        base_metrics_by_artifact.setdefault(metrics.preprod_artifact_id, []).append(metrics)

    return base_artifact_map, base_metrics_by_artifact


def _is_artifact_size_skipped(
    size_metrics_list: list[PreprodArtifactSizeMetrics],
) -> bool:
    """Check if artifact should be excluded because size analysis was skipped."""
    if not size_metrics_list:
        return False

    return all(
        m.error_code == PreprodArtifactSizeMetrics.ErrorCode.SKIPPED for m in size_metrics_list
    )


def _has_no_quota_artifact(
    artifacts: list[PreprodArtifact],
    size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]],
) -> bool:
    """Check if any artifact has NO_QUOTA error."""
    return any(
        m.error_code == PreprodArtifactSizeMetrics.ErrorCode.NO_QUOTA
        for artifact in artifacts
        for m in size_metrics_map.get(artifact.id, [])
    )


def _get_artifact_filter_context(artifact: PreprodArtifact) -> dict[str, str]:
    """
    Extract build metadata from an artifact for filter matching.

    Returns a dict with keys matching the filter key format:
    - git_head_ref: The git_head_ref name (from commit_comparison.head_ref)
    - platform_name: "apple" or "android" (derived from artifact_type)
    - app_id: The app ID (e.g., "com.example.app")
    - build_configuration_name: The build configuration name
    """
    context: dict[str, str] = {}

    if artifact.commit_comparison and artifact.commit_comparison.head_ref:
        context["git_head_ref"] = artifact.commit_comparison.head_ref

    if artifact.artifact_type is not None:
        if artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
            context["platform_name"] = "apple"
        elif artifact.artifact_type in (
            PreprodArtifact.ArtifactType.AAB,
            PreprodArtifact.ArtifactType.APK,
        ):
            context["platform_name"] = "android"

    if artifact.app_id:
        context["app_id"] = artifact.app_id

    if artifact.build_configuration:
        try:
            context["build_configuration_name"] = artifact.build_configuration.name
        except Exception:
            pass

    return context


def _rule_matches_artifact(rule: StatusCheckRule, context: dict[str, str]) -> bool:
    """
    Check if a rule's filters match the artifact's context.

    Filter logic:
    - Filters with the same key AND negation status are OR'd together
    - Different groups (different key or negation) are AND'd together
    - negated=True means the value should NOT match
    """
    if not rule.filter_query or not str(rule.filter_query).strip():
        return True

    try:
        search_filters = [
            f
            for f in parse_search_query(rule.filter_query, config=preprod_artifact_search_config)
            if isinstance(f, SearchFilter)
        ]
    except InvalidSearchQuery:
        logger.warning(
            "preprod.status_checks.invalid_filter_query",
            extra={"rule_id": rule.id, "filter_query": rule.filter_query},
        )
        return False

    if not search_filters:
        return True

    filters_by_group: dict[str, list[SearchFilter]] = {}
    for f in search_filters:
        group_key = f"{f.key.name}:{'negated' if f.is_negation else 'normal'}"
        if group_key not in filters_by_group:
            filters_by_group[group_key] = []
        filters_by_group[group_key].append(f)

    for group_key, group_filters in filters_by_group.items():
        artifact_value = context.get(group_filters[0].key.name)

        if artifact_value is None:
            return False

        group_matches = False
        for f in group_filters:
            if f.value.is_wildcard():
                # Wildcard operators (contains, starts_with, ends_with)
                # Works for both single values and IN filters
                # For IN filters with wildcards, value is a regex alternation pattern
                try:
                    pattern = f.value.value
                    matches = bool(re.search(pattern, artifact_value))
                except (re.error, TypeError):
                    matches = False
            elif f.is_in_filter:
                # Non-wildcard IN filter
                matches = artifact_value in f.value.value
            else:
                # Exact equality match
                matches = artifact_value == f.value.value

            if f.is_negation:
                matches = not matches

            if matches:
                group_matches = True
                break

        if not group_matches:
            return False

    return True


def _get_metric_value(size_metrics: PreprodArtifactSizeMetrics, metric: str) -> int | None:
    """Get the relevant size value from metrics based on the metric type."""
    if metric == "install_size":
        return size_metrics.max_install_size
    elif metric == "download_size":
        return size_metrics.max_download_size
    return None


def _evaluate_rule_threshold(
    rule: StatusCheckRule,
    size_metrics: PreprodArtifactSizeMetrics | None,
    base_size_metrics: PreprodArtifactSizeMetrics | None = None,
) -> bool:
    """
    Check if the size metric exceeds the rule's threshold.

    Returns True if the threshold is exceeded (rule triggers failure).

    Measurement types:
    - absolute: Compare the absolute size against the threshold in bytes
    - absolute_diff: Compare the absolute size difference (in bytes) from baseline
    - relative_diff: Compare the relative size difference (in %) from baseline
    """
    if not size_metrics:
        return False

    if size_metrics.state != PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED:
        return False

    current_value = _get_metric_value(size_metrics, rule.metric)
    if current_value is None:
        return False

    if rule.measurement == "absolute":
        return current_value > rule.value

    elif rule.measurement == "absolute_diff":
        if not base_size_metrics:
            return False

        if base_size_metrics.state != PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED:
            return False

        base_value = _get_metric_value(base_size_metrics, rule.metric)
        if base_value is None:
            return False

        diff = current_value - base_value
        return diff > rule.value

    elif rule.measurement == "relative_diff":
        if not base_size_metrics:
            return False

        if base_size_metrics.state != PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED:
            return False

        base_value = _get_metric_value(base_size_metrics, rule.metric)
        if base_value is None or base_value == 0:
            return False

        diff = current_value - base_value
        percent_diff = (diff / base_value) * 100
        return percent_diff > rule.value

    return False


def _compute_overall_status(
    artifacts: list[PreprodArtifact],
    size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]],
    rules: list[StatusCheckRule] | None = None,
    base_artifact_map: dict[int, PreprodArtifact] | None = None,
    base_metrics_by_artifact: dict[int, list[PreprodArtifactSizeMetrics]] | None = None,
    approvals_map: dict[int, PreprodComparisonApproval] | None = None,
) -> tuple[StatusCheckStatus, list[TriggeredRule]]:
    triggered_rules: list[TriggeredRule] = []

    if not artifacts:
        raise ValueError("Cannot compute status for empty artifact list")

    states = {artifact.state for artifact in artifacts}

    if PreprodArtifact.ArtifactState.FAILED in states:
        return StatusCheckStatus.FAILURE, []
    elif (
        PreprodArtifact.ArtifactState.UPLOADING in states
        or PreprodArtifact.ArtifactState.UPLOADED in states
    ):
        return StatusCheckStatus.IN_PROGRESS, []
    elif all(state == PreprodArtifact.ArtifactState.PROCESSED for state in states):
        for artifact in artifacts:
            size_metrics_list = size_metrics_map.get(artifact.id, [])
            if size_metrics_list:
                for size_metrics in size_metrics_list:
                    if size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
                        return StatusCheckStatus.FAILURE, []
                    elif (
                        size_metrics.state != PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                    ):
                        return StatusCheckStatus.IN_PROGRESS, []

        if rules:
            for artifact in artifacts:
                if approvals_map and artifact.id in approvals_map:
                    continue

                context = _get_artifact_filter_context(artifact)
                size_metrics_list = size_metrics_map.get(artifact.id, [])

                base_metrics_list: list[PreprodArtifactSizeMetrics] = []
                if base_artifact_map and base_metrics_by_artifact:
                    base_artifact = base_artifact_map.get(artifact.id)
                    if base_artifact:
                        base_metrics_list = base_metrics_by_artifact.get(base_artifact.id, [])

                for rule in rules:
                    if not _rule_matches_artifact(rule, context):
                        continue

                    candidate_metrics = _get_candidate_metrics_for_rule(rule, size_metrics_list)
                    for candidate_metric in candidate_metrics:
                        base_metric = _get_matching_base_metric(base_metrics_list, candidate_metric)
                        if _evaluate_rule_threshold(rule, candidate_metric, base_metric):
                            logger.info(
                                "preprod.status_checks.rule_triggered",
                                extra={
                                    "artifact_id": artifact.id,
                                    "rule_id": rule.id,
                                    "metric": rule.metric,
                                    "measurement": rule.measurement,
                                    "threshold": rule.value,
                                    "rule_artifact_type": rule.artifact_type,
                                    "metrics_artifact_type": candidate_metric.metrics_artifact_type,
                                    "identifier": candidate_metric.identifier,
                                },
                            )
                            triggered_rules.append(
                                TriggeredRule(
                                    rule=rule,
                                    artifact_id=artifact.id,
                                    app_id=artifact.app_id,
                                    platform=artifact.get_platform_label(),
                                    metrics_artifact_type=candidate_metric.metrics_artifact_type,
                                    identifier=candidate_metric.identifier,
                                    build_configuration_name=(
                                        artifact.build_configuration.name
                                        if artifact.build_configuration
                                        else None
                                    ),
                                )
                            )

        if triggered_rules:
            return StatusCheckStatus.FAILURE, triggered_rules

        return StatusCheckStatus.SUCCESS, triggered_rules
    else:
        return StatusCheckStatus.IN_PROGRESS, triggered_rules
