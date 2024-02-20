from sentry.sentry_metrics.querying.registry.base import ExpressionRegistry
from sentry.sentry_metrics.querying.registry.base_expressions import Rate

DDM_REGISTRY = ExpressionRegistry()
DDM_REGISTRY.register(Rate())
