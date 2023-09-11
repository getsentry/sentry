from django.conf import settings

from sentry.nodestore.base import NodeStorage
from sentry.utils.services import LazyServiceWrapper

backend = LazyServiceWrapper(
    NodeStorage,
    settings.SENTRY_SPANSTORE,
    settings.SENTRY_SPANSTORE_OPTIONS,
    metrics_path="spanstore",
)
backend.expose(locals())
