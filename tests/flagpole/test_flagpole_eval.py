import tempfile
from pathlib import Path
from unittest import mock

import pytest
import yaml

from flagpole import Feature, OwnerInfo
from flagpole.conditions import EqualsCondition, Segment
from flagpole.evaluation_context import EvaluationContext
from flagpole.flagpole_eval import evaluate_flag, get_arguments, read_feature


class TestGetArguments:
    """Test get_arguments() function for parsing command line arguments and context."""

    @mock.patch("flagpole.flagpole_eval.sys.argv", ["script.py", "--flag-name", "test-flag"])
    def test_get_arguments_with_flag_name_only(self):
        """Test get_arguments returns correct dict with only flag name."""
        result = get_arguments()

        assert result["flag_name"] == "test-flag"
        assert result["context"] == {}
        assert "flagpole_file" in result

    @mock.patch(
        "flagpole.flagpole_eval.sys.argv",
        ["script.py", "--flag-name", "test-flag", "--context", '{"user_id": 123}'],
    )
    def test_get_arguments_with_context_flag(self):
        """Test get_arguments parses context from --context flag."""
        result = get_arguments()

        assert result["flag_name"] == "test-flag"
        assert result["context"] == {"user_id": 123}

    @mock.patch(
        "flagpole.flagpole_eval.sys.argv",
        ["script.py", "--flag-name", "test-flag", '{"org_id": 456, "user_id": 789}'],
    )
    def test_get_arguments_with_positional_context(self):
        """Test get_arguments parses context from positional argument."""
        result = get_arguments()

        assert result["flag_name"] == "test-flag"
        assert result["context"] == {"org_id": 456, "user_id": 789}

    @mock.patch(
        "flagpole.flagpole_eval.sys.argv",
        [
            "script.py",
            "--flag-name",
            "test-flag",
            "--context",
            '{"user_id": 123}',
            '{"org_id": 456}',
        ],
    )
    def test_get_arguments_context_flag_takes_precedence(self):
        """Test that --context flag takes precedence over positional context."""
        result = get_arguments()

        assert result["context"] == {"user_id": 123}

    @mock.patch(
        "flagpole.flagpole_eval.sys.argv", ["script.py", "--flag-name", "test-flag", "invalid-json"]
    )
    def test_get_arguments_invalid_json_falls_back_to_empty(self):
        """Test that invalid JSON in positional context falls back to empty dict."""
        result = get_arguments()

        assert result["context"] == {}

    @mock.patch(
        "flagpole.flagpole_eval.sys.argv",
        ["script.py", "--flag-name", "test-flag", "--flagpole-file", "/custom/path.yaml"],
    )
    def test_get_arguments_custom_flagpole_file(self):
        """Test get_arguments with custom flagpole file path."""
        result = get_arguments()

        assert result["flagpole_file"] == "/custom/path.yaml"


