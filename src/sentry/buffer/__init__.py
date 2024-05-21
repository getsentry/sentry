from typing import TYPE_CHECKING

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import Buffer

backend = LazyServiceWrapper(Buffer, settings.SENTRY_BUFFER, settings.SENTRY_BUFFER_OPTIONS)
backend.expose(locals())

if TYPE_CHECKING:
    __buffer__ = Buffer()
    get = __buffer__.get
    incr = __buffer__.incr
    process = __buffer__.process
    process_pending = __buffer__.process_pending
    process_batch = __buffer__.process_batch
    validate = __buffer__.validate
    push_to_sorted_set = __buffer__.push_to_sorted_set
    push_to_hash = __buffer__.push_to_hash
    get_sorted_set = __buffer__.get_sorted_set
    get_hash = __buffer__.get_hash
    delete_hash = __buffer__.delete_hash
    delete_key = __buffer__.delete_key
