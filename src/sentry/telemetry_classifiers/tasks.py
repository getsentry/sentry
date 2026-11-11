from __future__ import annotations

import hashlib
import logging
from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta

from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_classifiers_tasks
from sentry.telemetry_classifiers.constants import RESULT_ATTRIBUTE_PREFIX
from sentry.telemetry_classifiers.datasets import DATASETS
from sentry.telemetry_classifiers.definitions import (
    InvalidClassifierDefinition,
    resolve_classifier_definition,
)
from sentry.telemetry_classifiers.inference import (
    ClassifierExecutionError,
    classify,
    parse_binary_result,
)
from sentry.telemetry_classifiers.inputs import fit_events
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.results import write_result
from sentry.telemetry_classifiers.types import (
    TelemetryClassifierOutputType,
    TelemetryClassifierStatus,
)
from sentry.utils import metrics
from sentry.utils.redis import redis_clusters
from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)

# How often classifiers select entities. Matches the schedule_classifiers cron.
SCAN_INTERVAL = timedelta(minutes=5)
# Long enough to outlive retries of a scan window's selection.
_CLAIM_TTL_SECONDS = 60 * 60


@instrumented_task(
    name="sentry.telemetry_classifiers.tasks.schedule_classifiers",
    namespace=telemetry_classifiers_tasks,
    expires=300,
    silo_mode=SiloMode.CELL,
)
def schedule_classifiers() -> None:
    """Start selection for every enabled classifier over the scan window that just ended."""
    interval = int(SCAN_INTERVAL.total_seconds())
    end = int(timezone.now().timestamp()) // interval * interval
    start = end - interval

    classifiers = TelemetryClassifier.objects.filter(
        status=TelemetryClassifierStatus.ENABLED,
        project__status=ObjectStatus.ACTIVE,
        project__organization__status=ObjectStatus.ACTIVE,
    ).select_related("project__organization")
    processing_enabled: dict[int, bool] = {}
    for classifier in classifiers:
        organization = classifier.project.organization
        if organization.id not in processing_enabled:
            processing_enabled[organization.id] = features.has(
                "organizations:classifiers-processing", organization
            )
        if processing_enabled[organization.id]:
            select_entities.delay(classifier_id=classifier.id, start=start, end=end)


@instrumented_task(
    name="sentry.telemetry_classifiers.tasks.select_entities",
    namespace=telemetry_classifiers_tasks,
    expires=300,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=30, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def select_entities(classifier_id: int, start: int, end: int) -> None:
    """Classify the entities whose cooldown ended in ``[start, end)``, as Unix timestamps."""
    classifier = _get_enabled_classifier(classifier_id)
    if classifier is None:
        return
    dataset = DATASETS.get(classifier.dataset)
    if dataset is None:
        _record_selection("unsupported_dataset", classifier.dataset)
        return

    limit = options.get("telemetry-classifiers.select-limit")
    with _system_viewer(classifier.project):
        try:
            entity_ids = dataset.select(
                classifier.project,
                classifier.filter_query,
                datetime.fromtimestamp(start, tz=UTC),
                datetime.fromtimestamp(end, tz=UTC),
                limit,
            )
        except InvalidSearchQuery:
            _record_selection("invalid_filter", classifier.dataset)
            return

    # Entities beyond the limit aren't classified in this window.
    if len(entity_ids) >= limit:
        _record_selection("limit_reached", classifier.dataset)
    for entity_id in _claim(classifier_id, entity_ids, start):
        classify_entity.delay(classifier_id=classifier_id, entity_id=entity_id)


@instrumented_task(
    name="sentry.telemetry_classifiers.tasks.classify_entity",
    namespace=telemetry_classifiers_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=30, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def classify_entity(classifier_id: int, entity_id: str) -> None:
    """Classify one entity's telemetry and write the result to EAP."""
    classifier = _get_enabled_classifier(classifier_id)
    if classifier is None:
        _record_classification("classifier_missing", None)
        return
    dataset = DATASETS.get(classifier.dataset)
    if dataset is None:
        _record_classification("unsupported_dataset", classifier.dataset)
        return
    try:
        definition = resolve_classifier_definition(classifier)
    except InvalidClassifierDefinition:
        _record_classification("invalid_definition", classifier.dataset)
        return
    # TODO: Parse choice and score results once Seer has models for them.
    if definition.output_type != TelemetryClassifierOutputType.BINARY:
        _record_classification("unsupported_output", classifier.dataset)
        return

    project = classifier.project
    with _system_viewer(project):
        source = dataset.load(project, entity_id)
        if source is None:
            _record_classification("no_input", classifier.dataset)
            return
        prepared = fit_events(source.events)
        if not prepared.events:
            _record_classification("no_input", classifier.dataset)
            return
        try:
            result = classify(definition, prepared.events, project.organization)
            probability = parse_binary_result(result)
        except ClassifierExecutionError as error:
            _record_classification(error.reason, classifier.dataset)
            logger.warning(
                "telemetry_classifiers.classify.failed",
                extra={
                    "classifier_id": classifier.id,
                    "entity_id": entity_id,
                    "reason": error.reason,
                    "retryable": error.retryable,
                },
            )
            if error.retryable:
                raise
            return

    write_result(
        classifier,
        entity_id,
        source,
        {f"{RESULT_ATTRIBUTE_PREFIX}{classifier.result_attribute}": probability},
        dataset.data_category,
    )
    _record_classification("success", classifier.dataset)
    logger.info(
        "telemetry_classifiers.classify.succeeded",
        extra={
            "classifier_id": classifier.id,
            "entity_id": entity_id,
            "probability": probability,
            "event_count": len(prepared.events),
            "truncated": source.truncated or prepared.truncated,
        },
    )


def _get_enabled_classifier(classifier_id: int) -> TelemetryClassifier | None:
    return (
        TelemetryClassifier.objects.filter(
            id=classifier_id, status=TelemetryClassifierStatus.ENABLED
        )
        .select_related("project__organization")
        .first()
    )


def _claim(classifier_id: int, entity_ids: Sequence[str], start: int) -> list[str]:
    """Return the entities not yet claimed for this classifier and scan window, and claim them.

    Selection can run more than once for a window, such as on retries. Claims make sure each
    entity is classified once.
    """
    if not entity_ids:
        return []
    client = redis_clusters.get("default")
    with client.pipeline(transaction=False) as pipeline:
        for entity_id in entity_ids:
            # Entity IDs come from telemetry, so they're hashed to bound the key's length.
            digest = hashlib.sha256(entity_id.encode()).hexdigest()
            pipeline.set(
                f"telemetry-classifiers:claim:{classifier_id}:{start}:{digest}",
                b"1",
                ex=_CLAIM_TTL_SECONDS,
                nx=True,
            )
        claims = pipeline.execute()
    return [entity_id for entity_id, claimed in zip(entity_ids, claims) if claimed]


def _system_viewer(project: Project) -> AbstractContextManager[None]:
    return viewer_context_scope(
        ViewerContext(
            actor=Actor(type=ActorType.SYSTEM),
            organization_id=project.organization_id,
            project_id=project.id,
        )
    )


def _record_selection(outcome: str, dataset: str) -> None:
    metrics.incr("telemetry_classifiers.select", tags={"dataset": dataset, "outcome": outcome})


def _record_classification(outcome: str, dataset: str | None) -> None:
    metrics.incr(
        "telemetry_classifiers.classify",
        tags={"dataset": dataset or "unknown", "outcome": outcome},
    )
