from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .prevent_superuser_access_backend import PreventSuperuserAccessBackend

backend = LazyServiceWrapper(
    PreventSuperuserAccessBackend, settings.SENTRY_PREVENT_SUPERUSER_ACCESS_BACKEND, {}
)
backend.expose(locals())
