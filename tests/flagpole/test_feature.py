from datetime import datetime, timezone

import pytest

from flagpole import ContextBuilder, EvaluationContext, Feature, InvalidFeatureFlagConfiguration
from flagpole.operators import OperatorKind
from sentry.testutils.helpers import override_options


@pytest.fixture(autouse=True)
def run_before_each():
    with override_options({"flagpole.enable-orjson": 0.0}):
        yield


class TestParseFeatureConfig:
    def get_is_true_context_builder(self, is_true_value: bool):
        return ContextBuilder().add_context_transformer(lambda _data: dict(is_true=is_true_value))

    def test_valid_without_created_at(self):
        feature = Feature.from_feature_config_json("foo", '{"owner": "test", "segments":[]}')
        assert feature.name == "foo"
        assert isinstance(feature.created_at, datetime)
        assert feature.segments == []

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
        assert feature.created_at == datetime(2023, 10, 12, tzinfo=timezone.utc)
        assert feature.owner == "test-owner"
        assert feature.segments == []

        assert not feature.match(EvaluationContext(dict()))

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
                        "operator": {
                            "kind": "in",
                            "value": ["foobar"]
                        }
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
        assert condition.operator.kind == OperatorKind.IN
        assert condition.operator.value == ["foobar"]

        assert feature.match(EvaluationContext(dict(test_property="foobar")))
        assert not feature.match(EvaluationContext(dict(test_property="barfoo")))

    def test_invalid_json(self):
        with pytest.raises(InvalidFeatureFlagConfiguration):
            Feature.from_feature_config_json("foobar", "{")

    def test_empty_string_name(self):
        with pytest.raises(InvalidFeatureFlagConfiguration) as exception:
            Feature.from_feature_config_json("", '{"segments":[]}')
        assert "Provided JSON is not a valid feature" in str(exception)

    def test_missing_segments(self):
        with pytest.raises(InvalidFeatureFlagConfiguration) as exception:
            Feature.from_feature_config_json("foo", "{}")
        assert "Provided JSON is not a valid feature" in str(exception)

    def test_enabled_feature(self):
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": "test-user",
                "segments": [{
                    "name": "always_pass_segment",
                    "rollout": 100,
                    "conditions": [{
                        "name": "Always true",
                        "property": "is_true",
                        "operator": {
                            "kind": "equals",
                            "value": true
                        }
                    }]
                }]
            }
            """,
        )

        context_builder = self.get_is_true_context_builder(is_true_value=True)
        assert feature.match(context_builder.build())

    def test_disabled_feature(self):
        feature = Feature.from_feature_config_json(
            "foo",
            """
            {
                "owner": "test-user",
                "enabled": false,
                "segments": [{
                    "name": "always_pass_segment",
                    "rollout": 100,
                    "conditions": [{
                        "name": "Always true",
                        "property": "is_true",
                        "operator": {
                            "kind": "equals",
                            "value": true
                        }
                    }]
                }]
            }
            """,
        )

        context_builder = self.get_is_true_context_builder(is_true_value=True)
        assert not feature.match(context_builder.build())
