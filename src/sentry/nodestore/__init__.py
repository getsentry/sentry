from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import NodeStorage  # NOQA


backend = LazyBackendWrapper(NodeStorage, settings.SENTRY_NODESTORE,
                             settings.SENTRY_NODESTORE_OPTIONS)
backend.expose(locals())
