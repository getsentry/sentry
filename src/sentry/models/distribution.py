"""
sentry.models.distribution
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models, IntegrityError, transaction
from django.utils import timezone

from sentry.db.models import Model, FlexibleForeignKey, sane_repr


class Distribution(Model):
    __core__ = False

    release = FlexibleForeignKey('sentry.Release')
    name = models.CharField(max_length=64)
    date_added = models.DateTimeField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_distribution'
        unique_together = (('release', 'name'),)

    __repr__ = sane_repr('release', 'name')

    @classmethod
    def get_or_create(cls, release, name, date_added=None):
        if date_added is None:
            date_added = timezone.now()
        try:
            with transaction.atomic():
                return cls.objects.create(
                    release=release,
                    name=name,
                    date_added=date_added
                )
        except IntegrityError:
            return cls.objects.get(
                release=release,
                name=name
            )

    @classmethod
    def get(cls, release, name):
        try:
            rv = Distribution.objects.get(
                release=release,
                name=name
            )
            rv.release = release
            return rv
        except Distribution.DoesNotExist:
            return None
