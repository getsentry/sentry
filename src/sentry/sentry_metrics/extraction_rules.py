from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry.sentry_metrics.configuration import (
    AGGREGATE_TO_METRIC_TYPE,
    ALLOWED_TYPES,
    HARD_CODED_UNITS,
)
from sentry.sentry_metrics.use_case_utils import string_to_use_case_id

METRICS_EXTRACTION_RULES_OPTION_KEY = "sentry:metrics_extraction_rules"
SPAN_ATTRIBUTE_PREFIX = "span_attribute_"


class MetricsExtractionRuleValidationError(ValueError):
    pass


@dataclass
class MetricsExtractionRule:
    def __init__(
        self,
        span_attribute: str,
        type: str,
        unit: str,
        tags: set[str],
        condition: str,
        id: int,
    ):
        self.span_attribute = self.validate_span_attribute(span_attribute)
        self.type = self.validate_type(type)
        self.unit = HARD_CODED_UNITS.get(span_attribute, unit)
        self.tags = set(tags)
        self.condition = condition
        self.id = id

    def validate_span_attribute(self, span_attribute: str) -> str:
        if not isinstance(span_attribute, str):
            raise ValueError("The span attribute must be of type string.")
        return span_attribute

    def validate_type(self, type_value: str) -> str:
        if not isinstance(type_value, str):
            raise ValueError("The type must be of type string.")

        if type_value not in ALLOWED_TYPES:
            raise ValueError(
                "Type can only have the following values: 'c' for counter, 'd' for distribution, 'g' for gauge, or 's' for set."
            )
        return type_value

    @classmethod
    def infer_types(self, aggregates: set[str]) -> set[str]:
        types: set[str] = set()
        for aggregate in aggregates:
            if new_type := AGGREGATE_TO_METRIC_TYPE.get(aggregate):
                types.add(new_type)

        return types

    def to_dict(self) -> Mapping[str, Any]:
        return {
            "spanAttribute": self.span_attribute,
            "type": self.type,
            "unit": self.unit,
            "tags": self.tags,
            "condition": self.condition,
            "id": self.id,
        }

    def generate_mri(self, use_case: str = "custom"):
        """Generate the Metric Resource Identifier (MRI) associated with the extraction rule."""
        use_case_id = string_to_use_case_id(use_case)
        return f"{self.type}:{use_case_id.value}/{SPAN_ATTRIBUTE_PREFIX}{self.id}@none"

    def __hash__(self):
        return hash(self.generate_mri())
