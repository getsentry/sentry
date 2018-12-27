"""
sentry.models.event
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six
import string
import warnings

from collections import OrderedDict
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from hashlib import md5

from sentry import eventtypes
from sentry.db.models import (
    BoundedBigIntegerField, BoundedIntegerField, Model, NodeField, sane_repr
)
from sentry.interfaces.base import get_interfaces
from sentry.utils.cache import memoize
from sentry.utils.canonical import CanonicalKeyDict, CanonicalKeyView
from sentry.utils.safe import get_path
from sentry.utils.strings import truncatechars


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
        wrapper=CanonicalKeyDict,
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_message'
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        unique_together = (('project_id', 'event_id'), )
        index_together = (('group_id', 'datetime'), )

    __repr__ = sane_repr('project_id', 'group_id')

    @classmethod
    def generate_node_id(cls, project_id, event_id):
        """
        Returns a deterministic node_id for this event based on the project_id
        and event_id which together are globally unique. The event body should
        be saved under this key in nodestore so it can be retrieved using the
        same generated id when we only have project_id and event_id.
        """
        return md5('{}:{}'.format(project_id, event_id)).hexdigest()

    def __getstate__(self):
        state = Model.__getstate__(self)

        # do not pickle cached info.  We want to fetch this on demand
        # again.  In particular if we were to pickle interfaces we would
        # pickle a CanonicalKeyView which old sentry workers do not know
        # about
        state.pop('_project_cache', None)
        state.pop('_group_cache', None)
        state.pop('interfaces', None)

        return state

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
        # TODO(mitsuhiko): remove this code once it's unused.  It's still
        # being used by plugin code and once the message rename is through
        # plugins should instead swithc to the actual message attribute or
        # this method could return what currently is real_message.
        return get_path(self.data, 'logentry', 'formatted') \
            or get_path(self.data, 'logentry', 'message') \
            or self.message

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
        from sentry.event_manager import get_event_metadata_compat
        return get_event_metadata_compat(self.data, self.message)

    def get_hashes(self):
        """
        Returns the calculated hashes for the event.
        """
        from sentry.event_hashing import calculate_event_hashes
        # If we have hashes stored in the data we use them, otherwise we
        # fall back to generating new ones from the data
        hashes = self.data.get('hashes')
        if hashes is not None:
            return hashes
        return calculate_event_hashes(self)

    def get_primary_hash(self):
        # TODO: This *might* need to be protected from an IndexError?
        return self.get_hashes()[0]

    @property
    def title(self):
        et = eventtypes.get(self.get_event_type())(self.data)
        return et.to_string(self.get_event_metadata())

    def error(self):
        warnings.warn('Event.error is deprecated, use Event.title', DeprecationWarning)
        return self.title

    error.short_description = _('error')

    @property
    def real_message(self):
        # XXX(mitsuhiko): this is a transitional attribute that should be
        # removed.  `message` will be renamed to `search_message` and this
        # will become `message`.
        return get_path(self.data, 'logentry', 'formatted') \
            or get_path(self.data, 'logentry', 'message') \
            or ''

    @property
    def message_short(self):
        warnings.warn('Event.message_short is deprecated, use Event.title', DeprecationWarning)
        return self.title

    @property
    def organization(self):
        return self.project.organization

    @property
    def version(self):
        return self.data.get('version', '5')

    @memoize
    def ip_address(self):
        ip_address = get_path(self.data, 'user', 'ip_address')
        if ip_address:
            return ip_address

        remote_addr = get_path(self.data, 'request', 'env', 'REMOTE_ADDR')
        if remote_addr:
            return remote_addr

        return None

    def get_interfaces(self):
        return CanonicalKeyView(get_interfaces(self.data))

    @memoize
    def interfaces(self):
        return self.get_interfaces()

    def get_tags(self):
        try:
            return sorted((t, v) for t, v in self.data.get('tags') or ())
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

    @property
    def release(self):
        return self.get_tag('sentry:release')

    @property
    def dist(self):
        return self.get_tag('sentry:dist')

    def as_dict(self):
        # We use a OrderedDict to keep elements ordered for a potential JSON serializer
        data = OrderedDict()
        data['event_id'] = self.event_id
        data['project'] = self.project_id
        data['release'] = self.release
        data['dist'] = self.dist
        data['platform'] = self.platform
        data['message'] = self.real_message
        data['datetime'] = self.datetime
        data['time_spent'] = self.time_spent
        data['tags'] = [(k.split('sentry:', 1)[-1], v) for (k, v) in self.get_tags()]
        for k, v in sorted(six.iteritems(self.data)):
            if k in data:
                continue
            if k == 'sdk':
                v = {v_k: v_v for v_k, v_v in six.iteritems(v) if v_k != 'client_ip'}
            data[k] = v

        # for a long time culprit was not persisted.  In those cases put
        # the culprit in from the group.
        if data.get('culprit') is None:
            data['culprit'] = self.group.culprit

        return data

    @property
    def size(self):
        data_len = 0
        for value in six.itervalues(self.data):
            data_len += len(repr(value))
        return data_len

    # XXX(dcramer): compatibility with plugins
    def get_level_display(self):
        warnings.warn(
            'Event.get_level_display is deprecated. Use Event.tags instead.', DeprecationWarning
        )
        return self.group.get_level_display()

    @property
    def level(self):
        warnings.warn('Event.level is deprecated. Use Event.tags instead.', DeprecationWarning)
        return self.group.level

    @property
    def logger(self):
        warnings.warn('Event.logger is deprecated. Use Event.tags instead.', DeprecationWarning)
        return self.get_tag('logger')

    @property
    def site(self):
        warnings.warn('Event.site is deprecated. Use Event.tags instead.', DeprecationWarning)
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

    @property
    def transaction(self):
        return self.get_tag('transaction')

    def get_email_subject(self):
        template = self.project.get_option('mail:subject_template')
        if template:
            template = EventSubjectTemplate(template)
        else:
            template = DEFAULT_SUBJECT_TEMPLATE
        return truncatechars(
            template.safe_substitute(
                EventSubjectTemplateData(self),
            ),
            128,
        ).encode('utf-8')

    def get_environment(self):
        from sentry.models import Environment

        if not hasattr(self, '_environment_cache'):
            self._environment_cache = Environment.objects.get(
                organization_id=self.project.organization_id,
                name=Environment.get_name_or_default(self.get_tag('environment')),
            )

        return self._environment_cache


class EventSubjectTemplate(string.Template):
    idpattern = r'(tag:)?[_a-z][_a-z0-9]*'


class EventSubjectTemplateData(object):
    tag_aliases = {
        'release': 'sentry:release',
        'dist': 'sentry:dist',
        'user': 'sentry:user',
    }

    def __init__(self, event):
        self.event = event

    def __getitem__(self, name):
        if name.startswith('tag:'):
            name = name[4:]
            value = self.event.get_tag(self.tag_aliases.get(name, name))
            if value is None:
                raise KeyError
            return six.text_type(value)
        elif name == 'project':
            return self.event.project.get_full_name()
        elif name == 'projectID':
            return self.event.project.slug
        elif name == 'shortID':
            return self.event.group.qualified_short_id
        elif name == 'orgID':
            return self.event.organization.slug
        elif name == 'title':
            return self.event.title
        raise KeyError


DEFAULT_SUBJECT_TEMPLATE = EventSubjectTemplate('$shortID - $title')
