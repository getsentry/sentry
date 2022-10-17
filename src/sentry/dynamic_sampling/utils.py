from abc import ABC, abstractmethod
from typing import Any, List, TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from sentry_relay.processing import validate_sampling_configuration

from sentry import features, quotas
from sentry.models import Project
from sentry.utils import json

UNIFORM_RULE_RESERVED_ID = 0


class Condition(TypedDict):
    op: str
    inner: List[Any]


class UniformRule(TypedDict):
    sampleRate: float
    type: str
    active: bool
    condition: Condition
    id: int


class DynamicSamplingBuilder(ABC):
    @abstractmethod
    def validate_rules(self, project: Project, request: Request, data):
        raise NotImplementedError

    @staticmethod
    def validate_configuration_with_relay(data):
        config_str = json.dumps(data)
        validate_sampling_configuration(config_str)


class DynamicSamplingV1Builder(DynamicSamplingBuilder):
    def validate_rules(self, project: Project, request: Request, data):
        try:
            self.validate_configuration_with_relay(data)

            # If the feature flag 'organizations:dynamic-sampling-demo' is enabled, we skip the uniform rule validation.
            # This is useful for product demos, as the user will be able to delete uniform rules.
            if (
                features.has(
                    "organizations:dynamic-sampling-demo",
                    project.organization,
                    actor=request.user,
                )
                is False
            ):
                self.validate_uniform_sampling_rule(data.get("rules", []))
        except ValueError as err:
            reason = err.args[0] if len(err.args) > 0 else "invalid configuration"
            raise serializers.ValidationError(reason)

        return data


class DynamicSamplingV2Builder(DynamicSamplingBuilder):
    @staticmethod
    def generate_uniform_rule(project: Project) -> UniformRule:
        return {
            "sampleRate": quotas.get_blended_sample_rate(project),
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [],
            },
            "id": UNIFORM_RULE_RESERVED_ID,
        }

    def validate_rules(self, project: Project, request: Request, data):
        try:
            config_str = json.dumps(data)
            # ToDo: Inject before relay validation the uniform rule
            validate_sampling_configuration(config_str)

            self.validate_uniform_sampling_rule(data.get("rules", []))
        except ValueError as err:
            reason = err.args[0] if len(err.args) > 0 else "invalid configuration"
            raise serializers.ValidationError(reason)

        return data
