from dataclasses import dataclass

import jsonschema
import orjson
import pytest
import yaml

from flagpole import (
    ContextBuilder,
    EvaluationContext,
    Feature,
    InvalidFeatureFlagConfiguration,
    OwnerInfo,
)
from flagpole.conditions import ConditionOperatorKind, Segment


@dataclass
class SimpleTestContextData:
    pass


class TestParseFeatureConfig:
    def get_is_true_context_builder(
        self, is_true_value: bool
    ) -> ContextBuilder[SimpleTestContextData]:
        return ContextBuilder().add_context_transformer(lambda _data: dict(is_true=is_true_value))

    def test_feature_with_empty_segments(self) -> None:
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": {"team": "test-owner", "email": "test-owner@sentry.io"},
                "segments": []
            }
            """,
        )

        assert feature.name == "foobar"
        assert feature.created_at == "2023-10-12T00:00:00.000Z"
        assert feature.owner == OwnerInfo(team="test-owner", email="test-owner@sentry.io")
        assert feature.segments == []

        assert not feature.match(EvaluationContext(dict()))

    def test_feature_with_default_rollout(self) -> None:
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": {"team": "test-user", "email": "test-user@sentry.io"},
                "created_at": "2023-10-12T00:00:00.000Z",
                "segments": [{
                    "name": "always_pass_segment",
                    "conditions": [{
                        "name": "Always true",
                        "property": "is_true",
                        "operator": "equals",
                        "value": true
                    }]
                }]
            }
            """,
        )

        context_builder = self.get_is_true_context_builder(is_true_value=True)
        assert feature.owner == OwnerInfo(team="test-user", email="test-user@sentry.io")
        assert feature.segments[0].rollout == 100
        assert feature.match(context_builder.build(SimpleTestContextData()))

    def test_feature_with_rollout_zero(self) -> None:
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": {"team": "test-owner"},
                "segments": [
                    {
                        "name": "exclude",
                        "rollout": 0,
                        "conditions": [
                            {
                                "property": "user_email",
                                "operator": "equals",
                                "value": "nope@example.com"
                            }
                        ]
                    },
                    {
                        "name": "friends",
                        "rollout": 100,
                        "conditions": [
                            {
                                "property": "organization_slug",
                                "operator": "in",
                                "value": ["acme", "sentry"]
                            }
                        ]
                    }
                ]
            }
            """,
        )
        exclude_user = {"user_email": "nope@example.com", "organization_slug": "acme"}
        assert not feature.match(EvaluationContext(exclude_user))

        match_user = {"user_email": "yes@example.com", "organization_slug": "acme"}
        assert feature.match(EvaluationContext(match_user))

    def test_all_conditions_in_segment(self) -> None:
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": {"team": "test-owner"},
                "segments": [
                    {
                        "name": "multiple conditions",
                        "rollout": 100,
                        "conditions": [
                            {
                                "property": "user_email",
                                "operator": "equals",
                                "value": "yes@example.com"
                            },
                            {
                                "property": "organization_slug",
                                "operator": "in",
                                "value": ["acme", "sentry"]
                            }
                        ]
                    }
                ]
            }
            """,
        )
        exclude_user = {"user_email": "yes@example.com"}
        assert not feature.match(EvaluationContext(exclude_user))

        match_user = {"user_email": "yes@example.com", "organization_slug": "acme"}
        assert feature.match(EvaluationContext(match_user))

    def test_valid_with_all_nesting(self) -> None:
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": {"team": "test-owner"},
                "segments": [{
                    "name": "segment1",
                    "rollout": 100,
                    "conditions": [{
                        "property": "test_property",
                        "operator": "in",
                        "value": ["foobar"]
                    }]
                }]
            }
            """,
        )
        assert feature.name == "foobar"
        assert feature.owner == OwnerInfo(team="test-owner", email=None)
        assert len(feature.segments) == 1
        assert feature.segments[0].name == "segment1"
        assert feature.segments[0].rollout == 100
        assert len(feature.segments[0].conditions) == 1

        condition = feature.segments[0].conditions[0]
        assert condition.property == "test_property"
        assert condition.operator
        assert condition.operator == ConditionOperatorKind.IN
        assert condition.value == ["foobar"]

        assert feature.match(EvaluationContext(dict(test_property="foobar")))
        assert not feature.match(EvaluationContext(dict(test_property="barfoo")))

    def test_invalid_json(self) -> None:
        with pytest.raises(InvalidFeatureFlagConfiguration):
            Feature.from_feature_config_json("foobar", "{")

    def test_validate_invalid_schema(self) -> None:
        config = """
        {
            "owner": {"team": "sentry"},
            "created_at": "2024-05-14",
            "segments": [
                {
                    "name": "",
                    "rollout": 1,
                    "conditions": []
                }
            ]
        }
        """
        feature = Feature.from_feature_config_json("trash", config)
        with pytest.raises(jsonschema.ValidationError) as err:
            feature.validate()
        assert "is too short" in str(err)

        config = """
        {
            "owner": {"team": "sentry"},
            "created_at": "2024-05-14",
            "segments": [
                {
                    "name": "allowed orgs",
                    "rollout": 1,
                    "conditions": [
                        {
                            "property": "organization_slug",
                            "operator": "contains",
                            "value": ["derp"]
                        }
                    ]
                }
            ]
        }
        """
        feature = Feature.from_feature_config_json("trash", config)
        with pytest.raises(jsonschema.ValidationError) as err:
            feature.validate()
        assert "'contains'} is not valid" in str(err)

    def test_validate_valid(self) -> None:
        config = """
        {
            "owner": {"team": "sentry"},
            "created_at": "2024-05-14",
            "segments": [
                {
                    "name": "ga",
                    "rollout": 100,
                    "conditions": []
                }
            ]
        }
        """
        feature = Feature.from_feature_config_json("redpaint", config)
        assert feature.validate()

    def test_empty_string_name(self) -> None:
        with pytest.raises(InvalidFeatureFlagConfiguration) as exception:
            Feature.from_feature_config_json("", '{"segments":[]}')
        assert "Feature name is required" in str(exception)

    def test_missing_segments(self) -> None:
        with pytest.raises(InvalidFeatureFlagConfiguration) as exception:
            Feature.from_feature_config_json("foo", "{}")
        assert "Feature has no segments defined" in str(exception)

    def test_invalid_operator_condition(self) -> None:
        config = """
        {
            "owner": {"team": "sentry"},
            "segments": [
                {
                    "name": "derp",
                    "conditions": [
                        {"property": "user_email", "operator": "trash", "value": 1}
                    ]
                }
            ]
        }
        """
        with pytest.raises(InvalidFeatureFlagConfiguration) as exception:
            Feature.from_feature_config_json("foo", config)
        assert "Provided config_dict is not a valid feature" in str(exception)

    def test_enabled_feature(self) -> None:
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": {"team": "test-user"},
                "created_at": "2023-10-12T00:00:00.000Z",
                "segments": [{
                    "name": "always_pass_segment",
                    "rollout": 100,
                    "conditions": [{
                        "name": "Always true",
                        "property": "is_true",
                        "operator": "equals",
                        "value": true
                    }]
                }]
            }
            """,
        )

        context_builder = self.get_is_true_context_builder(is_true_value=True)
        assert feature.match(context_builder.build(SimpleTestContextData()))

    def test_disabled_feature(self) -> None:
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": {"team": "test-user"},
                "enabled": false,
                "created_at": "2023-12-12T00:00:00.000Z",
                "segments": [{
                    "name": "always_pass_segment",
                    "rollout": 100,
                    "conditions": [{
                        "name": "Always true",
                        "property": "is_true",
                        "operator": "equals",
                        "value": true
                    }]
                }]
            }
            """,
        )

        context_builder = self.get_is_true_context_builder(is_true_value=True)
        assert not feature.match(context_builder.build(SimpleTestContextData()))

    def test_dump_yaml(self) -> None:
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": {"team": "test-user"},
                "created_at": "2023-12-12T00:00:00.000Z",
                "segments": [{
                    "name": "always_pass_segment",
                    "rollout": 100,
                    "conditions": [{
                        "name": "Always true",
                        "property": "is_true",
                        "operator": "equals",
                        "value": true
                    }]
                }]
            }
            """,
        )

        parsed_json = orjson.loads(feature.to_json_str())
        parsed_yaml = dict(yaml.safe_load(feature.to_yaml_str()))

        assert "foo" in parsed_yaml
        assert parsed_yaml == parsed_json

        features_from_yaml = Feature.from_bulk_yaml(feature.to_yaml_str())
        assert features_from_yaml == [feature]


