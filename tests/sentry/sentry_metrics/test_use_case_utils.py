import pytest

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.use_case_utils import string_to_use_case_id


def test_string_to_use_case_id_maps_custom_namespace() -> None:
    assert string_to_use_case_id("custom") is UseCaseID.TRANSACTIONS


def test_string_to_use_case_id_maps_span_light_namespace() -> None:
    assert string_to_use_case_id("spans_light") is UseCaseID.SPANS


def test_string_to_use_case_id_raises_for_unknown_namespace() -> None:
    with pytest.raises(ValueError):
        string_to_use_case_id("does-not-exist")
