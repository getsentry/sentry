from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry.sentry_metrics.configuration import (
    AGGREGATES_TO_METRICS,
    ALLOWED_TYPES,
    HARD_CODED_UNITS,
)
from sentry.sentry_metrics.use_case_utils import string_to_use_case_id

METRICS_EXTRACTION_RULES_OPTION_KEY = "sentry:metrics_extraction_rules"


class MetricsExtractionRuleValidationError(ValueError):
    pass


# Plan
# 1. Interface
#       - JSON: type -> aggregates and used to create multiple metrics extraction rules
#       - everything else stays the same
#       - the condition or the  MetricsExtractionRule should have an ID (?)
#
# 2. Metrics Extraction Rule class
#       - type
#       - tags
#       - unit
#       - span attribute
#       - id of the rule ?
#       - what is the MRI?
#
# 3. Project Option Content
#       - add versioning to invalidate older verison & add ability to migrate
#
# 4. Serialization to Project Config
#       - keep serializing the sequence of metrics extraction rule class to the project config

# planning
# - extraction rules without conditions need to be possible !
# - date created for each filter/condition (& modified?)
# - allow units
# - what happens to the span attribute extraction rules if the unit is changed?
#       - how do we persist the filters that have been updated or deleted?
# - django model?


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
        types = set()
        for aggregate in aggregates:
            types.update(AGGREGATES_TO_METRICS.get(aggregate))

        return types

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]) -> "MetricsExtractionRule":
        return MetricsExtractionRule(
            span_attribute=dictionary["spanAttribute"],
            type=dictionary["type"],
            unit=dictionary["unit"],
            tags=set(dictionary.get("tags") or set()),
            condition=dictionary.get("condition"),
            id=dictionary.get("id"),
        )

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
        if self.type in ("s", "c"):
            return f"{self.type}:{use_case_id.value}/internal_{self.id}@none"
        else:
            return f"{self.type}:{use_case_id.value}/internal_{self.id}@{self.unit}"

    def __hash__(self):
        return hash(self.generate_mri())


"""
def generate_rules(config: SpanAttributeExtractionRuleConfig) -> Sequence[MetricsExtractionRule]:
    rules = []
    metric_types = MetricsExtractionRule.infer_types(config.aggregates)
    for id, condition in config.conditions.items():
        for metric_type in metric_types:
            rules.append(
                MetricsExtractionRule(
                    span_attribute=config.span_attribute,
                    type=metric_type,
                    unit=config.unit,
                    tags=config.tags,
                    condition=condition,
                    id=id,
                )
            )
    return rules
"""
