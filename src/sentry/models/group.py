"""
sentry.models.group
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import math
import re
import six
import time
import warnings

from base64 import b16decode, b16encode
from datetime import timedelta
from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry import buffer, eventtypes
from sentry.constants import (
    DEFAULT_LOGGER_NAME, EVENT_ORDERING_KEY, LOG_LEVELS, MAX_CULPRIT_LENGTH
)
from sentry.db.models import (
    BaseManager, BoundedBigIntegerField, BoundedIntegerField,
    BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField, Model,
    sane_repr
)
from sentry.utils.http import absolute_uri
from sentry.utils.numbers import base32_decode, base32_encode
from sentry.utils.strings import strip, truncatechars

logger = logging.getLogger(__name__)

_short_id_re = re.compile(r'^(.*?)(?:[\s_-])([A-Za-z0-9]+)$')


def looks_like_short_id(value):
    return _short_id_re.match((value or '').strip()) is not None


# TODO(dcramer): pull in enum library
class GroupStatus(object):
    UNRESOLVED = 0
    RESOLVED = 1
    IGNORED = 2
    PENDING_DELETION = 3
    DELETION_IN_PROGRESS = 4
    PENDING_MERGE = 5

    # TODO(dcramer): remove in 9.0
    MUTED = IGNORED


def get_group_with_redirect(id, queryset=None):
    """
    Retrieve a group by ID, checking the redirect table if the requested group
    does not exist. Returns a two-tuple of ``(object, redirected)``.
    """
    if queryset is None:
        queryset = Group.objects.all()
        # When not passing a queryset, we want to read from cache
        getter = Group.objects.get_from_cache
    else:
        getter = queryset.get

    try:
        return getter(id=id), False
    except Group.DoesNotExist as error:
        from sentry.models import GroupRedirect
        qs = GroupRedirect.objects.filter(previous_group_id=id).values_list('group_id', flat=True)
        try:
            return queryset.get(id=qs), True
        except Group.DoesNotExist:
            raise error  # raise original `DoesNotExist`


class GroupManager(BaseManager):
    use_for_related_fields = True

    def by_qualified_short_id(self, organization_id, short_id):
        match = _short_id_re.match(short_id.strip())
        if match is None:
            raise Group.DoesNotExist()
        callsign, id = match.groups()
        callsign = callsign.lower()
        try:
            short_id = base32_decode(id)
            # We need to make sure the short id is not overflowing the
            # field's max or the lookup will fail with an assertion error.
            max_id = Group._meta.get_field_by_name('short_id')[0].MAX_VALUE
            if short_id > max_id:
                raise ValueError()
        except ValueError:
            raise Group.DoesNotExist()
        return Group.objects.get(
            project__organization=organization_id,
            project__slug=callsign,
            short_id=short_id,
        )

    def from_kwargs(self, project, **kwargs):
        from sentry.event_manager import EventManager

        manager = EventManager(kwargs)
        manager.normalize()
        return manager.save(project)

    def add_tags(self, group, tags):
        from sentry.models import TagValue, GroupTagValue

        project_id = group.project_id
        date = group.last_seen

        for tag_item in tags:
            if len(tag_item) == 2:
                (key, value), data = tag_item, None
            else:
                key, value, data = tag_item

            buffer.incr(TagValue, {
                'times_seen': 1,
            }, {
                'project_id': project_id,
                'key': key,
                'value': value,
            }, {
                'last_seen': date,
                'data': data,
            })

            buffer.incr(GroupTagValue, {
                'times_seen': 1,
            }, {
                'group_id': group.id,
                'key': key,
                'value': value,
            }, {
                'project_id': project_id,
                'last_seen': date,
            })


class Group(Model):
    """
    Aggregated message which summarizes a set of Events.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    logger = models.CharField(
        max_length=64, blank=True, default=DEFAULT_LOGGER_NAME, db_index=True)
    level = BoundedPositiveIntegerField(
        choices=LOG_LEVELS.items(), default=logging.ERROR, blank=True,
        db_index=True)
    message = models.TextField()
    culprit = models.CharField(
        max_length=MAX_CULPRIT_LENGTH, blank=True, null=True,
        db_column='view')
    num_comments = BoundedPositiveIntegerField(default=0, null=True)
    platform = models.CharField(max_length=64, null=True)
    status = BoundedPositiveIntegerField(default=0, choices=(
        (GroupStatus.UNRESOLVED, _('Unresolved')),
        (GroupStatus.RESOLVED, _('Resolved')),
        (GroupStatus.IGNORED, _('Ignored')),
    ), db_index=True)
    times_seen = BoundedPositiveIntegerField(default=1, db_index=True)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_release = FlexibleForeignKey('sentry.Release', null=True,
                                       on_delete=models.PROTECT)
    resolved_at = models.DateTimeField(null=True, db_index=True)
    # active_at should be the same as first_seen by default
    active_at = models.DateTimeField(null=True, db_index=True)
    time_spent_total = BoundedIntegerField(default=0)
    time_spent_count = BoundedIntegerField(default=0)
    score = BoundedIntegerField(default=0)
    is_public = models.NullBooleanField(default=False, null=True)
    data = GzippedDictField(blank=True, null=True)
    short_id = BoundedBigIntegerField(null=True)

    objects = GroupManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupedmessage'
        verbose_name_plural = _('grouped messages')
        verbose_name = _('grouped message')
        permissions = (
            ("can_view", "Can view"),
        )
        index_together = (
            ('project', 'first_release'),
        )
        unique_together = (
            ('project', 'short_id'),
        )

    __repr__ = sane_repr('project_id')

    def __unicode__(self):
        return "(%s) %s" % (self.times_seen, self.error())

    def save(self, *args, **kwargs):
        if not self.last_seen:
            self.last_seen = timezone.now()
        if not self.first_seen:
            self.first_seen = self.last_seen
        if not self.active_at:
            self.active_at = self.first_seen
        # We limit what we store for the message body
        self.message = strip(self.message)
        if self.message:
            self.message = truncatechars(self.message.splitlines()[0], 255)
        super(Group, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry-group', args=[
            self.organization.slug, self.project.slug, self.id]))

    @property
    def qualified_short_id(self):
        if self.short_id is not None:
            return '%s-%s' % (
                self.project.slug.upper(),
                base32_encode(self.short_id),
            )

    @property
    def event_set(self):
        from sentry.models import Event
        return Event.objects.filter(group_id=self.id)

    def is_over_resolve_age(self):
        resolve_age = self.project.get_option('sentry:resolve_age', None)
        if not resolve_age:
            return False
        return self.last_seen < timezone.now() - timedelta(hours=int(resolve_age))

    def is_ignored(self):
        return self.get_status() == GroupStatus.IGNORED

    # TODO(dcramer): remove in 9.0 / after plugins no long ref
    is_muted = is_ignored

    def is_resolved(self):
        return self.get_status() == GroupStatus.RESOLVED

    def get_status(self):
        # XXX(dcramer): GroupSerializer reimplements this logic
        from sentry.models import GroupSnooze

        if self.status == GroupStatus.IGNORED:
            try:
                snooze = GroupSnooze.objects.get(group=self)
            except GroupSnooze.DoesNotExist:
                pass
            else:
                # XXX(dcramer): if the snooze row exists then we need
                # to confirm its still valid
                if snooze.until > timezone.now():
                    return GroupStatus.IGNORED
                else:
                    return GroupStatus.UNRESOLVED

        if self.status == GroupStatus.UNRESOLVED and self.is_over_resolve_age():
            return GroupStatus.RESOLVED
        return self.status

    def get_share_id(self):
        return b16encode(
            ('{}.{}'.format(self.project_id, self.id)).encode('utf-8')
        ).lower().decode('utf-8')

    @classmethod
    def from_share_id(cls, share_id):
        if not share_id:
            raise cls.DoesNotExist
        try:
            project_id, group_id = b16decode(share_id.upper()).decode('utf-8').split('.')
        except (ValueError, TypeError):
            raise cls.DoesNotExist
        if not (project_id.isdigit() and group_id.isdigit()):
            raise cls.DoesNotExist
        return cls.objects.get(project=project_id, id=group_id)

    def get_score(self):
        return int(math.log(self.times_seen) * 600 + float(time.mktime(self.last_seen.timetuple())))

    def get_latest_event(self):
        from sentry.models import Event

        if not hasattr(self, '_latest_event'):
            latest_events = sorted(
                Event.objects.filter(
                    group_id=self.id,
                ).order_by('-datetime')[0:5],
                key=EVENT_ORDERING_KEY,
                reverse=True,
            )
            try:
                self._latest_event = latest_events[0]
            except IndexError:
                self._latest_event = None
        return self._latest_event

    def get_oldest_event(self):
        from sentry.models import Event

        if not hasattr(self, '_oldest_event'):
            oldest_events = sorted(
                Event.objects.filter(
                    group_id=self.id,
                ).order_by('datetime')[0:5],
                key=EVENT_ORDERING_KEY,
            )
            try:
                self._oldest_event = oldest_events[0]
            except IndexError:
                self._oldest_event = None
        return self._oldest_event

    def get_unique_tags(self, tag, since=None, order_by='-times_seen'):
        # TODO(dcramer): this has zero test coverage and is a critical path
        from sentry.models import GroupTagValue

        queryset = GroupTagValue.objects.filter(
            group=self,
            key=tag,
        )
        if since:
            queryset = queryset.filter(last_seen__gte=since)
        return queryset.values_list(
            'value',
            'times_seen',
            'first_seen',
            'last_seen',
        ).order_by(order_by)

    def get_tags(self, with_internal=True):
        from sentry.models import GroupTagKey, TagKey
        if not hasattr(self, '_tag_cache'):
            group_tags = GroupTagKey.objects.filter(
                group=self,
                project=self.project,
            )
            if not with_internal:
                group_tags = group_tags.exclude(key__startswith='sentry:')

            group_tags = list(group_tags.values_list('key', flat=True))

            tag_keys = dict(
                (t.key, t)
                for t in TagKey.objects.filter(
                    project=self.project,
                    key__in=group_tags
                )
            )

            results = []
            for key in group_tags:
                try:
                    tag_key = tag_keys[key]
                except KeyError:
                    label = key.replace('_', ' ').title()
                else:
                    label = tag_key.get_label()

                results.append({
                    'key': key,
                    'label': label,
                })

            self._tag_cache = sorted(results, key=lambda x: x['label'])

        return self._tag_cache

    def get_first_release(self):
        from sentry.models import GroupTagValue
        if self.first_release_id is None:
            try:
                first_release = GroupTagValue.objects.filter(
                    group_id=self.id,
                    key__in=('sentry:release', 'release'),
                ).order_by('first_seen')[0]
            except IndexError:
                return None
            else:
                return first_release.value

        return self.first_release.version

    def get_last_release(self):
        from sentry.models import GroupTagValue
        try:
            last_release = GroupTagValue.objects.filter(
                group_id=self.id,
                key__in=('sentry:release', 'release'),
            ).order_by('-last_seen')[0]
        except IndexError:
            return None

        return last_release.value

    def get_event_type(self):
        """
        Return the type of this issue.

        See ``sentry.eventtypes``.
        """
        return self.data.get('type', 'default')

    def get_event_metadata(self):
        """
        Return the metadata of this issue.

        See ``sentry.eventtypes``.
        """
        etype = self.data.get('type')
        if etype is None:
            etype = 'default'
        if 'metadata' not in self.data:
            data = self.data.copy() if self.data else {}
            data['message'] = self.message
            return eventtypes.get(etype)(data).get_metadata()
        return self.data['metadata']

    @property
    def title(self):
        et = eventtypes.get(self.get_event_type())(self.data)
        return et.to_string(self.get_event_metadata())

    def error(self):
        warnings.warn('Group.error is deprecated, use Group.title',
                      DeprecationWarning)
        return self.title
    error.short_description = _('error')

    @property
    def message_short(self):
        warnings.warn('Group.message_short is deprecated, use Group.title',
                      DeprecationWarning)
        return self.title

    def has_two_part_message(self):
        warnings.warn('Group.has_two_part_message is no longer used',
                      DeprecationWarning)
        return False

    @property
    def organization(self):
        return self.project.organization

    @property
    def team(self):
        return self.project.team

    @property
    def checksum(self):
        warnings.warn('Group.checksum is no longer used', DeprecationWarning)
        return ''

    def get_email_subject(self):
        return '[%s] %s: %s' % (
            self.project.get_full_name().encode('utf-8'),
            six.text_type(self.get_level_display()).upper().encode('utf-8'),
            self.title.encode('utf-8')
        )
