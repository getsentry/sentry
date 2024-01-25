from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional, Sequence, Set, TypedDict

import sentry_sdk

from sentry.models.project import Project
from sentry.sentry_metrics.visibility.errors import MalformedBlockedMetricsPayloadError
from sentry.utils import json

BLOCKED_METRICS_PROJECT_OPTION_KEY = "sentry:blocked_metrics"


class DeniedTag(TypedDict):
    name: Sequence[str]
    tag: Sequence[str]


class BlockedMetricsRelayConfig(TypedDict):
    deniedNames: Sequence[str]
    deniedTags: Sequence[DeniedTag]


@dataclass(frozen=True)
class MetricOperation:
    metric_mri: str
    block_tags: Set[str]
    unblock_tags: Set[str]
    # This can be None, since if it is None, it implies that no state change will be applied to the metric.
    block_metric: Optional[bool] = None

    def to_blocked_metric(self) -> "BlockedMetric":
        return BlockedMetric(
            metric_mri=self.metric_mri,
            is_blocked=self.block_metric is True,
            blocked_tags=self.block_tags,
        )


@dataclass(frozen=True)
class BlockedMetric:
    metric_mri: str
    is_blocked: bool
    blocked_tags: Set[str]

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]) -> Optional["BlockedMetric"]:
        if "metric_mri" not in dictionary:
            return None

        return BlockedMetric(
            metric_mri=dictionary["metric_mri"],
            is_blocked=dictionary["is_blocked"],
            blocked_tags=set(dictionary.get("blocked_tags") or []),
        )

    def apply(self, other: MetricOperation) -> "BlockedMetric":
        return BlockedMetric(
            metric_mri=self.metric_mri,
            is_blocked=other.block_metric if other.block_metric is not None else self.is_blocked,
            blocked_tags=self.blocked_tags.union(other.block_tags) - other.unblock_tags,
        )

    def is_useless(self):
        return not self.is_blocked and not self.blocked_tags

    def to_dict(self) -> Mapping[str, Any]:
        return self.__dict__


@dataclass
class BlockedMetrics:
    # We store the data in a map keyed by the metric_mri in order to make the merging of `BlockedMetric`(s) easier.
    metrics: Dict[str, BlockedMetric]

    @classmethod
    def load_from_project(cls, project: Project, repair: bool = False) -> "BlockedMetrics":
        json_payload = project.get_option(BLOCKED_METRICS_PROJECT_OPTION_KEY)
        if not json_payload:
            return BlockedMetrics(metrics={})

        try:
            blocked_metrics_payload = json.loads(json_payload)
        except ValueError:
            if repair:
                project.delete_option(BLOCKED_METRICS_PROJECT_OPTION_KEY)

            raise MalformedBlockedMetricsPayloadError(
                f"Invalid blocked metrics payload for project {project.id}"
            )

        if not isinstance(blocked_metrics_payload, list):
            if repair:
                project.delete_option(BLOCKED_METRICS_PROJECT_OPTION_KEY)

            raise MalformedBlockedMetricsPayloadError(
                f"The blocked metrics payload is not a list for {project.id}"
            )

        blocked_metrics: Dict[str, BlockedMetric] = {}
        for blocked_metric_payload in blocked_metrics_payload:
            blocked_metric = BlockedMetric.from_dict(blocked_metric_payload)
            if blocked_metric is not None:
                # When reading we deduplicate by taking the last version of a blocking.
                blocked_metrics[blocked_metric.metric_mri] = blocked_metric

        return BlockedMetrics(metrics=blocked_metrics)

    def save_to_project(self, project: Project):
        # We store the payload as a list of objects to give us more flexibility, since if we were to store a dict keyed
        # by the mri, we would need a migration of the options in case something in the data changes.
        blocked_metrics_payload = [
            blocked_metric.to_dict() for blocked_metric in self.metrics.values()
        ]
        json_payload = json.dumps(blocked_metrics_payload)
        project.update_option(BLOCKED_METRICS_PROJECT_OPTION_KEY, json_payload)

    def apply_metric_operation(self, metric_operation: MetricOperation):
        metric_mri = metric_operation.metric_mri
        if (existing_metric := self.metrics.get(metric_mri)) is not None:
            blocked_metric = existing_metric.apply(metric_operation)
            # If the new blocked metric is useless, we will just delete it from the dictionary since it's not
            # needed. For example, if you unblock all tags from a metric, when applying the operation we will delete
            # the actual entry, whereas if you block a new tag, we will update the entry with the new one.
            if blocked_metric.is_useless():
                del self.metrics[metric_mri]
            else:
                self.metrics[metric_mri] = blocked_metric
        else:
            blocked_metric = metric_operation.to_blocked_metric()
            # If the merged blocked metric can't be cleared, it means that it will have an actual effect on metrics
            # ingestion, thus we add it to the dictionary. For example, if you block a new metric we will add it but if
            # you pass an operation that doesn't do anything we won't even apply the update.
            if not blocked_metric.is_useless():
                self.metrics[metric_mri] = metric_operation.to_blocked_metric()


