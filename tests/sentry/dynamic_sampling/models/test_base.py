import pytest

from sentry.dynamic_sampling.models.base import InvalidModelInputError, ModelType
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.full_rebalancing import FullRebalancingInput


@pytest.fixture
def full_rebalancing_model():
    return model_factory(ModelType.FULL_REBALANCING)


def test_run_with_exception(full_rebalancing_model):
    with pytest.raises(InvalidModelInputError):
        full_rebalancing_model.run(
            FullRebalancingInput(
                classes=[],
                sample_rate=0.0,
                intensity=1,
            )
        )