class TestReadFeature:
    """Test read_feature() function for loading and parsing YAML files."""

    def test_read_feature_success(self):
        """Test read_feature successfully loads and parses a valid YAML file."""
        # Create a temporary YAML file
        yaml_content = {
            "options": {
                "test-feature": {
                    "enabled": True,
                    "owner": "test-team",
                    "segments": [
                        {
                            "name": "test-segment",
                            "rollout": 100,
                            "conditions": [
                                {
                                    "property": "user_id",
                                    "name": "user condition",
                                    "operator": "equals",
                                    "value": 123,
                                }
                            ],
                        }
                    ],
                }
            }
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(yaml_content, f)
            temp_file = f.name

        try:
            feature = read_feature("test-feature", temp_file)

            assert isinstance(feature, Feature)
            assert feature.name == "test-feature"
            assert feature.enabled is True
            assert feature.owner == "test-team"
            assert len(feature.segments) == 1
            assert feature.segments[0].name == "test-segment"
        finally:
            Path(temp_file).unlink()

    def test_read_feature_file_not_found(self):
        """Test read_feature raises exception when file doesn't exist."""
        with pytest.raises(FileNotFoundError):
            read_feature("test-feature", "/nonexistent/file.yaml")

    def test_read_feature_invalid_yaml(self):
        """Test read_feature raises exception for invalid YAML."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("invalid: yaml: content: [")
            temp_file = f.name

        try:
            with pytest.raises(yaml.YAMLError):
                read_feature("test-feature", temp_file)
        finally:
            Path(temp_file).unlink()

    def test_read_feature_missing_flag(self):
        """Test read_feature raises exception when flag doesn't exist in file."""
        yaml_content = {
            "options": {"other-feature": {"enabled": True, "owner": "test-team", "segments": []}}
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(yaml_content, f)
            temp_file = f.name

        try:
            with pytest.raises(
                AttributeError
            ):  # options.get(flag_name) returns None, then None.get() fails
                read_feature("missing-feature", temp_file)
        finally:
            Path(temp_file).unlink()


class TestOwnerInfo:
    """Test OwnerInfo dataclass and Feature with OwnerInfo owner."""

    def test_feature_with_owner_info(self):
        """Test creating a Feature with OwnerInfo as owner."""
        owner = OwnerInfo(team="test-team", email="owner@sentry.io")
        feature = Feature(
            name="test-feature",
            owner=owner,
            enabled=True,
            segments=[Segment(name="test-segment", rollout=100, conditions=[])],
        )

        assert isinstance(feature.owner, OwnerInfo)
        assert feature.owner.team == "test-team"
        assert feature.owner.email == "owner@sentry.io"

    def test_feature_with_owner_info_no_email(self):
        """Test creating a Feature with OwnerInfo without email."""
        owner = OwnerInfo(team="test-team")
        feature = Feature(
            name="test-feature",
            owner=owner,
            enabled=True,
            segments=[Segment(name="test-segment", rollout=100, conditions=[])],
        )

        assert isinstance(feature.owner, OwnerInfo)
        assert feature.owner.team == "test-team"
        assert feature.owner.email is None

    def test_feature_from_dict_with_owner_object(self):
        """Test parsing a Feature from dict with owner as object."""
        config_dict = {
            "enabled": True,
            "owner": {"team": "test-team", "email": "owner@sentry.io"},
            "segments": [{"name": "test-segment", "rollout": 100, "conditions": []}],
        }

        feature = Feature.from_feature_dictionary("test-feature", config_dict)

        assert isinstance(feature.owner, OwnerInfo)
        assert feature.owner.team == "test-team"
        assert feature.owner.email == "owner@sentry.io"

    def test_feature_from_dict_with_owner_object_no_email(self):
        """Test parsing a Feature from dict with owner object without email."""
        config_dict = {
            "enabled": True,
            "owner": {"team": "test-team"},
            "segments": [{"name": "test-segment", "rollout": 100, "conditions": []}],
        }

        feature = Feature.from_feature_dictionary("test-feature", config_dict)

        assert isinstance(feature.owner, OwnerInfo)
        assert feature.owner.team == "test-team"
        assert feature.owner.email is None


class TestEvaluateFlag:
    """Test evaluate_flag() function for different flag scenarios."""

    def test_evaluate_flag_no_segments(self):
        """Test evaluate_flag with feature that has no segments."""
        feature = Feature(name="no-segments-feature", owner="test-team", enabled=True, segments=[])
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is False
        assert rollout is None
        assert segment is None

    def test_evaluate_flag_disabled_feature(self):
        """Test evaluate_flag with disabled feature."""
        feature = Feature(
            name="disabled-feature",
            owner="test-team",
            enabled=False,
            segments=[Segment(name="test-segment", rollout=100, conditions=[])],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is False
        assert rollout is None
        assert segment is None

    def test_evaluate_flag_single_segment_matching_100_rollout(self):
        """Test evaluate_flag with single segment that matches and has 100% rollout."""
        # Create a mock segment that always matches
        feature = Feature(
            name="test-feature",
            owner="test-team",
            enabled=True,
            segments=[Segment(name="always-match-segment", rollout=100, conditions=[])],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is True
        assert rollout == 100
        assert segment
        assert segment.name == "always-match-segment"

    def test_evaluate_flag_single_segment_matching_0_rollout(self):
        """Test evaluate_flag with single segment that matches but has 0% rollout."""
        # Create a mock segment that always matches but has 0% rollout
        feature = Feature(
            name="test-feature",
            owner="test-team",
            enabled=True,
            segments=[Segment(name="zero-rollout-segment", rollout=0, conditions=[])],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is False
        assert rollout == 0
        assert segment
        assert segment.name == "zero-rollout-segment"

    def test_evaluate_flag_single_segment_no_match_100_rollout(self):
        """Test evaluate_flag with single segment that doesn't match but has 100% rollout."""
        # Create a mock segment that never matches
        feature = Feature(
            name="test-feature",
            owner="test-team",
            enabled=True,
            segments=[
                Segment(
                    name="never-match-segment",
                    rollout=100,
                    conditions=[EqualsCondition("user_email", "test@example.com", "equals")],
                )
            ],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is False
        assert rollout is None
        assert segment is None

    def test_evaluate_flag_single_segment_no_match_0_rollout(self):
        """Test evaluate_flag with single segment that doesn't match and has 0% rollout."""
        # Create a mock segment that never matches
        feature = Feature(
            name="test-feature",
            owner="test-team",
            enabled=True,
            segments=[
                Segment(
                    name="never-match-segment",
                    rollout=0,
                    conditions=[EqualsCondition("user_email", "test@example.com", "equals")],
                )
            ],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is False
        assert rollout is None
        assert segment is None

    def test_evaluate_flag_multiple_segments_matching_later(self):
        """Test evaluate_flag with multiple segments where a later segment matches."""
        # Create segments where first doesn't match, second matches
        feature = Feature(
            name="test-feature",
            owner="test-team",
            enabled=True,
            segments=[
                Segment(
                    name="first-segment",
                    rollout=100,
                    conditions=[EqualsCondition("user_email", "test@example.com", "equals")],
                ),
                Segment(
                    name="second-segment",
                    rollout=50,
                    conditions=[EqualsCondition("user_id", 123, "equals")],
                ),
            ],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is True
        assert rollout == 50
        assert segment
        assert segment.name == "second-segment"

    def test_evaluate_flag_multiple_segments_none_match(self):
        """Test evaluate_flag with multiple segments where none match."""
        feature = Feature(
            name="test-feature",
            owner="test-team",
            enabled=True,
            segments=[
                Segment(
                    name="first-segment",
                    rollout=100,
                    conditions=[EqualsCondition("user_email", "test@example.com", "equals")],
                ),
                Segment(
                    name="second-segment",
                    rollout=50,
                    conditions=[EqualsCondition("user_email", "test@example.com", "equals")],
                ),
            ],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        assert result is False
        assert rollout is None
        assert segment is None

    def test_evaluate_flag_partial_rollout(self):
        """Test evaluate_flag with partial rollout percentage."""
        feature = Feature(
            name="test-feature",
            owner="test-team",
            enabled=True,
            segments=[Segment(name="partial-rollout-segment", rollout=75, conditions=[])],
        )
        context = EvaluationContext({"user_id": 123})

        result, rollout, segment = evaluate_flag(feature, context)

        # The actual result depends on the context.id % 100 calculation
        # We just verify the rollout percentage is passed through correctly
        assert result is True
        assert rollout == 75
        assert segment
        assert segment.name == "partial-rollout-segment"