def _apply_operation(metric_operation: MetricOperation, projects: Sequence[Project]):
    for project in projects:
        blocked_metrics = BlockedMetrics.load_from_project(project=project, repair=True)
        blocked_metrics.apply_metric_operation(metric_operation=metric_operation)
        blocked_metrics.save_to_project(project=project)


def block_metric(metric_mri: str, projects: Sequence[Project]):
    _apply_operation(
        MetricOperation(
            metric_mri=metric_mri, block_metric=True, block_tags=set(), unblock_tags=set()
        ),
        projects,
    )


def unblock_metric(metric_mri: str, projects: Sequence[Project]):
    _apply_operation(
        MetricOperation(
            metric_mri=metric_mri, block_metric=False, block_tags=set(), unblock_tags=set()
        ),
        projects,
    )


def block_tags_of_metric(metric_mri: str, tags: Set[str], projects: Sequence[Project]):
    _apply_operation(
        MetricOperation(metric_mri=metric_mri, block_tags=tags, unblock_tags=set()), projects
    )


def unblock_tags_of_metric(metric_mri: str, tags: Set[str], projects: Sequence[Project]):
    _apply_operation(
        MetricOperation(metric_mri=metric_mri, block_tags=set(), unblock_tags=tags), projects
    )


def get_blocked_metrics(projects: Sequence[Project]) -> Mapping[int, BlockedMetrics]:
    blocked_metrics_by_project = {}

    for project in projects:
        blocked_metrics_by_project[project.id] = BlockedMetrics.load_from_project(
            project=project, repair=False
        )

    return blocked_metrics_by_project


def get_blocked_metrics_for_relay_config(project: Project) -> BlockedMetricsRelayConfig:
    try:
        blocked_metrics = get_blocked_metrics([project])[project.id]
    except MalformedBlockedMetricsPayloadError as e:
        sentry_sdk.capture_exception(e)
        # In case of a malformed configuration, we will notify Sentry and return no metrics, since it's an unrecoverable
        # situation, unless we want to force overwrite the config.
        return BlockedMetricsRelayConfig(deniedNames=[], deniedTags=[])

    denied_names = []
    denied_tags = []
    for blocked_metric in blocked_metrics.metrics.values():
        if blocked_metric.is_blocked:
            denied_names.append(blocked_metric.metric_mri)
        elif blocked_metric.blocked_tags:
            denied_tags.append(
                DeniedTag(name=[blocked_metric.metric_mri], tag=list(blocked_metric.blocked_tags))
            )

    # For now, we just return the metric mris of the blocked metrics. Once tags are supported in Relay, we will return
    # also the blocked tags for the metric.
    return BlockedMetricsRelayConfig(deniedNames=denied_names, deniedTags=denied_tags)
