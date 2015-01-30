"""
sentry.models.tagkey
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.db import models
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MAX_TAG_KEY_LENGTH, TAG_LABELS
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, sane_repr
)
from sentry.db.models.manager import BaseManager
from sentry.utils.cache import cache
from sentry.utils.http import absolute_uri


# TODO(dcramer): pull in enum library
class TagKeyStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class TagKeyManager(BaseManager):
    def _get_cache_key(self, project_id):
        return 'filterkey:all:%s' % project_id

    def all_keys(self, project):
        # TODO: cache invalidation via post_save/post_delete signals much like BaseManager
        key = self._get_cache_key(project.id)
        result = cache.get(key)
        if result is None:
            result = list(self.filter(
                project=project,
                status=TagKeyStatus.VISIBLE,
            ).values_list('key', flat=True))
            cache.set(key, result, 60)
        return result


class TagKey(Model):
    """
    Stores references to available filters keys.
    """
    DEFAULT_URL_NAME = 'sentry-explore-tag'
    URL_NAMES = {
        'sentry:user': 'sentry-users',
        'sentry:filename': 'sentry-explore-code',
        'sentry:function': 'sentry-explore-code-by-function',
    }

    project = FlexibleForeignKey('sentry.Project')
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)
    label = models.CharField(max_length=64, null=True)
    status = BoundedPositiveIntegerField(choices=(
        (TagKeyStatus.VISIBLE, _('Visible')),
        (TagKeyStatus.PENDING_DELETION, _('Pending Deletion')),
        (TagKeyStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), default=TagKeyStatus.VISIBLE)

    objects = TagKeyManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_filterkey'
        unique_together = (('project', 'key'),)

    __repr__ = sane_repr('project_id', 'key')

    def get_label(self):
        return self.label \
            or TAG_LABELS.get(self.key) \
            or self.key.replace('_', ' ').title()

    def get_absolute_url(self):
        # HACK(dcramer): quick and dirty way to support code/users
        try:
            url_name = self.URL_NAMES[self.key]
        except KeyError:
            url_name = self.DEFAULT_URL_NAME
            return absolute_uri(reverse(url_name, args=[
                self.project.organization.slug, self.project.slug, self.key]))

        return absolute_uri(reverse(url_name, args=[
            self.project.organization.slug, self.project.slug]))

    def get_audit_log_data(self):
        return {
            'key': self.key,
        }
