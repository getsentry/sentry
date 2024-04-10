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

Each feature flag has a list of segments. If the conditions for a segment match
the evaluation context a feature is granted. Segments can contain multiple conditions
and all conditions in a segment must match. A segment with multiple conditions looks like:

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

Each segment has one or more operators. All operators in a segment must
evaluate to true. At least one segment must evaluate to true in order to
grant a feature.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ValidationError, constr

from flagpole.conditions import Condition
from flagpole.evaluation_context import ContextBuilder, EvaluationContext
from sentry.utils import json


class InvalidFeatureFlagConfiguration(Exception):
    pass


class Segment(BaseModel):
    name: constr(min_length=1)  # type:ignore[valid-type]
    conditions: list[Condition]
    rollout: int | None = 0

    def match(self, context: EvaluationContext) -> bool:
        for condition in self.conditions:
            match_condition = condition.match(context, segment_name=self.name)
            if not match_condition:
                return False
        # Apply incremental rollout if available.
        if self.rollout is not None and self.rollout < 100:
            return context.id() % 100 <= self.rollout

        return True


class Feature(BaseModel):
    name: constr(min_length=1, to_lower=True)  # type:ignore[valid-type]
    owner: constr(min_length=1)  # type:ignore[valid-type]
    segments: list[Segment]
    """A list of segments to evaluate against the provided data"""
    enabled: bool = True
    """Defines whether or not the feature is enabled."""
    created_at: datetime = Field(default_factory=datetime.now)
    """This datetime is when this instance was created. It can be used to decide when to re-read configuration data"""
    context_builder: ContextBuilder | None = None
    """Optional builder used to transform passed in data to an EvaluationContext whenever this feature is evaluated."""

    def match(self, context_data: dict[str, Any]) -> bool:
        if self.context_builder is not None:
            context = self.context_builder.build(context_data)
        else:
            context = EvaluationContext(context_data)

        if self.enabled:
            for segment in self.segments:
                if segment.match(context):
                    return True

        return False

    def dump_schema_to_file(self, file_path: str) -> None:
        with open(file_path, "w") as file:
            file.write(self.schema_json())

    @classmethod
    def from_feature_dictionary(
        cls, name: str, config_dict: dict[str, Any], context_builder: ContextBuilder | None
    ) -> Feature:
        try:
            feature = cls(name=name, **config_dict)
        except ValidationError as exc:
            raise InvalidFeatureFlagConfiguration("Provided JSON is not a valid feature") from exc

        if context_builder is not None:
            feature.context_builder = context_builder

        return feature

    @classmethod
    def from_feature_config_json(
        cls, name: str, config_json: str, context_builder: ContextBuilder | None = None
    ) -> Feature:
        try:
            config_data_dict = json.loads(config_json)
        except json.JSONDecodeError as decode_error:
            raise InvalidFeatureFlagConfiguration("Invalid feature json provided") from decode_error

        if not isinstance(config_data_dict, dict):
            raise InvalidFeatureFlagConfiguration("Feature JSON is not a valid feature")

        return cls.from_feature_dictionary(
            name=name, config_dict=config_data_dict, context_builder=context_builder
        )


__all__ = ["Feature", "InvalidFeatureFlagConfiguration", "ContextBuilder"]
