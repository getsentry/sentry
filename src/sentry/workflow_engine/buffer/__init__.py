from django.conf import settings

import sentry.buffer as old_buffer
from sentry import options
from sentry.buffer.base import Buffer
from sentry.utils.services import LazyServiceWrapper

_backend = LazyServiceWrapper(
    Buffer, settings.SENTRY_WORKFLOW_BUFFER, settings.SENTRY_WORKFLOW_BUFFER_OPTIONS
)


def validate_new_backend() -> None:
    pass


def get_backend() -> LazyServiceWrapper[Buffer]:
    if options.get("workflow_engine.buffer.use_new_buffer"):
        return _backend
    else:
        return old_buffer.backend
