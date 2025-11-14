from typing import int
import pytest

from sentry.models.statistical_detectors import RegressionType


@pytest.mark.parametrize(
    ["regression_type", "abbreviation"],
    [
        pytest.param(RegressionType.ENDPOINT, "e", id="endpoint"),
        pytest.param(RegressionType.FUNCTION, "f", id="endpoint"),
    ],
)
def test_regression_type_abbreviation(regression_type: RegressionType, abbreviation: str) -> None:
    assert regression_type.abbreviate() == abbreviation
