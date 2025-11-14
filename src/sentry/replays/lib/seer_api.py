from typing import int
from django.conf import settings

from sentry.net.http import connection_from_url

# Shared connection pool for replay AI usecases. No timeout or retries by default, but requests can override these params.
seer_summarization_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
    timeout=None,
    retries=0,
    maxsize=20,  # Max persisted connections. If the number of concurrent requests exceeds this, temporary connections are created.
)
