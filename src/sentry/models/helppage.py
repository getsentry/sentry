"""
sentry.models.helppage
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from sentry.db.models import BoundedPositiveIntegerField, Model, sane_repr
from sentry.db.models.manager import BaseManager


class HelpPage(Model):
    # key is used internally for auto-generated/versioned pages
    key = models.CharField(max_length=64, null=True, unique=True)
    title = models.CharField(max_length=64)
    content = models.TextField()
    is_visible = models.BooleanField(default=True)
    priority = BoundedPositiveIntegerField(default=50)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=(
        'pk',
    ))

    class Meta:
        db_table = 'sentry_helppage'
        app_label = 'sentry'

    __repr__ = sane_repr('title')

    @property
    def slug(self):
        return slugify(unicode(self.title))

    def natural_key(self):
        if self.key:
            return [self.key]
