"""
Options backed feature flagging.

Entry backed options. Will consume option data that is structured like

```yaml
features:
  organizations:fury-mode:
    enabled: True
    name: sentry organizations
    owner:
      team: hybrid-cloud
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
    owner:
      team: hybrid-cloud
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

import dataclasses
import functools
import os
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

import jsonschema
import orjson
import yaml

from flagpole.conditions import ConditionBase, Segment
from flagpole.evaluation_context import ContextBuilder, EvaluationContext


class ExperimentMode(StrEnum):
    SIMPLE = "simple"
    """Simple experiment mode: flag on = active, flag off = control."""

    def get_assignment(self, flag_result: bool) -> str:
        """Map a flag evaluation result to an experiment assignment string."""
        match self:
            case ExperimentMode.SIMPLE:
                return "active" if flag_result else "control"


class InvalidFeatureFlagConfiguration(Exception):
    pass


@functools.cache
def load_json_schema() -> dict[str, Any]:
    path = os.path.join(os.path.dirname(__file__), "flagpole-schema.json")
    with open(path, "rb") as json_file:
        data = orjson.loads(json_file.read())
    return data


FEATURE_BUCKETING_EPOCH = datetime(2026, 10, 15, tzinfo=UTC)
"""
Features created after this instant bucket their percentage rollouts by feature
name as well as by context identity, so two features at the same rollout reach
different populations instead of the same low buckets. Features created at or
before it, or whose ``created_at`` does not parse, keep bucketing on the
identity alone: changing that would move their in-flight partial rollouts
between organizations.

Must not predate the deploy of this rule, and must match
``FEATURE_BUCKETING_EPOCH`` in sentry-options (``clients/rust/src/features.rs``),
which evaluates flags in production.
"""


def parse_created_at(value: str | None) -> datetime | None:
    """
    Parse a feature's ``created_at`` as UTC.

    Accepts a date, a naive datetime with an optional fraction, or a datetime
    with a UTC offset; naive values are taken as UTC. Anything else, including
    the ``"None"`` that ``from_feature_dictionary`` stores for a missing value,
    is None.
    """
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


@dataclasses.dataclass(frozen=True)
class OwnerInfo:
    team: str
    "The team that owns this feature."

    email: str | None = None
    "The email address of the owner."


@dataclasses.dataclass(frozen=True)
class Feature:
    name: str
    "The feature name."

    owner: OwnerInfo
    "The owner of this feature."

    enabled: bool = dataclasses.field(default=True)
    "Whether or not the feature is enabled."

    segments: list[Segment] = dataclasses.field(default_factory=list)
    "The list of segments to evaluate for the feature. An empty list will always evaluate to False."

    created_at: str | None = None
    "The datetime when this feature was created."

    experiment_mode: ExperimentMode | None = None
    "The experiment mode for this feature. When set, the flag is treated as an experiment."

    @property
    def buckets_by_feature(self) -> bool:
        """
        Rollouts bucket by feature name as well as identity; see
        ``FEATURE_BUCKETING_EPOCH``.
        """
        created_at = parse_created_at(self.created_at)
        return created_at is not None and created_at > FEATURE_BUCKETING_EPOCH

    def match(self, context: EvaluationContext) -> bool:
        if not self.enabled:
            return False

        feature_name = self.name if self.buckets_by_feature else None
        for segment in self.segments:
            match = segment.match(context)
            if match:
                return segment.in_rollout(context, feature_name=feature_name)

        return False

    def validate(self) -> bool:
        """
        Validate a feature against the JSON schema.
        Will raise if the the current dict form a feature does not match the schema.
        """
        dict_data = dataclasses.asdict(self)
        spec = load_json_schema()
        jsonschema.validate(dict_data, spec)

        return True

    @classmethod
    def from_feature_dictionary(cls, name: str, config_dict: dict[str, Any]) -> Feature:
        segment_data = config_dict.get("segments")
        if not isinstance(segment_data, list):
            raise InvalidFeatureFlagConfiguration("Feature has no segments defined")
        try:
            segments = [Segment.from_dict(segment) for segment in segment_data]

            raw_owner = config_dict.get("owner", {})
            owner = OwnerInfo(
                team=raw_owner.get("team", ""),
                email=raw_owner.get("email"),
            )

            raw_experiment_mode = config_dict.get("experiment_mode")

            feature = cls(
                name=name,
                owner=owner,
                enabled=bool(config_dict.get("enabled", True)),
                created_at=str(config_dict.get("created_at")),
                segments=segments,
                experiment_mode=ExperimentMode(raw_experiment_mode)
                if raw_experiment_mode is not None
                else None,
            )
        except Exception as exc:
            raise InvalidFeatureFlagConfiguration(
                "Provided config_dict is not a valid feature"
            ) from exc

        return feature

    @classmethod
    def from_feature_config_json(cls, name: str, config_json: str) -> Feature:
        try:
            config_data_dict = orjson.loads(config_json)
        except orjson.JSONDecodeError as decode_error:
            raise InvalidFeatureFlagConfiguration("Invalid feature json provided") from decode_error

        if not isinstance(config_data_dict, dict):
            raise InvalidFeatureFlagConfiguration("Feature JSON is not a valid feature")

        if not name:
            raise InvalidFeatureFlagConfiguration("Feature name is required")

        return cls.from_feature_dictionary(name=name, config_dict=config_data_dict)

    @classmethod
    def from_bulk_json(cls, json: str) -> list[Feature]:
        features: list[Feature] = []
        features_json = orjson.loads(json)

        for feature, json_dict in features_json.items():
            features.append(cls.from_feature_dictionary(name=feature, config_dict=json_dict))

        return features

    @classmethod
    def from_bulk_yaml(cls, yaml_str: str) -> list[Feature]:
        features: list[Feature] = []
        parsed_yaml = yaml.safe_load(yaml_str)
        for feature, yaml_dict in parsed_yaml.items():
            features.append(cls.from_feature_dictionary(name=feature, config_dict=yaml_dict))

        return features

    def to_dict(self) -> dict[str, Any]:
        dict_data = dataclasses.asdict(self)
        dict_data.pop("name")
        if dict_data.get("experiment_mode") is None:
            dict_data.pop("experiment_mode", None)
        return {self.name: dict_data}

    def to_yaml_str(self) -> str:
        # Add an extra level of indentation by adding a top level dummy config.
        # This makes it easier to paste the results into options automator
        dump = yaml.dump({"dummy": self.to_dict()})
        return "\n".join(dump.split("\n")[1:])

    def to_json_str(self) -> str:
        return orjson.dumps(self.to_dict()).decode()


__all__ = [
    "ExperimentMode",
    "Feature",
    "OwnerInfo",
    "InvalidFeatureFlagConfiguration",
    "ContextBuilder",
    "EvaluationContext",
    "Segment",
    "ConditionBase",
]
