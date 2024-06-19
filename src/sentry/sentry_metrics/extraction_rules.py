from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sentry.models.project import Project
from sentry.sentry_metrics.use_case_utils import string_to_use_case_id
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import json

METRICS_EXTRACTION_RULES_OPTION_KEY = "sentry:metrics_extraction_rules"


class MetricsExtractionRuleValidationError(ValueError):
    pass


HARD_CODED_UNITS = {"span.duration": "millisecond"}
ALLOWED_TYPES = {"c", "d", "s"}


@dataclass
class MetricsExtractionRule:
    def __init__(
        self, span_attribute: str, type: str, unit: str, tags: set[str], conditions: list[str]
    ):

        self.span_attribute = span_attribute
        self.type = self.validate_type(type)
        self.unit = HARD_CODED_UNITS.get(span_attribute, "none")
        self.tags = tags
        self.conditions = conditions

    def validate_type(self, type_value: str):
        if type_value not in ALLOWED_TYPES:
            raise ValueError(
                "Type can only have the following values: 'c' for counter, 'd' for distribution, or 's' for set. "
            )
        return type_value

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]) -> "MetricsExtractionRule":

        return MetricsExtractionRule(
            span_attribute=dictionary["spanAttribute"],
            type=dictionary["type"],
            unit=dictionary["unit"],
            tags=set(dictionary.get("tags") or set()),
            conditions=list(dictionary.get("conditions") or []),
        )

    def to_dict(self) -> Mapping[str, Any]:
        return {
            "spanAttribute": self.span_attribute,
            "type": self.type,
            "unit": self.unit,
            "tags": self.tags,
            "conditions": self.conditions,
        }

    def generate_mri(self, use_case: str = "custom"):
        """Generate the Metric Resource Identifier (MRI) associated with the extraction rule."""
        use_case_id = string_to_use_case_id(use_case)
        return f"{self.type}:{use_case_id.value}/{self.span_attribute}@{self.unit}"

    def __hash__(self):
        return hash(self.generate_mri())


@dataclass(frozen=True)
class MetricsExtractionRuleState:
    rules: dict[str, MetricsExtractionRule]

    @classmethod
    def load_from_project(cls, project: Project) -> "MetricsExtractionRuleState":
        json_payload = project.get_option(METRICS_EXTRACTION_RULES_OPTION_KEY)
        return MetricsExtractionRuleState.from_json(json_payload)

    @classmethod
    def from_json(cls, json_payload: str):
        if not json_payload:
            return MetricsExtractionRuleState(rules={})
        try:
            metrics_extraction_rules = json.loads(json_payload)
        except Exception:
            raise MetricsExtractionRuleValidationError("Invalid JSON Payload.")

        rules: dict[str, MetricsExtractionRule] = {}
        for metrics_extraction_rule in metrics_extraction_rules:
            rule = MetricsExtractionRule.from_dict(metrics_extraction_rule)
            if rule is not None:
                mri = rule.generate_mri()
                rules[mri] = rule

        return MetricsExtractionRuleState(rules=rules)

    def save_to_project(self, project: Project) -> None:
        metrics_extraction_rules = [rule.to_dict() for rule in self.rules.values()]

        json_payload = json.dumps(metrics_extraction_rules)
        project.update_option(METRICS_EXTRACTION_RULES_OPTION_KEY, json_payload)

        # We invalidate the project configuration once the updated settings were stored.
        schedule_invalidate_project_config(
            project_id=project.id, trigger="metrics_extraction_rules"
        )
        return

    def get_rules(self) -> Sequence[MetricsExtractionRule]:
        return list(self.rules.values())

    def delete_rule(self, rule: MetricsExtractionRule) -> None:
        mri = rule.generate_mri()
        if mri in self.rules:
            del self.rules[mri]
        else:
            return


def create_metrics_extraction_rules(
    project: Project, state_update: dict[str, MetricsExtractionRule]
) -> Sequence[MetricsExtractionRule]:
    state = MetricsExtractionRuleState.load_from_project(project)
    state.rules.update(state_update)
    state.save_to_project(project)
    return state.get_rules()


def update_metrics_extraction_rules(
    project: Project, state_update: dict[str, MetricsExtractionRule]
) -> Sequence[MetricsExtractionRule]:
    state = MetricsExtractionRuleState.load_from_project(project)
    state.rules.update(state_update)
    state.save_to_project(project)
    return state.get_rules()


def delete_metrics_extraction_rules(
    project: Project, state_update: Sequence[MetricsExtractionRule]
) -> None:
    state = MetricsExtractionRuleState.load_from_project(project)
    for rule in state_update:
        state.delete_rule(rule)

    state.save_to_project(project)
    return


def get_metrics_extraction_rules(project: Project) -> Sequence[MetricsExtractionRule]:
    state = MetricsExtractionRuleState.load_from_project(project)
    return state.get_rules()
