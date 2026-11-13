from __future__ import annotations

import hashlib
import logging
from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import timedelta

from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import options
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
from sentry.utils.cursored_scheduler import CursoredScheduler
from sentry.utils.redis import redis_clusters
from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)

# How often each classifier selects entities.
SCAN_INTERVAL = timedelta(minutes=5)
# Each selection covers three scan intervals, so windows overlap and an entity one selection
# misses is picked up by the next. Longer gaps are skipped, so selection never falls behind.
_SELECT_WINDOW = 3 * SCAN_INTERVAL
# Outlives every selection whose window can include an entity, so each entity is enqueued once.
_ENQUEUED_TTL_SECONDS = int((2 * _SELECT_WINDOW).total_seconds())


@instrumented_task(
    name="sentry.telemetry_classifiers.tasks.schedule_classifiers",
    namespace=telemetry_classifiers_tasks,
    expires=SCAN_INTERVAL,
    silo_mode=SiloMode.CELL,
)
def schedule_classifiers() -> None:
    """Start selection for each enabled classifier once per SCAN_INTERVAL.

    The schedule ticks more often than SCAN_INTERVAL, so classifiers are spread across it.
    """
    CursoredScheduler(
        name="telemetry_classifiers",
        schedule_key="telemetry-classifiers-schedule",
        queryset=TelemetryClassifier.objects.filter(
            status=TelemetryClassifierStatus.ENABLED,
            project__status=ObjectStatus.ACTIVE,
            project__organization__status=ObjectStatus.ACTIVE,
        ),
        task=select_entities,
        cycle_duration=SCAN_INTERVAL,
    ).tick()


@instrumented_task(
    name="sentry.telemetry_classifiers.tasks.select_entities",
    namespace=telemetry_classifiers_tasks,
    expires=SCAN_INTERVAL,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=30, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def select_entities(classifier_id: int) -> None:
    """Classify the entities whose cooldown ended recently, unless they were already enqueued."""
    classifier = _get_enabled_classifier(classifier_id)
    if classifier is None:
        return
    dataset = DATASETS.get(classifier.dataset)
    if dataset is None:
        _count_selection("unsupported_dataset", classifier.dataset)
        return

    end = timezone.now()
    limit = options.get("telemetry-classifiers.select-limit")
    enqueued = 0
    offset = 0
    # Pages go newest first, until the window is exhausted or the limit of entities was enqueued.
    # Entities already enqueued are skipped, so later pages can still have entities to enqueue.
    while enqueued < limit:
        try:
            page = dataset.select(
                classifier.project,
                classifier.filter_query,
                end - _SELECT_WINDOW,
                end,
                limit,
                offset,
            )
        except InvalidSearchQuery:
            _count_selection("invalid_filter", classifier.dataset)
            return
        enqueued += _enqueue_classifications(classifier_id, page, limit - enqueued)
        if len(page) < limit:
            return
        offset += limit
    # Older entities in the window aren't classified.
    _count_selection("limit_reached", classifier.dataset)


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
        _count_classification("classifier_missing", None)
        return
    dataset = DATASETS.get(classifier.dataset)
    if dataset is None:
        _count_classification("unsupported_dataset", classifier.dataset)
        return
    try:
        definition = resolve_classifier_definition(classifier)
    except InvalidClassifierDefinition:
        _count_classification("invalid_definition", classifier.dataset)
        return
    # TODO: Parse choice and score results once Seer has models for them.
    if definition.output_type != TelemetryClassifierOutputType.BINARY:
        _count_classification("unsupported_output", classifier.dataset)
        return

    project = classifier.project
    source = dataset.load(project, entity_id)
    if source is None:
        _count_classification("no_input", classifier.dataset)
        return
    prepared = fit_events(source.events)
    if not prepared.events:
        _count_classification("no_input", classifier.dataset)
        return
    try:
        # Seer requests carry the viewer, and this task runs without one.
        with _system_viewer(project):
            result = classify(definition, prepared.events, project.organization)
        probability = parse_binary_result(result)
    except ClassifierExecutionError as error:
        _count_classification(error.reason, classifier.dataset)
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
    _count_classification("success", classifier.dataset)
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


def _enqueue_classifications(classifier_id: int, entity_ids: Sequence[str], limit: int) -> int:
    """Enqueue classification for up to ``limit`` entities not enqueued yet, and return how many."""
    if not entity_ids:
        return 0
    client = redis_clusters.get("default")
    keys = [_enqueued_key(classifier_id, entity_id) for entity_id in entity_ids]
    enqueued = 0
    for entity_id, key, already_enqueued in zip(entity_ids, keys, client.mget(keys)):
        if enqueued >= limit:
            break
        # Windows overlap and selections retry, so an entity can be selected again.
        if already_enqueued:
            continue
        classify_entity.delay(classifier_id=classifier_id, entity_id=entity_id)
        # Marked after enqueueing, so an entity is skipped only once it was enqueued.
        client.set(key, b"1", ex=_ENQUEUED_TTL_SECONDS)
        enqueued += 1
    return enqueued


def _enqueued_key(classifier_id: int, entity_id: str) -> str:
    # Entity IDs come from telemetry, so they're hashed to bound the key's length.
    digest = hashlib.sha256(entity_id.encode()).hexdigest()
    return f"telemetry-classifiers:enqueued:{classifier_id}:{digest}"


def _system_viewer(project: Project) -> AbstractContextManager[None]:
    return viewer_context_scope(
        ViewerContext(
            actor=Actor(type=ActorType.SYSTEM),
            organization_id=project.organization_id,
            project_id=project.id,
        )
    )


def _count_selection(outcome: str, dataset: str) -> None:
    metrics.incr("telemetry_classifiers.select", tags={"dataset": dataset, "outcome": outcome})


def _count_classification(outcome: str, dataset: str | None) -> None:
    metrics.incr(
        "telemetry_classifiers.classify",
        tags={"dataset": dataset or "unknown", "outcome": outcome},
    )
