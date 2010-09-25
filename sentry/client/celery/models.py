from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

if 'djcelery' not in settings.INSTALLED_APPS:
    raise ImproperlyConfigured("Put 'djcelery' in your "
        "INSTALLED_APPS setting in order to use the sentry celery client.")
