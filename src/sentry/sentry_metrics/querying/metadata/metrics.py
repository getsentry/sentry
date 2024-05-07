from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import parse_mri
from sentry.snuba.metrics.datasource import (
    _build_metric_meta,
    get_metrics_blocking_state_of_projects,
)
from sentry.snuba.metrics.utils import BlockedMetric, MetricMeta
from sentry.snuba.metrics_layer.query import fetch_metric_mris


def get_metrics_meta(
    organization: Organization,
    projects: Sequence[Project],
    use_case_ids: Sequence[UseCaseID],
) -> Sequence[MetricMeta]:
    if not projects:
        return []

    stored_metrics = get_available_mris(organization, projects, use_case_ids)
    metrics_blocking_state = (
        get_metrics_blocking_state_of_projects(projects) if UseCaseID.CUSTOM in use_case_ids else {}
    )

    metrics_metas = []
    for metric_mri, project_ids in stored_metrics.items():
        parsed_mri = parse_mri(metric_mri)

        blocking_status = []
        if (metric_blocking := metrics_blocking_state.get(metric_mri)) is not None:
            blocking_status = [
                BlockedMetric(isBlocked=is_blocked, blockedTags=blocked_tags, projectId=project_id)
                for is_blocked, blocked_tags, project_id in metric_blocking
            ]
            # We delete the metric so that in the next steps we can just merge the remaining blocked metrics that are
            # not stored.
            del metrics_blocking_state[metric_mri]

        metrics_metas.append(_build_metric_meta(parsed_mri, project_ids, blocking_status))

    for metric_mri, metric_blocking in metrics_blocking_state.items():
        parsed_mri = parse_mri(metric_mri)
        if parsed_mri is None:
            continue

        metrics_metas.append(
            _build_metric_meta(
                parsed_mri,
                [],
                [
                    BlockedMetric(
                        isBlocked=is_blocked, blockedTags=blocked_tags, projectId=project_id
                    )
                    for is_blocked, blocked_tags, project_id in metric_blocking
                ],
            )
        )

    return metrics_metas


def get_available_mris(
    organization: Organization, projects: Sequence[Project], use_case_id: UseCaseID
) -> dict[str, list[int]]:
    """
    Returns a dictionary containing the Metrics MRIs available as keys, and the corresponding
    list of project_ids in which the MRI is available as values.
    """
    project_ids = [project.id for project in projects]
    project_id_to_mris = fetch_metric_mris(organization.id, project_ids, use_case_id)
    mris_to_project_ids = _reverse_mapping(project_id_to_mris)

    return mris_to_project_ids


def _reverse_mapping(project_id_to_mris: dict[int, list[str]]):
    mris_to_project_ids: dict[str, list[int]] = defaultdict(list)

    mris = set(_flatten([mri for mri in project_id_to_mris.values()]))
    for mri in mris:
        for project_id in project_id_to_mris.keys():
            if mri in project_id_to_mris[project_id]:
                mris_to_project_ids[mri].append(project_id)

    return mris_to_project_ids


def _flatten(list_of_lists: list[list[Any]]) -> list[Any]:
    return [element for sublist in list_of_lists for element in sublist]
