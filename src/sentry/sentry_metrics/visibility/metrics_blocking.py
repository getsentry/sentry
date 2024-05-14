from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Optional, TypedDict

import sentry_sdk

from sentry.models.project import Project
from sentry.sentry_metrics.visibility.errors import MalformedBlockedMetricsPayloadError
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import json, metrics

METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY = "sentry:blocked_metrics"


class DeniedTagRelayConfig(TypedDict):
    name: Sequence[str]
    tags: Sequence[str]


class MetricsBlockingStateRelayConfig(TypedDict):
    deniedNames: Sequence[str]
    deniedTags: Sequence[DeniedTagRelayConfig]


@dataclass(frozen=True)
class MetricOperation:
    metric_mri: str
    block_tags: set[str]
    unblock_tags: set[str]
    # This can be None, since if it is None, it implies that no state change will be applied to the metric.
    block_metric: bool | None = None

    def to_metric_blocking(self) -> "MetricBlocking":
        return MetricBlocking(
            metric_mri=self.metric_mri,
            is_blocked=self.block_metric is True,
            blocked_tags=self.block_tags,
        )


@dataclass(frozen=True)
class MetricBlocking:
    metric_mri: str
    is_blocked: bool
    blocked_tags: set[str]

    @classmethod
    def empty(cls, metric_mri: str) -> "MetricBlocking":
        return MetricBlocking(metric_mri=metric_mri, is_blocked=False, blocked_tags=set())

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]) -> Optional["MetricBlocking"]:
        if "metric_mri" not in dictionary:
            return None

        return MetricBlocking(
            metric_mri=dictionary["metric_mri"],
            is_blocked=dictionary["is_blocked"],
            blocked_tags=set(dictionary.get("blocked_tags") or []),
        )

    def apply(self, other: MetricOperation) -> "MetricBlocking":
        return MetricBlocking(
            metric_mri=self.metric_mri,
            is_blocked=other.block_metric if other.block_metric is not None else self.is_blocked,
            blocked_tags=self.blocked_tags.union(other.block_tags) - other.unblock_tags,
        )

    def is_empty(self):
        return not self.is_blocked and not self.blocked_tags

    def to_dict(self) -> Mapping[str, Any]:
        return self.__dict__

    def __hash__(self):
        # For the serializer we need to implement a hashing function that uniquely identifies a blocking metric.
        return hash(self.metric_mri)


@dataclass
class MetricsBlockingState:
    # We store the data in a map keyed by the metric_mri in order to make the merging more efficient.
    metrics: dict[str, MetricBlocking]

    @classmethod
    def load_from_project(cls, project: Project, repair: bool = False) -> "MetricsBlockingState":
        json_payload = project.get_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)
        if not json_payload:
            return MetricsBlockingState(metrics={})

        try:
            metrics_blocking_state_payload = json.loads(json_payload)
        except ValueError:
            if repair:
                project.delete_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)

            raise MalformedBlockedMetricsPayloadError(
                f"Invalid metrics blocking state payload for project {project.id}"
            )

        if not isinstance(metrics_blocking_state_payload, list):
            if repair:
                project.delete_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY)

            raise MalformedBlockedMetricsPayloadError(
                f"The metrics blocking state payload is not a list for project {project.id}"
            )

        metrics: dict[str, MetricBlocking] = {}
        for blocked_metric_payload in metrics_blocking_state_payload:
            blocked_metric = MetricBlocking.from_dict(blocked_metric_payload)
            if blocked_metric is not None:
                # When reading we deduplicate by taking the last version of a blocking.
                metrics[blocked_metric.metric_mri] = blocked_metric

        return MetricsBlockingState(metrics=metrics)

    def save_to_project(self, project: Project):
        # We store the payload as a list of objects to give us more flexibility, since if we were to store a dict keyed
        # by the mri, we would need a migration of the options in case something in the data changes.
        metrics_blocking_state_payload = [
            metric_blocking.to_dict() for metric_blocking in self.metrics.values()
        ]
        json_payload = json.dumps(metrics_blocking_state_payload)
        project.update_option(METRICS_BLOCKING_STATE_PROJECT_OPTION_KEY, json_payload)

    def apply_metric_operation(self, metric_operation: MetricOperation) -> MetricBlocking | None:
        metric_mri = metric_operation.metric_mri
        if (existing_metric := self.metrics.get(metric_mri)) is not None:
            metric_blocking = existing_metric.apply(metric_operation)
            # If the new blocked metric is useless, we will just delete it from the dictionary since it's not
            # needed. For example, if you unblock all tags from a metric, when applying the operation we will delete
            # the actual entry, whereas if you block a new tag, we will update the entry with the new one.
            if metric_blocking.is_empty():
                del self.metrics[metric_mri]
            else:
                self.metrics[metric_mri] = metric_blocking
        else:
            metric_blocking = metric_operation.to_metric_blocking()
            # If the merged blocked metric can't be cleared, it means that it will have an actual effect on metrics
            # ingestion, thus we add it to the dictionary. For example, if you block a new metric we will add it but if
            # you pass an operation that doesn't do anything we won't even apply the update.
            if not metric_blocking.is_empty():
                self.metrics[metric_mri] = metric_operation.to_metric_blocking()

        return self.metrics.get(metric_mri)