class TestRolloutBucketing:
    @pytest.mark.parametrize(
        ("created_at", "expected"),
        [
            ("2026-10-15", False),
            ("2026-10-15T00:00:01", True),
            ("2026-10-16", True),
            ("2026-10-15T00:00:00.000001", True),
            ("2026-10-15T00:00:00.000000001", False),
            ("2026-10-14T23:00:00-02:00", True),
            ("2026-10-15T01:00:00+02:00", False),
            ("2026-10-15T01:00:00+0200", False),
            ("2024-01-01", False),
            ("None", False),
            (None, False),
            ("not a date", False),
        ],
    )
    def test_buckets_by_feature(self, created_at: str | None, expected: bool) -> None:
        feature = Feature(
            name="organizations:test-feature", owner=OwnerInfo(team="test"), created_at=created_at
        )
        assert feature.buckets_by_feature is expected

    def _feature(self, name: str, created_at: str, rollout: int) -> Feature:
        return Feature(
            name=name,
            owner=OwnerInfo(team="test"),
            created_at=created_at,
            segments=[Segment(name="all", rollout=rollout, conditions=[])],
        )

    def test_keeps_identity_bucketing_for_features_created_before_epoch(self) -> None:
        # Organization 123 is bucket 56 on identity alone. Under the feature
        # name it would be 64 (see the test below), which rollout 56 excludes.
        context = EvaluationContext({"organization_id": 123}, {"organization_id"})
        assert context.id % 100 == 56

        assert self._feature("organizations:performance-view", "2024-01-01", 56).match(context)
        assert not self._feature("organizations:performance-view", "2024-01-01", 55).match(context)

    def test_buckets_by_feature_for_features_created_after_epoch(self) -> None:
        # Organization 123 lands in a different bucket under each feature, so
        # the two features at the same rollout reach different populations.
        context = EvaluationContext({"organization_id": 123}, {"organization_id"})
        assert context.bucket_id("organizations:performance-view") % 100 == 64
        assert context.bucket_id("organizations:dashboards-edit") % 100 == 75

        assert self._feature("organizations:performance-view", "2026-12-01", 64).match(context)
        assert not self._feature("organizations:performance-view", "2026-12-01", 63).match(context)
        assert not self._feature("organizations:dashboards-edit", "2026-12-01", 64).match(context)
