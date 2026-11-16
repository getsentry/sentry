from __future__ import annotations

from collections.abc import Mapping

from sentry import quotas
from sentry.constants import DataCategory
from sentry.telemetry_classifiers.eap.producer import (
    EnrichmentAttributeValue,
    produce_enrichment_attributes,
)
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.types import TelemetryInput

# Used when the organization's retention for the category isn't limited.
_DEFAULT_RETENTION_DAYS = 30


def write_result(
    classifier: TelemetryClassifier,
    entity_id: str,
    source: TelemetryInput,
    attributes: Mapping[str, EnrichmentAttributeValue],
    category: DataCategory,
) -> None:
    """Write a classifier's result for one entity to EAP.

    Retries for the same entity and newest span replace the same EAP item. When the entity gets
    newer spans, the new result is a separate item. The result keeps the organization's
    retention for ``category``, the kind of telemetry it was classified from.
    """
    project = classifier.project
    retention_days = quotas.backend.get_event_retention(
        organization=project.organization, category=category
    )
    produce_enrichment_attributes(
        project,
        idempotency_key=f"{classifier.id}:{entity_id}:{source.timestamp.isoformat()}",
        trace_id=source.trace_id,
        timestamp=source.timestamp,
        retention_days=retention_days or _DEFAULT_RETENTION_DAYS,
        attributes=attributes,
        conversation_id=source.conversation_id,
        client_sample_rate=source.client_sample_rate,
    )
