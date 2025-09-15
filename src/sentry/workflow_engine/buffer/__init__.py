from django.conf import settings

from sentry.buffer.base import Buffer
from sentry.utils.services import LazyServiceWrapper

# Workflows-specific Buffer that can be configured separately from the default Buffer.
_backend = LazyServiceWrapper(
    Buffer, settings.SENTRY_WORKFLOW_BUFFER, settings.SENTRY_WORKFLOW_BUFFER_OPTIONS
)


def get_backend() -> LazyServiceWrapper[Buffer]:
    """
    Retrieve the appropriate Buffer to use for the workflow engine.
    """
    return _backend
