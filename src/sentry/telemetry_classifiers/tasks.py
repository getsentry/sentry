from __future__ import annotations

import hashlib
import logging
from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import timedelta

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
from sentry.telemetry_classifiers.datasets.base import SelectedEntity
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
# Each selection covers two scan intervals, so a classifier that runs late doesn't leave a gap.
# Longer gaps are skipped, so selection never falls behind.
_SELECT_WINDOW = 2 * SCAN_INTERVAL
# Long enough to outlive retries and overlapping selections.
_SENT_TTL_SECONDS = 60 * 60
_PROCESSING_FEATURE = "organizations:classifiers-ui"


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
        ).select_related("project__organization"),
        task=select_entities,
        cycle_duration=SCAN_INTERVAL,
        prevalidate_batch=_with_processing_enabled,
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
    """Classify the entities whose cooldown ended recently, unless they were already sent."""
    classifier = _get_enabled_classifier(classifier_id)
    if classifier is None:
        return
    dataset = DATASETS.get(classifier.dataset)
    if dataset is None:
        _record_selection("unsupported_dataset", classifier.dataset)
        return

    end = timezone.now()
    limit = options.get("telemetry-classifiers.select-limit")
    with _system_viewer(classifier.project):
        try:
            selected = dataset.select(
                classifier.project, classifier.filter_query, end - _SELECT_WINDOW, end, limit
            )
        except InvalidSearchQuery:
            _record_selection("invalid_filter", classifier.dataset)
            return

    # Entities beyond the limit aren't classified.
    if len(selected) >= limit:
        _record_selection("limit_reached", classifier.dataset)
    if not selected:
        return
    client = redis_clusters.get("default")
    sent_keys = [_sent_key(classifier_id, entity) for entity in selected]
    for entity, sent_key, sent in zip(selected, sent_keys, client.mget(sent_keys)):
        # Windows overlap and selections retry, so an entity can be selected again.
        if sent:
            continue
        classify_entity.delay(classifier_id=classifier_id, entity_id=entity.entity_id)
        # Marked after sending, so an entity is skipped only once it was sent.
        client.set(sent_key, b"1", ex=_SENT_TTL_SECONDS)


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


def _with_processing_enabled(classifiers: Sequence[TelemetryClassifier]) -> list[int]:
    organizations = {c.project.organization_id: c.project.organization for c in classifiers}
    enabled = features.batch_has_for_organizations(
        _PROCESSING_FEATURE, list(organizations.values())
    )
    if enabled is None:
        return []
    return [c.id for c in classifiers if enabled.get(f"organization:{c.project.organization_id}")]


def _get_enabled_classifier(classifier_id: int) -> TelemetryClassifier | None:
    return (
        TelemetryClassifier.objects.filter(
            id=classifier_id, status=TelemetryClassifierStatus.ENABLED
        )
        .select_related("project__organization")
        .first()
    )


def _sent_key(classifier_id: int, entity: SelectedEntity) -> str:
    """Key marking an entity as sent for its period of activity ending at ``last_seen``.

    Newer telemetry changes ``last_seen``, so an entity that becomes active again is sent again.
    """
    # Entity IDs come from telemetry, so they're hashed to bound the key's length.
    digest = hashlib.sha256(f"{entity.entity_id}:{entity.last_seen.isoformat()}".encode())
    return f"telemetry-classifiers:sent:{classifier_id}:{digest.hexdigest()}"


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
