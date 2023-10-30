from typing import TYPE_CHECKING, Any

from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.full_rebalancing import FullRebalancingModel
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingModel
from sentry.dynamic_sampling.models.transactions_rebalancing import TransactionsRebalancingModel

if TYPE_CHECKING:
    from sentry.dynamic_sampling.models.base import Model


class ModelNotFoundError(Exception):
    pass


def model_factory(model_type: ModelType) -> "Model[Any, Any]":
    if model_type == ModelType.TRANSACTIONS_REBALANCING:
        return TransactionsRebalancingModel()
    elif model_type == ModelType.PROJECTS_REBALANCING:
        return ProjectsRebalancingModel()
    elif model_type == ModelType.FULL_REBALANCING:
        return FullRebalancingModel()
    else:
        raise ModelNotFoundError()
