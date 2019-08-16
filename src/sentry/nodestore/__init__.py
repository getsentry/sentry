from __future__ import absolute_import

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import NodeStorage  # NOQA

backend = LazyServiceWrapper(
    NodeStorage,
    settings.SENTRY_NODESTORE,
    settings.SENTRY_NODESTORE_OPTIONS,
    metrics_path="nodestore",
)
backend.expose(locals())
