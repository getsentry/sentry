from dataclasses import dataclass
from typing import Any, List, Mapping, Optional, Sequence, TypedDict

from sentry.models.project import Project
from sentry.utils import json

BLOCKED_METRICS_PROJECT_OPTION_KEY = "sentry:blocked_metrics"


class BlockedMetricsRelayConfig(TypedDict):
    deniedNames: Sequence[str]


@dataclass(frozen=True)
class BlockedMetric:
    metric_mri: str
    tags: Optional[Sequence[str]] = None

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]):
        return BlockedMetric(metric_mri=dictionary["metric_mri"], tags=dictionary.get("tags"))

    def to_dict(self) -> Mapping[str, Any]:
        return self.__dict__


@dataclass
class BlockedMetrics:
    metrics: List[BlockedMetric]

    @classmethod
    def load_from_project(cls, project: Project) -> "BlockedMetrics":
        json_payload = project.get_option(BLOCKED_METRICS_PROJECT_OPTION_KEY)
        if not json_payload:
            return BlockedMetrics(metrics=[])

        blocked_metrics_payload = json.loads(json_payload)
        if not isinstance(blocked_metrics_payload, list):
            raise Exception(f"Invalid blocked metrics payload for project {project.id}")

        blocked_metrics = []
        for blocked_metric in blocked_metrics_payload:
            blocked_metrics.append(BlockedMetric.from_dict(blocked_metric))

        return BlockedMetrics(metrics=blocked_metrics)

    def save_to_project(self, project: Project):
        blocked_metrics_payload = [blocked_metric.to_dict() for blocked_metric in self.metrics]
        json_payload = json.dumps(blocked_metrics_payload)
        project.update_option(BLOCKED_METRICS_PROJECT_OPTION_KEY, json_payload)

    def add_blocked_metric(self, blocked_metric: BlockedMetric) -> "BlockedMetrics":
        self.metrics.append(blocked_metric)
        return self


def get_blocked_metrics(project: Project) -> BlockedMetrics:
    return BlockedMetrics.load_from_project(project)


def get_blocked_metrics_for_relay_config(project: Project) -> BlockedMetricsRelayConfig:
    blocked_metrics = get_blocked_metrics(project)
    denied_names = [blocked_metric.metric_mri for blocked_metric in blocked_metrics.metrics]

    return BlockedMetricsRelayConfig(deniedNames=denied_names)


def block_metric(blocked_metric: BlockedMetric, projects: Sequence[Project]):
    for project in projects:
        BlockedMetrics.load_from_project(project).add_blocked_metric(
            blocked_metric
        ).save_to_project(project)
