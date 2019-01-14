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
import warnings

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone
from django.utils.http import urlencode
from django.utils.translation import ugettext_lazy as _

from sentry import eventtypes, tagstore
from sentry.constants import (
    DEFAULT_LOGGER_NAME, EVENT_ORDERING_KEY, LOG_LEVELS, MAX_CULPRIT_LENGTH
)
from sentry.db.models import (
    BaseManager, BoundedBigIntegerField, BoundedIntegerField, BoundedPositiveIntegerField,
    FlexibleForeignKey, GzippedDictField, Model, sane_repr
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
        slug, id = match.groups()
        slug = slug.lower()
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
            project__slug=slug,
            short_id=short_id,
        )

    def from_kwargs(self, project, **kwargs):
        from sentry.event_manager import HashDiscarded, EventManager

        manager = EventManager(kwargs)
        manager.normalize()
        try:
            return manager.save(project)

        # TODO(jess): this method maybe isn't even used?
        except HashDiscarded as exc:
            logger.info(
                'discarded.hash', extra={
                    'project_id': project,
                    'description': exc.message,
                }
            )

    def from_event_id(self, project, event_id):
        """
        Resolves the 32 character event_id string into
        a Group for which it is found.
        """
        from sentry.models import EventMapping, Event
        group_id = None

        # Look up event_id in both Event and EventMapping,
        # and bail when it matches one of them, prioritizing
        # Event since it contains more history.
        for model in Event, EventMapping:
            try:
                group_id = model.objects.filter(
                    project_id=project.id,
                    event_id=event_id,
                ).values_list('group_id', flat=True)[0]

                # It's possible that group_id is NULL
                if group_id is not None:
                    break
            except IndexError:
                pass

        if group_id is None:
            # Raise a Group.DoesNotExist here since it makes
            # more logical sense since this is intending to resolve
            # a Group.
            raise Group.DoesNotExist()

        return Group.objects.get(id=group_id)

    def filter_by_event_id(self, project_ids, event_id):
        from sentry.models import EventMapping, Event
        group_ids = set()
        # see above for explanation as to why we're
        # looking at both Event and EventMapping
        for model in Event, EventMapping:
            group_ids.update(
                model.objects.filter(
                    project_id__in=project_ids,
                    event_id=event_id,
                    group_id__isnull=False,
                ).values_list('group_id', flat=True)
            )

        return Group.objects.filter(id__in=group_ids)

    def add_tags(self, group, environment, tags):
        project_id = group.project_id
        date = group.last_seen

        for tag_item in tags:
            if len(tag_item) == 2:
                (key, value), data = tag_item, None
            else:
                key, value, data = tag_item

            tagstore.incr_tag_value_times_seen(project_id, environment.id, key, value, extra={
                'last_seen': date,
                'data': data,
            })

            tagstore.incr_group_tag_value_times_seen(project_id, group.id, environment.id, key, value, extra={
                'project_id': project_id,
                'last_seen': date,
            })

    def get_groups_by_external_issue(self, integration, external_issue_key):
        from sentry.models import ExternalIssue, GroupLink
        return Group.objects.filter(
            id__in=GroupLink.objects.filter(
                linked_id__in=ExternalIssue.objects.filter(
                    key=external_issue_key,
                    integration_id=integration.id,
                    organization_id__in=integration.organizations.values_list('id', flat=True),
                ).values_list('id', flat=True),
            ).values_list('group_id', flat=True),
            project__organization_id__in=integration.organizations.values_list('id', flat=True),
        )


