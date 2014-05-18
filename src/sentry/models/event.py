"""
sentry.models.event
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.db import models
from django.utils import timezone
from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext_lazy as _

import six

from sentry.db.models import (
    Model, NodeField, BoundedIntegerField, BoundedPositiveIntegerField,
    BaseManager, sane_repr
)
from sentry.utils.cache import memoize
from sentry.utils.imports import import_string
from sentry.utils.safe import safe_execute
from sentry.utils.strings import truncatechars, strip


class Event(Model):
    """
    An individual event.
    """
    group = models.ForeignKey('sentry.Group', blank=True, null=True, related_name="event_set")
    event_id = models.CharField(max_length=32, null=True, db_column="message_id")
    project = models.ForeignKey('sentry.Project', null=True)
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
        unique_together = ('project', 'event_id')

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
        user_data = self.data.get('sentry.interfaces.User')
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
            if '.' not in key:
                continue

            try:
                cls = import_string(key)
            except ImportError:
                continue  # suppress invalid interfaces

            value = safe_execute(cls, **data)
            if not value:
                continue

            result.append((key, value))

        return SortedDict((k, v) for k, v in sorted(result, key=lambda x: x[1].get_score(), reverse=True))

    def get_version(self):
        if not self.data:
            return
        if '__sentry__' not in self.data:
            return
        if 'version' not in self.data['__sentry__']:
            return
        module = self.data['__sentry__'].get('module', 'ver')
        return module, self.data['__sentry__']['version']

    def get_tags(self):
        try:
            return [
                (t, v) for t, v in self.data.get('tags') or ()
                if not t.startswith('sentry:')
            ]
        except ValueError:
            # at one point Sentry allowed invalid tag sets such as (foo, bar)
            # vs ((tag, foo), (tag, bar))
            return []

    def as_dict(self):
        # We use a SortedDict to keep elements ordered for a potential JSON serializer
        data = SortedDict()
        data['id'] = self.event_id
        data['checksum'] = self.checksum
        data['project'] = self.project.slug
        data['datetime'] = self.datetime
        data['time_spent'] = self.time_spent
        for k, v in sorted(self.data.iteritems()):
            data[k] = v
        return data

    @property
    def size(self):
        return len(six.text_type(vars(self)))

    # XXX(dcramer): compatibility with plugins
    def get_level_display(self):
        return self.group.get_level_display()
