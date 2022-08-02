from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .backend import TransactionsEventStreamAPI

transactions_backend = LazyServiceWrapper(
    TransactionsEventStreamAPI,
    settings.SENTRY_TRANSACTIONS_EVENTSTREAM,
    settings.SENTRY_TRANSACTIONS_EVENTSTREAM_OPTIONS,
)
transactions_backend.expose(locals())
