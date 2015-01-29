"""
sentry.models.event
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import warnings
from collections import OrderedDict

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    Model, NodeField, BoundedIntegerField, BoundedPositiveIntegerField,
    BaseManager, FlexibleForeignKey, sane_repr
)
from sentry.interfaces.base import get_interface
from sentry.utils.cache import memoize
from sentry.utils.safe import safe_execute
from sentry.utils.strings import truncatechars, strip


class Event(Model):
    """
    An individual event.
    """
    group = FlexibleForeignKey('sentry.Group', blank=True, null=True, related_name="event_set")
    event_id = models.CharField(max_length=32, null=True, db_column="message_id")
    project = FlexibleForeignKey('sentry.Project', null=True)
    message = models.TextField()
    checksum = models.CharField(max_length=32, db_index=True)
    num_comments = BoundedPositiveIntegerField(default=0, null=True)
    platform = models.CharField(max_length=64, null=True)
    datetime = models.DateTimeField(default=timezone.now, db_index=True)
    time_spent = BoundedIntegerField(null=True)
    data = NodeField(blank=True, null=True)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_message'
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        unique_together = (('project', 'event_id'),)
        index_together = (('group', 'datetime'),)

    __repr__ = sane_repr('project_id', 'group_id', 'checksum')

    def error(self):
        message = strip(self.message)
        if not message:
            message = '<unlabeled message>'
        else:
            message = truncatechars(message.splitlines()[0], 100)
        return message
    error.short_description = _('error')

    def has_two_part_message(self):
        message = strip(self.message)
        return '\n' in message or len(message) > 100

    @property
    def message_short(self):
        message = strip(self.message)
        if not message:
            message = '<unlabeled message>'
        else:
            message = truncatechars(message.splitlines()[0], 100)
        return message

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
        http_data = self.data.get('sentry.interfaces.Http')
        if http_data and 'env' in http_data:
            value = http_data['env'].get('REMOTE_ADDR')
            if value:
                return value

        user_data = self.data.get('sentry.interfaces.User')
        if user_data:
            value = user_data.get('ip_address')
            if value:
                return value

        return None

    @memoize
    def user_ident(self):
        """
        The identifier from a user is considered from several interfaces.

        In order:

        - User.id
        - User.email
        - User.username
        - Http.env.REMOTE_ADDR

        """
        user_data = self.data.get('sentry.interfaces.User', self.data.get('user'))
        if user_data:
            ident = user_data.get('id')
            if ident:
                return 'id:%s' % (ident,)

            ident = user_data.get('email')
            if ident:
                return 'email:%s' % (ident,)

            ident = user_data.get('username')
            if ident:
                return 'username:%s' % (ident,)

        ident = self.ip_address
        if ident:
            return 'ip:%s' % (ident,)

        return None

    @memoize
    def interfaces(self):
        result = []
        for key, data in self.data.iteritems():
            try:
                cls = get_interface(key)
            except ValueError:
                continue

            value = safe_execute(cls.to_python, data)
            if not value:
                continue

            result.append((key, value))

        return OrderedDict((k, v) for k, v in sorted(result, key=lambda x: x[1].get_score(), reverse=True))

    def get_tags(self, with_internal=True):
        try:
            return [
                (t, v) for t, v in self.data.get('tags') or ()
                if with_internal or not t.startswith('sentry:')
            ]
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
        data['culprit'] = self.group.culprit
        data['message'] = self.message
        data['checksum'] = self.checksum
        data['project'] = self.project.slug
        data['datetime'] = self.datetime
        data['time_spent'] = self.time_spent
        for k, v in sorted(self.data.iteritems()):
            data[k] = v
        return data

    @property
    def size(self):
        data_len = len(self.message)
        for value in self.data.itervalues():
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
