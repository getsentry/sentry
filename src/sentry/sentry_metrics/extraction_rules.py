from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sentry.models.project import Project
from sentry.utils import json

METRICS_EXTRACTION_RULES_OPTION_KEY = "sentry:metrics_extraction_rules"


class MetricsExtractionRuleValidationError(ValueError):
    pass


@dataclass(frozen=True)
class MetricsExtractionRule:
    span_attribute: str
    type: str
    unit: str
    tags: set[str]

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]) -> "MetricsExtractionRule":
        return MetricsExtractionRule(
            span_attribute=dictionary["span_attribute"],
            type=dictionary["type"],
            unit=dictionary["unit"],
            tags=set(dictionary.get("tags") or set()),
        )

    def to_dict(self) -> Mapping[str, Any]:
        return self.__dict__

    def generate_mri(self, use_case: str = "custom"):
        """Generate the Metric Resource Identifier (MRI) associated with the extraction rule."""
        return f"{self.type}:{use_case}/{self.span_attribute}@{self.unit}"

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
        # once this is live, we need to invalidate the relay project config here.
        return

    def get_rules(self) -> Sequence[MetricsExtractionRule]:
        return list(self.rules.values())

    def delete_rule(self, rule: MetricsExtractionRule) -> None:
        mri = rule.generate_mri()
        if mri in self.rules:
            del self.rules[mri]
        else:
            return


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
