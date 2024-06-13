from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Optional

from sentry.models.project import Project
from sentry.utils import json

METRICS_EXTRACTION_RULES_OPTION_KEY = "sentry:metrics_extraction_rules"


@dataclass
class MetricsExtractionRule:
    span_attribute: str
    type: str
    unit: str
    tags: list[str]

    @classmethod
    def from_dict(cls, dictionary: Mapping[str, Any]) -> Optional["MetricsExtractionRule"]:
        return MetricsExtractionRule(
            span_attribute=dictionary["span_attribute"],
            type=dictionary["type"],
            unit=dictionary["unit"],
            tags=dictionary.get("blocked_tags") or [],
        )

    def to_dict(self) -> Mapping[str, Any]:
        return self.__dict__

    def generate_mri(self, use_case: str = "custom"):
        """Generate the Metric Resource Identifier (MRI) associated with the extraction rule."""
        return f"{self.type}:{use_case}/{self.span_attribute}@{self.unit}"


@dataclass
class MetricsExtractionRuleState:
    rules: dict[str, MetricsExtractionRule]

    @classmethod
    def load_from_project(cls, project: Project) -> "MetricsExtractionRuleState":
        json_payload = project.get_option(METRICS_EXTRACTION_RULES_OPTION_KEY)
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

    def validate(self) -> None:
        raise NotImplementedError()

    def to_json(self) -> dict[str, str | Sequence[str]]:
        raise NotImplementedError()


def update_metrics_extraction_rules(
    project: Project, updated_rules: dict[str, Any]
) -> MetricsExtractionRuleState:
    state = MetricsExtractionRuleState.load_from_project(project)

    for updated_rule in updated_rules.values():
        rule = MetricsExtractionRule.from_dict(updated_rule)
        mri = rule.generate_mri()
        state.rules[mri] = rule

    # validate new state somehow?
    state.validate()
    # save to
    state.save_to_project(project)
    return state


class MetricsExtractionRuleValidationError(ValueError):
    pass


# def delete_metrics_extraction_rules(project: Project)
