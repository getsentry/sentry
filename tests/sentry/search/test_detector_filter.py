import pytest

from sentry.exceptions import InvalidSearchQuery
from sentry.search.snuba.backend import _make_detector_filter
from sentry.testutils.cases import TestCase


class DetectorFilterTest(TestCase):
    def test_detector_filter_with_invalid_values(self):
        """Test that non-numeric detector IDs are gracefully handled"""
        # Empty string should return empty Q
        with pytest.raises(InvalidSearchQuery):
            _make_detector_filter([""])

        # Non-numeric string should return empty Q
        with pytest.raises(InvalidSearchQuery):
            _make_detector_filter(["metric_issue"])

        # URL should return empty Q
        with pytest.raises(InvalidSearchQuery):
            _make_detector_filter(["https://example.com/detector/123"])

    def test_detector_filter_with_valid_values(self):
        """Test that numeric detector IDs work correctly"""
        # Valid numeric string
        result = _make_detector_filter(["123"])
        # Should have a non-empty queryset filter
        assert "id__in" in str(result)

        # Multiple valid IDs
        result = _make_detector_filter(["123", "456"])
        assert "id__in" in str(result)

        # Wildcard should return empty Q (gracefully ignored)
        result = _make_detector_filter(["*"])
        assert "id__in" in str(result)

    def test_detector_filter_with_mixed_values(self):
        """Test mix of valid and invalid detector IDs"""
        # Mix of valid and invalid - should raise exception
        with pytest.raises(InvalidSearchQuery):
            _make_detector_filter(["123", "invalid", "*", "456"])

        # All invalid should raise exception
        with pytest.raises(InvalidSearchQuery):
            _make_detector_filter(["invalid", "*", ""])
