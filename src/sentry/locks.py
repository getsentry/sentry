from django.conf import settings

from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.manager import LockManager
from sentry.utils.services import build_instance_from_options_of_type

locks = LockManager(
    build_instance_from_options_of_type(LockBackend, settings.SENTRY_DEFAULT_LOCKS_BACKEND_OPTIONS)
)
