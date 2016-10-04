"""
sentry.models.event
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six
import warnings

from collections import OrderedDict
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry import eventtypes
from sentry.db.models import (
    BaseManager, BoundedBigIntegerField, BoundedIntegerField,
    Model, NodeField, sane_repr
)
from sentry.interfaces.base import get_interface
from sentry.utils.cache import memoize
from sentry.utils.safe import safe_execute


class Event(Model):
    """
    An individual event.
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
        ref_func=lambda x: x.project_id or x.project.id,
        ref_version=2,
    )

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_message'
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        unique_together = (('project_id', 'event_id'),)
        index_together = (('group_id', 'datetime'),)

    __repr__ = sane_repr('project_id', 'group_id')

    # Implement a ForeignKey-like accessor for backwards compat
    def _set_group(self, group):
        self.group_id = group.id
        self._group_cache = group

    def _get_group(self):
        from sentry.models import Group
        if not hasattr(self, '_group_cache'):
            self._group_cache = Group.objects.get(id=self.group_id)
        return self._group_cache

    group = property(_get_group, _set_group)

    # Implement a ForeignKey-like accessor for backwards compat
    def _set_project(self, project):
        self.project_id = project.id
        self._project_cache = project

    def _get_project(self):
        from sentry.models import Project
        if not hasattr(self, '_project_cache'):
            self._project_cache = Project.objects.get(id=self.project_id)
        return self._project_cache

    project = property(_get_project, _set_project)

    def get_legacy_message(self):
        msg_interface = self.data.get('sentry.interfaces.Message', {
            'message': self.message,
        })
        return msg_interface.get('formatted', msg_interface['message'])

    def get_event_type(self):
        """
        Return the type of this event.

        See ``sentry.eventtypes``.
        """
        return self.data.get('type', 'default')

    def get_event_metadata(self):
        """
        Return the metadata of this event.

        See ``sentry.eventtypes``.
        """
        etype = self.data.get('type', 'default')
        if 'metadata' not in self.data:
            # TODO(dcramer): remove after Dec 1 2016
            data = self.data.copy() if self.data else {}
            data['message'] = self.message
            return eventtypes.get(etype)(data).get_metadata()
        return self.data['metadata']

    @property
    def title(self):
        et = eventtypes.get(self.get_event_type())(self.data)
        return et.to_string(self.get_event_metadata())

    def error(self):
        warnings.warn('Event.error is deprecated, use Event.title',
                      DeprecationWarning)
        return self.title
    error.short_description = _('error')

    @property
    def message_short(self):
        warnings.warn('Event.message_short is deprecated, use Event.title',
                      DeprecationWarning)
        return self.title

    def has_two_part_message(self):
        warnings.warn('Event.has_two_part_message is no longer used',
                      DeprecationWarning)
        return False

    @property
    def team(self):
        return self.project.team

    @property
    def organization(self):
        return self.project.organization

    @property
    def version(self):
        return self.data.get('version', '5')

    @memoize
    def ip_address(self):
        user_data = self.data.get('sentry.interfaces.User', self.data.get('user'))
        if user_data:
            value = user_data.get('ip_address')
            if value:
                return value

        http_data = self.data.get('sentry.interfaces.Http', self.data.get('http'))
        if http_data and 'env' in http_data:
            value = http_data['env'].get('REMOTE_ADDR')
            if value:
                return value

        return None

    def get_interfaces(self):
        result = []
        for key, data in six.iteritems(self.data):
            try:
                cls = get_interface(key)
            except ValueError:
                continue

            value = safe_execute(cls.to_python, data,
                                 _with_transaction=False)
            if not value:
                continue

            result.append((key, value))

        return OrderedDict((k, v) for k, v in sorted(result, key=lambda x: x[1].get_score(), reverse=True))

    @memoize
    def interfaces(self):
        return self.get_interfaces()

    def get_tags(self, with_internal=True):
        try:
            return sorted(
                (t, v) for t, v in self.data.get('tags') or ()
                if with_internal or not t.startswith('sentry:')
            )
        except ValueError:
            # at one point Sentry allowed invalid tag sets such as (foo, bar)
            # vs ((tag, foo), (tag, bar))
            return []

    tags = property(get_tags)

    def get_tag(self, key):
        for t, v in (self.data.get('tags') or ()):
            if t == key:
                return v
        return None

    def as_dict(self):
        # We use a OrderedDict to keep elements ordered for a potential JSON serializer
        data = OrderedDict()
        data['id'] = self.event_id
        data['project'] = self.project_id
        data['release'] = self.get_tag('sentry:release')
        data['platform'] = self.platform
        data['culprit'] = self.group.culprit
        data['message'] = self.get_legacy_message()
        data['datetime'] = self.datetime
        data['time_spent'] = self.time_spent
        data['tags'] = self.get_tags()
        for k, v in sorted(six.iteritems(self.data)):
            data[k] = v
        return data

    @property
    def size(self):
        data_len = len(self.get_legacy_message())
        for value in six.itervalues(self.data):
            data_len += len(repr(value))
        return data_len

    # XXX(dcramer): compatibility with plugins
    def get_level_display(self):
        warnings.warn('Event.get_level_display is deprecated. Use Event.tags instead.',
                      DeprecationWarning)
        return self.group.get_level_display()

    @property
    def level(self):
        warnings.warn('Event.level is deprecated. Use Event.tags instead.',
                      DeprecationWarning)
        return self.group.level

    @property
    def logger(self):
        warnings.warn('Event.logger is deprecated. Use Event.tags instead.',
                      DeprecationWarning)
        return self.get_tag('logger')

    @property
    def site(self):
        warnings.warn('Event.site is deprecated. Use Event.tags instead.',
                      DeprecationWarning)
        return self.get_tag('site')

    @property
    def server_name(self):
        warnings.warn('Event.server_name is deprecated. Use Event.tags instead.')
        return self.get_tag('server_name')

    @property
    def culprit(self):
        warnings.warn('Event.culprit is deprecated. Use Group.culprit instead.')
        return self.group.culprit

    @property
    def checksum(self):
        warnings.warn('Event.checksum is no longer used', DeprecationWarning)
        return ''

    def get_email_subject(self):
        return '[%s] %s: %s' % (
            self.project.get_full_name().encode('utf-8'),
            six.text_type(self.get_tag('level')).upper().encode('utf-8'),
            self.title.encode('utf-8')
        )
