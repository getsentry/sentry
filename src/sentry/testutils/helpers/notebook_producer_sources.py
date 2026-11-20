from __future__ import annotations

from typing import Any
from unittest import TestCase

from rest_framework import serializers

from sentry.models.organization import Organization
from sentry.notebooks.endpoints.validators.base import StrictCamelSnakeValidator
from sentry.notebooks.services.producer_sources import (
    PRODUCER_SOURCE_TYPES,
    ProducerSourceType,
    ResolvedProducerSource,
    register_producer_source_type,
)


class ExampleSourceValidator(StrictCamelSnakeValidator):
    issue_id = serializers.IntegerField(min_value=1)
    project_id = serializers.IntegerField(min_value=1)


def resolve_example_source(
    organization: Organization, values: dict[str, Any]
) -> ResolvedProducerSource:
    return ResolvedProducerSource(
        key=str(values["issue_id"]),
        source={"ref": {"issueId": values["issue_id"]}},
        project_ids=[values["project_id"]],
    )


EXAMPLE_SOURCE_TYPE = ProducerSourceType(
    name="example_issue",
    producer="example",
    validator=ExampleSourceValidator,
    resolve=resolve_example_source,
)


def register_example_source_type(test: TestCase) -> ProducerSourceType:
    register_producer_source_type(EXAMPLE_SOURCE_TYPE)
    test.addCleanup(PRODUCER_SOURCE_TYPES.pop, EXAMPLE_SOURCE_TYPE.name)
    return EXAMPLE_SOURCE_TYPE
