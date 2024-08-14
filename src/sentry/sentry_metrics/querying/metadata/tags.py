from collections.abc import Sequence
from dataclasses import dataclass

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics_layer.query import fetch_metric_tag_keys, fetch_metric_tag_values


@dataclass
class TagValue:
    key: str
    value: str

    def __hash__(self):
        return hash((self.key, self.value))


def get_tag_keys(
    organization: Organization,
    projects: Sequence[Project],
    use_case_ids: Sequence[UseCaseID],
    mri: str,
) -> list[str]:
    """
    Get all available tag keys for a given MRI, specified projects and use_case_ids.
    Returns list of strings representing tag keys for a list of MRIs
    """
    all_tag_keys: set[str] = set()
    project_ids = [project.id for project in projects]
    for use_case_id in use_case_ids:
        tag_keys_per_project = fetch_metric_tag_keys(organization.id, project_ids, use_case_id, mri)
        for tag_keys in tag_keys_per_project.values():
            all_tag_keys = all_tag_keys.union(tag_keys)

    return sorted(list(all_tag_keys))


def get_tag_values(
    organization: Organization,
    projects: Sequence[Project],
    use_case_ids: Sequence[UseCaseID],
    mri: str,
    tag_key: str,
    tag_value_prefix: str = "",
) -> list[str]:
    """
    Get all available tag values for an MRI and tag key from metrics.
    """
    project_ids = [project.id for project in projects]
    tag_values: set[str] = set()
    for use_case_id in use_case_ids:
        use_case_tag_values = fetch_metric_tag_values(
            organization.id, project_ids, use_case_id, mri, tag_key, tag_value_prefix
        )
        tag_values = tag_values.union(use_case_tag_values)

    return list(tag_values)
