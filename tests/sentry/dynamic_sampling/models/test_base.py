from typing import int
import pytest

from sentry.dynamic_sampling.models.base import InvalidModelInputError
from sentry.dynamic_sampling.models.full_rebalancing import (
    FullRebalancingInput,
    FullRebalancingModel,
)


@pytest.fixture
def full_rebalancing_model():
    return FullRebalancingModel()


def test_run_with_exception(full_rebalancing_model) -> None:
    with pytest.raises(InvalidModelInputError):
        full_rebalancing_model.run(
            FullRebalancingInput(
                classes=[],
                sample_rate=0.0,
                intensity=1,
            )
        )
