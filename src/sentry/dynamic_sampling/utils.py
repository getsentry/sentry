from abc import ABC, abstractmethod
from typing import Any, List, TypedDict

from sentry_relay.processing import validate_sampling_configuration

from sentry import quotas
from sentry.models import Project
from sentry.utils import json


class Condition(TypedDict):
    op: str
    inner: List[Any]


class UniformDSRule(TypedDict):
    sampleRate: float
    type: str
    active: bool
    condition: Condition
    id: int


class DynamicSamplingDetails(ABC):
    def __init__(self, project: Project, data):
        self.project = project
        self.data = data

    @abstractmethod
    def inject_floored_uniform_sampling_rule(self):
        raise NotImplementedError

    @abstractmethod
    def on_each_rule(self, next_id, rule, original_rules_dict) -> int:
        raise NotImplementedError

    @abstractmethod
    def validate_configuration_with_floored_sample_rate(self):
        raise NotImplementedError

    def update_rules_ids(self):
        """
        Fixes rule ids in sampling configuration

        When rules are changed or new rules are introduced they will get
        new ids
        :pparam raw_dynamic_sampling: the dynamic sampling config coming from UI
            validated but without adjusted rule ids
        :return: the dynamic sampling config with the rule ids adjusted to be
        unique and with the next_id updated
        """

        # get the existing configuration for comparison.
        original = self.project.get_option("sentry:dynamic_sampling")
        original_rules = []

        if original is None:
            next_id = 1
        else:
            next_id = original.get("next_id", 1)
            original_rules = original.get("rules", [])

        # make a dictionary with the old rules to compare for changes
        original_rules_dict = {rule["id"]: rule for rule in original_rules}

        if self.data is not None:
            rules = self.data.get("rules", [])

            for rule in rules:
                next_id = self.on_each_rule(next, rule, original_rules_dict)

        self.data["next_id"] = next_id

    def generate_uniform_rule(self) -> UniformDSRule:
        return {
            "sampleRate": quotas.get_blended_sample_rate(self.project),
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [],
            },
            "id": 0,
        }

    def validate_configuration_with_relay(self):
        config_str = json.dumps(self.data)
        validate_sampling_configuration(config_str)


class DynamicSamplingDetailsV1(DynamicSamplingDetails):
    def inject_floored_uniform_sampling_rule(self):
        pass

    def on_each_rule(self, next_id, rule, original_rules_dict):
        # We are setting the unassigned id to -1. It used to be 0 but we are modifying the behavior as 0 is a
        # valid id according to relay's rule validation which states the a rule id is an unsigned integer.
        rid = rule.get("id", -1)
        original_rule = original_rules_dict.get(rid)
        # ToDo(ahmed): Temporarily allowing for 0 to be the unassigned rule id for backwards compatibility,
        #  and will remove that once the UI changes are deployed.
        if rid in {0, -1} or original_rule is None:
            # a new or unknown rule give it a new id
            rule["id"] = next_id
            next_id += 1
        else:
            if original_rule != rule:
                # something changed in this rule, give it a new id
                rule["id"] = next_id
                next_id += 1

        return next_id

    def validate_configuration_with_floored_sample_rate(self):
        pass


class DynamicSamplingDetailsV2(DynamicSamplingDetails):
    def inject_floored_uniform_sampling_rule(self):
        rules = self.data.get("rules", [])
        rules.append(self.generate_uniform_rule())

    def on_each_rule(self, next_id, rule, original_rules_dict):
        # We are setting the unassigned id to -1. It used to be 0 but we are modifying the behavior as 0 is a
        # valid id according to relay's rule validation which states the a rule id is an unsigned integer.
        rid = rule.get("id", -1)
        original_rule = original_rules_dict.get(rid)
        # ToDo(ahmed): Temporarily allowing for 0 to be the unassigned rule id for backwards compatibility,
        #  and will remove that once the UI changes are deployed.
        if rid in {0, -1} or original_rule is None:
            # a new or unknown rule give it a new id
            rule["id"] = next_id
            next_id += 1
        else:
            if original_rule != rule:
                # something changed in this rule, give it a new id
                rule["id"] = next_id
                next_id += 1

        return next_id

    def validate_configuration_with_floored_sample_rate(self):
        self.data.get("rule", [])
        # TODO: implement proper check.
