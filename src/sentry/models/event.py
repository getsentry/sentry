from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from semaphore.processing import StoreNormalizer

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    Model,
    NodeData,
    NodeField,
    sane_repr,
)
from sentry.db.models.manager import BaseManager
from sentry.utils.canonical import CanonicalKeyDict


class EventDict(CanonicalKeyDict):
    """
    Creating an instance of this dictionary will send the event through basic
    (Rust-based) type/schema validation called "re-normalization".

    This is used as a wrapper type for `Event.data` such that creating an event
    object (or loading it from the DB) will ensure the data fits the type
    schema.
    """

    def __init__(self, data, skip_renormalization=False, **kwargs):
        is_renormalized = isinstance(data, EventDict) or (
            isinstance(data, NodeData) and isinstance(data.data, EventDict)
        )

        if not skip_renormalization and not is_renormalized:
            normalizer = StoreNormalizer(is_renormalize=True, enable_trimming=False)
            data = normalizer.normalize_event(dict(data))

        CanonicalKeyDict.__init__(self, data, **kwargs)


def ref_func(x):
    return x.project_id or x.project.id


class Event(Model):
    """
    An event backed by data stored in postgres.

    """

    __core__ = False

    group_id = BoundedBigIntegerField(blank=True, null=True)
    event_id = models.CharField(max_length=32, null=True, db_column="message_id")
    project_id = BoundedBigIntegerField(blank=True, null=True)
    message = models.TextField()
    platform = models.CharField(max_length=64, null=True)
    datetime = models.DateTimeField(default=timezone.now, db_index=True)
    time_spent = BoundedIntegerField(null=True)
    data = NodeField(
        blank=True,
        null=True,
        ref_func=ref_func,
        ref_version=2,
        wrapper=EventDict,
        skip_nodestore_save=True,
    )

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_message"
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        unique_together = (("project_id", "event_id"),)
        index_together = (("group_id", "datetime"),)

    __repr__ = sane_repr("project_id", "group_id")

    def __getstate__(self):
        state = Model.__getstate__(self)

        # do not pickle cached info.  We want to fetch this on demand
        # again.  In particular if we were to pickle interfaces we would
        # pickle a CanonicalKeyView which old sentry workers do not know
        # about
        state.pop("_project_cache", None)
        state.pop("_environment_cache", None)
        state.pop("_group_cache", None)
        state.pop("interfaces", None)

        return state
