from contextlib import ExitStack
from typing import Sequence, Union

import sentry_sdk
from django.db import DEFAULT_DB_ALIAS, connections, transaction
from django.db.models.fields.related_descriptors import ReverseOneToOneDescriptor
from sentry_sdk.integrations import Integration


def atomic_transaction(
    using: Union[str, Sequence[str]], savepoint: bool = True
) -> Union[transaction.Atomic, ExitStack]:
    """
    Open transaction to one or multiple databases.

    Usage:

    >>> atomic_transaction(using=router.db_for_write(File))
    >>> atomic_transaction(using=(router.db_for_write(Release), router.db_for_write(ReleaseFile)))

    """
    if isinstance(using, str):
        return transaction.atomic(using=using, savepoint=savepoint)

    stack = ExitStack()
    # dict.fromkeys -> deduplicate while preserving order
    for db in dict.fromkeys(using):
        stack.enter_context(transaction.atomic(using=db, savepoint=savepoint))
    return stack


class DjangoAtomicIntegration(Integration):
    identifier = "django_atomic"

    @staticmethod
    def setup_once():
        from django.db.transaction import Atomic

        original_enter = Atomic.__enter__
        original_exit = Atomic.__exit__

        def _enter(self):
            self._sentry_sdk_span = sentry_sdk.start_span(op="transaction.atomic")
            self._sentry_sdk_span.set_data("using", self.using)
            self._sentry_sdk_span.__enter__()
            return original_enter(self)

        def _exit(self, exc_type, exc_value, traceback):
            rv = original_exit(self, exc_type, exc_value, traceback)
            if hasattr(self, "_sentry_sdk_span"):
                self._sentry_sdk_span.__exit__(exc_type, exc_value, traceback)
                del self._sentry_sdk_span
            return rv

        Atomic.__enter__ = _enter
        Atomic.__exit__ = _exit


def attach_foreignkey(objects, field, related=(), database=None):
    """
    Shortcut method which handles a pythonic LEFT OUTER JOIN.

    ``attach_foreignkey(posts, Post.thread)``

    Works with both ForeignKey and OneToOne (reverse) lookups.
    """

    if not objects:
        return

    if database is None:
        database = list(objects)[0]._state.db

    is_foreignkey = isinstance(field, ReverseOneToOneDescriptor)

    if not is_foreignkey:
        field = field.field
        accessor = "_%s_cache" % field.name
        model = field.remote_field.model
        lookup = "pk"
        column = field.column
        key = lookup
    else:
        accessor = field.cache_name
        field = field.related.field
        model = field.model
        lookup = field.name
        column = "pk"
        key = field.column

    objects = [o for o in objects if (related or getattr(o, accessor, False) is False)]

    if not objects:
        return

    # Ensure values are unique, do not contain already present values, and are not missing
    # values specified in select_related
    values = {_f for _f in (getattr(o, column) for o in objects) if _f}
    if values:
        qs = model._default_manager
        if database:
            qs = qs.using(database)
        if related:
            qs = qs.select_related(*related)

        if len(values) > 1:
            qs = qs.filter(**{"%s__in" % lookup: values})
        else:
            qs = [qs.get(**{lookup: next(iter(values))})]

        queryset = {getattr(o, key): o for o in qs}
    else:
        queryset = {}

    for o in objects:
        setattr(o, accessor, queryset.get(getattr(o, column)))


def table_exists(name, using=DEFAULT_DB_ALIAS):
    return name in connections[using].introspection.table_names()