class Group(Model):
    """
    Aggregated message which summarizes a set of Events.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    logger = models.CharField(
        max_length=64,
        blank=True,
        default=DEFAULT_LOGGER_NAME,
        db_index=True)
    level = BoundedPositiveIntegerField(
        choices=LOG_LEVELS.items(), default=logging.ERROR, blank=True, db_index=True
    )
    message = models.TextField()
    culprit = models.CharField(
        max_length=MAX_CULPRIT_LENGTH, blank=True, null=True, db_column='view'
    )
    num_comments = BoundedPositiveIntegerField(default=0, null=True)
    platform = models.CharField(max_length=64, null=True)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (GroupStatus.UNRESOLVED, _('Unresolved')), (GroupStatus.RESOLVED, _('Resolved')),
            (GroupStatus.IGNORED, _('Ignored')),
        ),
        db_index=True
    )
    times_seen = BoundedPositiveIntegerField(default=1, db_index=True)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_release = FlexibleForeignKey('sentry.Release', null=True, on_delete=models.PROTECT)
    resolved_at = models.DateTimeField(null=True, db_index=True)
    # active_at should be the same as first_seen by default
    active_at = models.DateTimeField(null=True, db_index=True)
    time_spent_total = BoundedIntegerField(default=0)
    time_spent_count = BoundedIntegerField(default=0)
    # score will be incorrect in sqlite as it doesnt support the required functions
    score = BoundedIntegerField(default=0)
    # deprecated, do not use. GroupShare has superseded
    is_public = models.NullBooleanField(default=False, null=True)
    data = GzippedDictField(blank=True, null=True)
    short_id = BoundedBigIntegerField(null=True)

    objects = GroupManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupedmessage'
        verbose_name_plural = _('grouped messages')
        verbose_name = _('grouped message')
        permissions = (("can_view", "Can view"), )
        index_together = (('project', 'first_release'), )
        unique_together = (('project', 'short_id'), )

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
        if self.times_seen is None:
            self.times_seen = 1
        self.score = type(self).calculate_score(
            times_seen=self.times_seen,
            last_seen=self.last_seen,
        )
        super(Group, self).save(*args, **kwargs)

    def get_absolute_url(self, params=None):
        url = reverse('sentry-group', args=[self.organization.slug, self.project.slug, self.id])
        if params:
            url = url + '?' + urlencode(params)
        return absolute_uri(url)

    @property
    def qualified_short_id(self):
        if self.short_id is not None:
            return '%s-%s' % (self.project.slug.upper(), base32_encode(self.short_id), )

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

        status = self.status

        if status == GroupStatus.IGNORED:
            try:
                snooze = GroupSnooze.objects.get(group=self)
            except GroupSnooze.DoesNotExist:
                pass
            else:
                if not snooze.is_valid(group=self):
                    status = GroupStatus.UNRESOLVED

        if status == GroupStatus.UNRESOLVED and self.is_over_resolve_age():
            return GroupStatus.RESOLVED
        return status

    def get_share_id(self):
        from sentry.models import GroupShare
        try:
            return GroupShare.objects.filter(
                group_id=self.id,
            ).values_list('uuid', flat=True)[0]
        except IndexError:
            # Otherwise it has not been shared yet.
            return None

    @classmethod
    def from_share_id(cls, share_id):
        if not share_id or len(share_id) != 32:
            raise cls.DoesNotExist

        from sentry.models import GroupShare
        return cls.objects.get(
            id=GroupShare.objects.filter(
                uuid=share_id,
            ).values_list('group_id'),
        )

    def get_score(self):
        return type(self).calculate_score(self.times_seen, self.last_seen)

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

    def get_first_release(self):
        if self.first_release_id is None:
            return tagstore.get_first_release(self.project_id, self.id)

        return self.first_release.version

    def get_last_release(self):
        return tagstore.get_last_release(self.project_id, self.id)

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
        from sentry.event_manager import get_event_metadata_compat
        return get_event_metadata_compat(self.data, self.message)

    @property
    def title(self):
        et = eventtypes.get(self.get_event_type())(self.data)
        return et.to_string(self.get_event_metadata())

    def error(self):
        warnings.warn('Group.error is deprecated, use Group.title', DeprecationWarning)
        return self.title

    error.short_description = _('error')

    @property
    def message_short(self):
        warnings.warn('Group.message_short is deprecated, use Group.title', DeprecationWarning)
        return self.title

    @property
    def organization(self):
        return self.project.organization

    @property
    def checksum(self):
        warnings.warn('Group.checksum is no longer used', DeprecationWarning)
        return ''

    def get_email_subject(self):
        return '%s - %s' % (
            self.qualified_short_id.encode('utf-8'),
            self.title.encode('utf-8')
        )

    def count_users_seen(self):
        return tagstore.get_groups_user_counts(
            [self.project_id], [self.id], environment_ids=None)[self.id]

    @classmethod
    def calculate_score(cls, times_seen, last_seen):
        return math.log(float(times_seen or 1)) * 600 + float(last_seen.strftime('%s'))
