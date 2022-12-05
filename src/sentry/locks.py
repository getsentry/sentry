from django.conf import settings

from sentry.utils.locking.manager import LockManager
from sentry.utils.services import build_instance_from_options

locks = LockManager(build_instance_from_options(settings.SENTRY_DEFAULT_LOCKS_BACKEND_OPTIONS))
