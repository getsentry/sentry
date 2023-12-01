from sentry.sentry_metrics.querying.registry.aliases import ALIASES_REGISTRY
from sentry.sentry_metrics.querying.registry.base import CompositeRegistry
from sentry.sentry_metrics.querying.registry.derived_metrics import DERIVED_METRICS_REGISTRY

DEFAULT_REGISTRY = CompositeRegistry.combine(ALIASES_REGISTRY, DERIVED_METRICS_REGISTRY)
