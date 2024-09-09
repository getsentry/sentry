from dataclasses import dataclass

import jsonschema
import orjson
import pytest
import yaml

from flagpole import ContextBuilder, EvaluationContext, Feature, InvalidFeatureFlagConfiguration
from flagpole.conditions import ConditionOperatorKind


@dataclass
class SimpleTestContextData:
    pass


class TestParseFeatureConfig:
    def get_is_true_context_builder(self, is_true_value: bool):
        return ContextBuilder().add_context_transformer(lambda _data: dict(is_true=is_true_value))

    def test_feature_with_empty_segments(self):
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": "test-owner",
                "segments": []
            }
            """,
        )

        assert feature.name == "foobar"
        assert feature.created_at == "2023-10-12T00:00:00.000Z"
        assert feature.owner == "test-owner"
        assert feature.segments == []

        assert not feature.match(EvaluationContext(dict()))

    def test_feature_with_default_rollout(self):
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": "test-user",
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
        assert feature.segments[0].rollout == 100
        assert feature.match(context_builder.build(SimpleTestContextData()))

    def test_feature_with_rollout_zero(self):
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": "test-owner",
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

    def test_all_conditions_in_segment(self):
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": "test-owner",
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

    def test_valid_with_all_nesting(self):
        feature = Feature.from_feature_config_json(
            "foobar",
            """
            {
                "created_at": "2023-10-12T00:00:00.000Z",
                "owner": "test-owner",
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

    def test_invalid_json(self):
        with pytest.raises(InvalidFeatureFlagConfiguration):
            Feature.from_feature_config_json("foobar", "{")

    def test_validate_invalid_schema(self):
        config = """
        {
            "owner": "sentry",
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
            "owner": "sentry",
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

    def test_validate_valid(self):
        config = """
        {
            "owner": "sentry",
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

    def test_empty_string_name(self):
        with pytest.raises(InvalidFeatureFlagConfiguration) as exception:
            Feature.from_feature_config_json("", '{"segments":[]}')
        assert "Feature name is required" in str(exception)

    def test_missing_segments(self):
        with pytest.raises(InvalidFeatureFlagConfiguration) as exception:
            Feature.from_feature_config_json("foo", "{}")
        assert "Feature has no segments defined" in str(exception)

    def test_invalid_operator_condition(self):
        config = """
        {
            "owner": "sentry",
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

    def test_enabled_feature(self):
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": "test-user",
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

    def test_disabled_feature(self):
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": "test-user",
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

    def test_dump_yaml(self):
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": "test-user",
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
