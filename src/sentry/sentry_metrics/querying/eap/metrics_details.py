from sentry import features
from sentry.models.project import Project
from sentry.snuba.metrics.utils import MetricMeta


def get_eap_meta(projects: list[Project]) -> list[MetricMeta]:
    eap_spans_project_ids = [
        project.id
        for project in projects
        if features.has("projects:use-eap-spans-for-metrics-explorer", project)
    ]
    metrics: list[MetricMeta] = []
    if len(eap_spans_project_ids) > 0:
        metrics.append(
            MetricMeta(
                name="eap.measurement",
                type="distribution",
                unit="none",
                operations=["sum", "avg", "p50", "p95", "p99", "count"],
                projectIds=eap_spans_project_ids,
                mri="d:eap/eap.measurement@none",
            )
        )
    return metrics