def _apply_operation(
    metric_operation: MetricOperation, projects: Sequence[Project]
) -> Mapping[int, MetricBlocking]:
    patched_metrics = {}

    for project in projects:
        metrics_blocking_state = MetricsBlockingState.load_from_project(
            project=project, repair=True
        )
        patched_blocking_metric = metrics_blocking_state.apply_metric_operation(
            metric_operation=metric_operation
        )
        metrics_blocking_state.save_to_project(project=project)

        # We store the newly patched state, or we default to empty state in case of an unblocking.
        patched_metrics[project.id] = patched_blocking_metric or MetricBlocking.empty(
            metric_mri=metric_operation.metric_mri
        )
        # We invalidate the project configuration once the updated settings were stored.
        schedule_invalidate_project_config(project_id=project.id, trigger="metrics_blocking")

    return patched_metrics


def block_metric(metric_mri: str, projects: Sequence[Project]) -> Mapping[int, MetricBlocking]:
    metrics.incr("ddm.metrics_api.blocked_metrics_count")
    return _apply_operation(
        MetricOperation(
            metric_mri=metric_mri, block_metric=True, block_tags=set(), unblock_tags=set()
        ),
        projects,
    )


def unblock_metric(metric_mri: str, projects: Sequence[Project]) -> Mapping[int, MetricBlocking]:
    metrics.incr("ddm.metrics_api.unblocked_metrics_count")
    return _apply_operation(
        MetricOperation(
            metric_mri=metric_mri, block_metric=False, block_tags=set(), unblock_tags=set()
        ),
        projects,
    )


def block_tags_of_metric(
    metric_mri: str, tags: set[str], projects: Sequence[Project]
) -> Mapping[int, MetricBlocking]:
    metrics.incr("ddm.metrics_api.blocked_metric_tags_count")
    return _apply_operation(
        MetricOperation(metric_mri=metric_mri, block_tags=tags, unblock_tags=set()), projects
    )


def unblock_tags_of_metric(
    metric_mri: str, tags: set[str], projects: Sequence[Project]
) -> Mapping[int, MetricBlocking]:
    metrics.incr("ddm.metrics_api.unblocked_metric_tags_count")
    return _apply_operation(
        MetricOperation(metric_mri=metric_mri, block_tags=set(), unblock_tags=tags), projects
    )


def get_metrics_blocking_state(projects: Sequence[Project]) -> Mapping[int, MetricsBlockingState]:
    metrics_blocking_state_by_project = {}

    for project in projects:
        metrics_blocking_state_by_project[project.id] = MetricsBlockingState.load_from_project(
            project=project, repair=False
        )

    return metrics_blocking_state_by_project


def get_metrics_blocking_state_for_relay_config(
    project: Project,
) -> MetricsBlockingStateRelayConfig | None:
    try:
        metrics_blocking_state = get_metrics_blocking_state([project])[project.id]
    except MalformedBlockedMetricsPayloadError as e:
        sentry_sdk.capture_exception(e)
        # In case of a malformed configuration, we will notify Sentry and return no metrics, since it's an unrecoverable
        # situation, unless we want to force overwrite the config.
        return None

    denied_names = []
    denied_tags = []
    for metric_blocking in metrics_blocking_state.metrics.values():
        if metric_blocking.is_blocked:
            denied_names.append(metric_blocking.metric_mri)
        elif metric_blocking.blocked_tags:
            denied_tags.append(
                DeniedTagRelayConfig(
                    name=[metric_blocking.metric_mri], tags=list(metric_blocking.blocked_tags)
                )
            )
    if not denied_names and not denied_tags:
        return None

    return MetricsBlockingStateRelayConfig(deniedNames=denied_names, deniedTags=denied_tags)
