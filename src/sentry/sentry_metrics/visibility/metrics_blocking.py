from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Sequence, Set, TypedDict

import sentry_sdk

from sentry.models.project import Project
from sentry.sentry_metrics.visibility.errors import (
    InvalidBlockedMetricError,
    MalformedBlockedMetricsPayloadError,
)
from sentry.utils import json

BLOCKED_METRICS_PROJECT_OPTION_KEY = "sentry:blocked_metrics"


class BlockedMetricsRelayConfig(TypedDict):
    deniedNames: Sequence[str]


@dataclass(frozen=True)
class BlockedMetric:
    metric_mri: str
    tags: Set[str]

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]):
        if "metric_mri" not in dictionary:
            raise InvalidBlockedMetricError("Missing metric_mri in the dictionary")

        return BlockedMetric(
            metric_mri=dictionary["metric_mri"], tags=set(dictionary.get("tags") or [])
        )

    def merge(self, other: "BlockedMetric") -> "BlockedMetric":
        return BlockedMetric(metric_mri=self.metric_mri, tags=self.tags.union(other.tags))

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

        try:
            blocked_metrics_payload = json.loads(json_payload)
        except ValueError as e:
            sentry_sdk.capture_exception(e)
            raise MalformedBlockedMetricsPayloadError(
                f"Invalid blocked metrics payload for project {project.id}"
            )

        if not isinstance(blocked_metrics_payload, list):
            raise MalformedBlockedMetricsPayloadError(
                f"The blocked metrics payload is not a list for {project.id}"
            )

        blocked_metrics = []
        for blocked_metric in blocked_metrics_payload:
            blocked_metrics.append(BlockedMetric.from_dict(blocked_metric))

        return BlockedMetrics(metrics=blocked_metrics)._merge_blocked_metrics()

    def _merge_blocked_metrics(self) -> "BlockedMetrics":
        metrics_map: Dict[str, BlockedMetric] = {}
        for metric in self.metrics:
            if (duplicated_metric := metrics_map.get(metric.metric_mri)) is not None:
                metrics_map[metric.metric_mri] = metric.merge(duplicated_metric)
            else:
                metrics_map[metric.metric_mri] = metric

        self.metrics = list(metrics_map.values())
        return self

    def save_to_project(self, project: Project):
        self._merge_blocked_metrics()
        blocked_metrics_payload = [blocked_metric.to_dict() for blocked_metric in self.metrics]
        json_payload = json.dumps(blocked_metrics_payload)
        project.update_option(BLOCKED_METRICS_PROJECT_OPTION_KEY, json_payload)

    def add_blocked_metric(self, blocked_metric: BlockedMetric) -> "BlockedMetrics":
        self.metrics.append(blocked_metric)
        return self


def get_blocked_metrics(projects: Sequence[Project]) -> Mapping[int, BlockedMetrics]:
    blocked_metrics_by_project = {}

    for project in projects:
        blocked_metrics_by_project[project.id] = BlockedMetrics.load_from_project(project)

    return blocked_metrics_by_project


def get_blocked_metrics_for_relay_config(project: Project) -> BlockedMetricsRelayConfig:
    blocked_metrics = get_blocked_metrics([project])[project.id]
    denied_names = [blocked_metric.metric_mri for blocked_metric in blocked_metrics.metrics]

    return BlockedMetricsRelayConfig(deniedNames=denied_names)


def block_metric(blocked_metric: BlockedMetric, projects: Sequence[Project]):
    for project in projects:
        BlockedMetrics.load_from_project(project).add_blocked_metric(
            blocked_metric
        ).save_to_project(project)
