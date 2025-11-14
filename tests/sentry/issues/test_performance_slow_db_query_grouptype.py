"""
Tests for PerformanceSlowDBQueryGroupType detector_settings configuration.
"""

from jsonschema import ValidationError, validate

from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.testutils.cases import TestCase


class PerformanceSlowDBQueryGroupTypeTest(TestCase):
    def test_detector_settings_exists(self):
        """Test that detector_settings is configured."""
        assert PerformanceSlowDBQueryGroupType.detector_settings is not None
        assert PerformanceSlowDBQueryGroupType.detector_settings.config_schema is not None

    def test_config_schema_validates_valid_config(self):
        """Test that valid configurations pass schema validation."""
        schema = PerformanceSlowDBQueryGroupType.detector_settings.config_schema

        # Valid config with all required fields
        valid_config = {
            "duration_threshold": 1000,
            "allowed_span_ops": ["db"],
        }
        validate(instance=valid_config, schema=schema)

        # Valid config with custom values
        valid_config_custom = {
            "duration_threshold": 2500,
            "allowed_span_ops": ["db", "db.query"],
        }
        validate(instance=valid_config_custom, schema=schema)

    def test_config_schema_rejects_invalid_duration(self):
        """Test that invalid duration thresholds are rejected."""
        schema = PerformanceSlowDBQueryGroupType.detector_settings.config_schema

        # Duration too low
        invalid_config_low = {
            "duration_threshold": 50,  # Below minimum of 100
            "allowed_span_ops": ["db"],
        }
        try:
            validate(instance=invalid_config_low, schema=schema)
            assert False, "Should have raised ValidationError for low duration"
        except ValidationError:
            pass

        # Duration too high
        invalid_config_high = {
            "duration_threshold": 15000,  # Above maximum of 10000
            "allowed_span_ops": ["db"],
        }
        try:
            validate(instance=invalid_config_high, schema=schema)
            assert False, "Should have raised ValidationError for high duration"
        except ValidationError:
            pass

    def test_config_schema_rejects_invalid_span_ops(self):
        """Test that invalid span ops are rejected."""
        schema = PerformanceSlowDBQueryGroupType.detector_settings.config_schema

        # Invalid type for allowed_span_ops
        invalid_config = {
            "duration_threshold": 1000,
            "allowed_span_ops": "db",  # Should be array, not string
        }
        try:
            validate(instance=invalid_config, schema=schema)
            assert False, "Should have raised ValidationError for invalid span_ops type"
        except ValidationError:
            pass

    def test_config_schema_requires_all_fields(self):
        """Test that all required fields must be present."""
        schema = PerformanceSlowDBQueryGroupType.detector_settings.config_schema

        # Missing duration_threshold
        invalid_config = {
            "allowed_span_ops": ["db"],
        }
        try:
            validate(instance=invalid_config, schema=schema)
            assert False, "Should have raised ValidationError for missing duration_threshold"
        except ValidationError:
            pass

        # Missing allowed_span_ops
        invalid_config2 = {
            "duration_threshold": 1000,
        }
        try:
            validate(instance=invalid_config2, schema=schema)
            assert False, "Should have raised ValidationError for missing allowed_span_ops"
        except ValidationError:
            pass
