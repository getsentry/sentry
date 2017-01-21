"""
sentry.models.tagvalue
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone

from sentry.constants import MAX_TAG_KEY_LENGTH, MAX_TAG_VALUE_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField,
    BaseManager, sane_repr
)
from sentry.utils.http import absolute_uri


class TagValue(Model):
    """
    Stores references to available filters.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    data = GzippedDictField(blank=True, null=True)
    times_seen = BoundedPositiveIntegerField(default=0)
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_filtervalue'
        unique_together = (('project', 'key', 'value'),)

    __repr__ = sane_repr('project_id', 'key', 'value')

    @classmethod
    def is_valid_value(cls, value):
        return '\n' not in value

    def get_label(self):
        # HACK(dcramer): quick and dirty way to hack in better display states
        if self.key == 'sentry:user':
            return self.data.get('email') or self.value
        elif self.key == 'sentry:function':
            return '%s in %s' % (self.data['function'], self.data['filename'])
        elif self.key == 'sentry:filename':
            return self.data['filename']
        elif self.key == 'sentry:release' and len(self.value) == 40:
            return self.value[:12]
        return self.value

    def get_absolute_url(self):
        # HACK(dcramer): quick and dirty way to support code/users
        if self.key == 'sentry:user':
            url_name = 'sentry-user-details'
        elif self.key == 'sentry:filename':
            url_name = 'sentry-explore-code-details'
        elif self.key == 'sentry:function':
            url_name = 'sentry-explore-code-details-by-function'
        else:
            url_name = 'sentry-explore-tag-value'
            return absolute_uri(reverse(url_name, args=[
                self.project.organization.slug, self.project.slug, self.key, self.id]))

        return absolute_uri(reverse(url_name, args=[
            self.project.organization.slug, self.project.slug, self.id]))
