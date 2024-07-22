"""
Options backed feature flagging.

Entry backed options. Will consume option data that is structured like

```yaml
features:
  organizations:fury-mode:
    enabled: True
    name: sentry organizations
    owner: hybrid-cloud
    segments:
      - name: sentry orgs
        rollout: 50
        conditions:
          - property: organization_slug
            name: internal organizations
            operator:
                kind: in
                value: ["sentry-test", "sentry"]
      - name: free accounts
        conditions:
          - property: subscription_is_free
            name: free subscriptions
            operator:
              kind: equals
              value: True
```

Each feature flag has a list of segments, each of which contain a list of conditions.
If all the conditions for a segment match the evaluation context, a feature is granted.
A segment with multiple conditions looks like:

```yaml
features:
  organizations:fury-mode:
    enabled: True
    owner: hybrid-cloud
    description: sentry organizations
    segments:
      - name: sentry organizations
        rollout: 50
        conditions:
          - name: internal orgs
            property: organization_slug
            operator:
              kind: in
              value: ["sentry-test", "sentry"]
          - name: allowed users
            property: user_email
            operator:
              kind: in
              value: ["mark@sentry.io", "gabe@sentry.io"]
```

Property names are arbitrary and read from an evaluation context
prepared by the application.

Each condition has a single operator. An operator takes a kind (`OperatorKind` enum)
and a value, the type of which depends on the operator specified.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import orjson
import yaml
from pydantic import BaseModel, Field, ValidationError, constr

from flagpole.conditions import ConditionBase, Segment
from flagpole.evaluation_context import ContextBuilder, EvaluationContext


class InvalidFeatureFlagConfiguration(Exception):
    pass


class Feature(BaseModel):
    name: constr(min_length=1, to_lower=True) = Field(  # type:ignore[valid-type]
        description="The feature name."
    )
    "The feature name."

    owner: constr(min_length=1) = Field(  # type:ignore[valid-type]
        description="The owner of this feature. Either an email address or team name, preferably."
    )
    "The owner of this feature. Either an email address or team name, preferably."

    segments: list[Segment] = Field(
        description="The list of segments to evaluate for the feature. An empty list will always evaluate to False."
    )
    "The list of segments to evaluate for the feature. An empty list will always evaluate to False."

    enabled: bool = Field(default=True, description="Whether or not the feature is enabled.")
    "Whether or not the feature is enabled."

    created_at: datetime = Field(description="The datetime when this feature was created.")
    "The datetime when this feature was created."

    def match(self, context: EvaluationContext) -> bool:
        if not self.enabled:
            return False

        for segment in self.segments:
            match = segment.match(context)
            if match:
                return segment.in_rollout(context)

        return False

    @classmethod
    def dump_schema_to_file(cls, file_path: str) -> None:
        with open(file_path, "w") as file:
            file.write(cls.schema_json(indent=2))

    @classmethod
    def from_feature_dictionary(cls, name: str, config_dict: dict[str, Any]) -> Feature:
        try:
            feature = cls(name=name, **config_dict)
        except ValidationError as exc:
            raise InvalidFeatureFlagConfiguration("Provided JSON is not a valid feature") from exc

        return feature

    @classmethod
    def from_feature_config_json(
        cls, name: str, config_json: str, context_builder: ContextBuilder | None = None
    ) -> Feature:
        try:
            config_data_dict = orjson.loads(config_json)
        except orjson.JSONDecodeError as decode_error:
            raise InvalidFeatureFlagConfiguration("Invalid feature json provided") from decode_error

        if not isinstance(config_data_dict, dict):
            raise InvalidFeatureFlagConfiguration("Feature JSON is not a valid feature")

        return cls.from_feature_dictionary(name=name, config_dict=config_data_dict)

    @classmethod
    def from_bulk_json(cls, json: str) -> list[Feature]:
        features: list[Feature] = []
        features_json = orjson.loads(json)

        for feature, json_dict in features_json.items():
            features.append(cls.from_feature_dictionary(name=feature, config_dict=json_dict))

        return features

    @classmethod
    def from_bulk_yaml(cls, yaml_str) -> list[Feature]:
        features: list[Feature] = []
        parsed_yaml = yaml.safe_load(yaml_str)
        for feature, yaml_dict in parsed_yaml.items():
            features.append(cls.from_feature_dictionary(name=feature, config_dict=yaml_dict))

        return features

    def to_dict(self) -> dict[str, Any]:
        json_dict = dict(orjson.loads(self.model_dump_json()))
        json_dict.pop("name")
        return {self.name: json_dict}

    def to_yaml_str(self) -> str:
        return yaml.dump(self.to_dict())

    def to_json_str(self) -> str:
        return orjson.dumps(self.to_dict()).decode()


__all__ = [
    "Feature",
    "InvalidFeatureFlagConfiguration",
    "ContextBuilder",
    "EvaluationContext",
    "Segment",
    "ConditionBase",
]
