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

from pydantic import BaseModel, Field, ValidationError, constr

from flagpole.conditions import Segment
from flagpole.evaluation_context import ContextBuilder, EvaluationContext
from sentry.utils import json


class InvalidFeatureFlagConfiguration(Exception):
    pass


class Feature(BaseModel):
    name: constr(min_length=1, to_lower=True)  # type:ignore[valid-type]
    owner: constr(min_length=1)  # type:ignore[valid-type]
    segments: list[Segment]
    """A list of segments to evaluate against the provided data"""
    enabled: bool = True
    """Defines whether or not the feature is enabled."""
    created_at: datetime = Field(default_factory=datetime.now)
    """This datetime is when this instance was created. It can be used to decide when to re-read configuration data"""

    def match(self, context: EvaluationContext) -> bool:
        if self.enabled:
            for segment in self.segments:
                if segment.match(context):
                    return True

        return False

    def dump_schema_to_file(self, file_path: str) -> None:
        with open(file_path, "w") as file:
            file.write(self.schema_json())

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
            config_data_dict = json.loads_experimental("flagpole.enable-orjson", config_json)
        except json.JSONDecodeError as decode_error:
            raise InvalidFeatureFlagConfiguration("Invalid feature json provided") from decode_error

        if not isinstance(config_data_dict, dict):
            raise InvalidFeatureFlagConfiguration("Feature JSON is not a valid feature")

        return cls.from_feature_dictionary(name=name, config_dict=config_data_dict)


__all__ = ["Feature", "InvalidFeatureFlagConfiguration", "ContextBuilder", "EvaluationContext"]
