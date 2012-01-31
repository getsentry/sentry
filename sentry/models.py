"""
sentry.models
~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging
import math
import time
import uuid
from datetime import datetime
from indexer.models import BaseIndex


from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import Sum, F
from django.utils.datastructures import SortedDict
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.manager import GroupManager, ProjectManager, \
  MetaManager, InstanceMetaManager, SearchDocumentManager
from sentry.utils import cached_property, \
  MockDjangoRequest
from sentry.utils.models import Model, GzippedDictField
from sentry.templatetags.sentry_helpers import truncatechars

__all__ = ('Event', 'Group', 'Project', 'SearchDocument')

STATUS_UNRESOLVED = 0
STATUS_RESOLVED = 1
STATUS_LEVELS = (
    (STATUS_UNRESOLVED, _('unresolved')),
    (STATUS_RESOLVED, _('resolved')),
)

# These are predefined builtin's
FILTER_KEYS = (
    ('server_name', _('server name')),
    ('logger', _('logger')),
    ('site', _('site')),
)

MEMBER_OWNER = 0
MEMBER_USER = 50
MEMBER_SYSTEM = 100
MEMBER_TYPES = (
    (0, _('owner')),
    (50, _('user')),
    (100, _('system agent')),
)


class Option(Model):
    """
    Global options which apply in most situations as defaults,
    and generally can be overwritten by per-project options.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    key = models.CharField(max_length=64, unique=True)
    value = models.TextField()

    objects = MetaManager()


class Project(Model):
    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.
    """
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, related_name="owned_project_set", null=True)
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=datetime.now)
    status = models.PositiveIntegerField(default=0, choices=(
        (0, 'Visible'),
        (1, 'Hidden'),
    ), db_index=True)

    objects = ProjectManager()

    def __unicode__(self):
        return u'#%s %r' % (self.pk, self.name)

    def delete(self):
        # This hadles cascades properly
        # TODO: this doesnt clean up the index
        for model in (Event, Group, FilterValue, MessageFilterValue, MessageCountByMinute):
            model.objects.filter(project=self).delete()
        super(Project, self).delete()

    def merge_to(self, project):
        if not isinstance(project, Project):
            project = Project.objects.get(pk=project)

        for group in Group.objects.filter(project=self):
            try:
                other = Group.objects.get(
                    project=project,
                    logger=group.logger,
                    culprit=group.culprit,
                    checksum=group.checksum,
                )
            except Group.DoesNotExist:
                group.update(project=project)
                for model in (Event, MessageFilterValue, MessageCountByMinute):
                    model.objects.filter(project=self, group=group).update(project=project)
            else:
                Event.objects.filter(group=group).update(group=other)

                for obj in MessageFilterValue.objects.filter(group=group):
                    obj2, created = MessageFilterValue.objects.get_or_create(
                        project=project,
                        group=group,
                        key=obj.key,
                        value=obj.value,
                        defaults={'times_seen': obj.times_seen}
                    )
                    if not created:
                        obj2.update(times_seen=F('times_seen') + obj.times_seen)

                for obj in MessageCountByMinute.objects.filter(group=group):
                    obj2, created = MessageCountByMinute.objects.get_or_create(
                        project=project,
                        group=group,
                        date=obj.date,
                        defaults={
                            'times_seen': obj.times_seen,
                            'time_spent_total': obj.time_spent_total,
                            'time_spent_count': obj.time_spent_count,
                        }
                    )
                    if not created:
                        obj2.update(
                            times_seen=F('times_seen') + obj.times_seen,
                            time_spent_total=F('time_spent_total') + obj.time_spent_total,
                            time_spent_count=F('times_seen') + obj.time_spent_count,
                        )

        for fv in FilterValue.objects.filter(project=self):
            FilterValue.objects.get_or_create(project=project, key=fv.key, value=fv.value)
            fv.delete()
        self.delete()


class ProjectOption(Model):
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    project = models.ForeignKey(Project)
    key = models.CharField(max_length=64)
    value = models.TextField()

    objects = InstanceMetaManager('project')

    class Meta:
        db_table = 'sentry_projectoptions'
        unique_together = (('project', 'key',),)


class ProjectMember(Model):
    """
    Identifies relationships between projects and users, including
    their API access and permissions.
    """
    project = models.ForeignKey(Project, related_name="member_set")
    user = models.ForeignKey(User, related_name="project_set")
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)
    type = models.IntegerField(choices=MEMBER_TYPES, default=MEMBER_OWNER)
    date_added = models.DateTimeField(default=datetime.now)

    class Meta:
        unique_together = (('project', 'user'),)

    def save(self, *args, **kwargs):
        if not self.public_key:
            self.public_key = ProjectMember.generate_api_key()
        if not self.secret_key:
            self.secret_key = ProjectMember.generate_api_key()
        super(ProjectMember, self).save(*args, **kwargs)

    @classmethod
    def generate_api_key(cls):
        return uuid.uuid4().hex

    def get_dsn(self, domain, secure=True):
        return 'http%s://%s:%s@%s/%s' % (
            secure and 's' or '',
            self.public_key,
            self.secret_key,
            domain,
            self.project_id,
        )


class ProjectDomain(Model):
    """
    Currently unused. Planned for 'trusted domains' for JS apis.
    """
    project = models.ForeignKey(Project, related_name="domain_set")
    domain = models.CharField(max_length=128)

    class Meta:
        unique_together = (('project', 'domain'),)


class View(Model):
    """
    A view ties directly to a view extension and simply
    identifies it at the db level.
    """
    path = models.CharField(max_length=100, unique=True)
    verbose_name = models.CharField(max_length=200, null=True)
    verbose_name_plural = models.CharField(max_length=200, null=True)


class MessageBase(Model):
    """
    Abstract base class for both Event and Group.
    """
    project = models.ForeignKey(Project, null=True)
    logger = models.CharField(max_length=64, blank=True, default='root', db_index=True)
    level = models.PositiveIntegerField(choices=settings.LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
    message = models.TextField()
    culprit = models.CharField(max_length=200, blank=True, null=True, db_column='view')
    checksum = models.CharField(max_length=32, db_index=True)
    data = GzippedDictField(blank=True, null=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if len(self.logger) > 64:
            self.logger = self.logger[0:61] + u"..."
        super(MessageBase, self).save(*args, **kwargs)

    def error(self):
        if self.message:
            message = smart_unicode(self.message)
            if len(message) > 100:
                message = message[:97] + '...'
        else:
            message = '<unlabeled message>'
        return message
    error.short_description = _('error')

    def has_two_part_message(self):
        return '\n' in self.message.strip('\n') or len(self.message) > 100

    def message_top(self):
        if self.culprit:
            return self.culprit
        return truncatechars(self.message.split('\n')[0], 100)


class Group(MessageBase):
    """
    Aggregated message which summarizes a set of Events.
    """
    # if view is null it means its from the global aggregate
    status = models.PositiveIntegerField(default=0, choices=STATUS_LEVELS, db_index=True)
    times_seen = models.PositiveIntegerField(default=1, db_index=True)
    last_seen = models.DateTimeField(default=datetime.now, db_index=True)
    first_seen = models.DateTimeField(default=datetime.now, db_index=True)
    time_spent_total = models.FloatField(default=0)
    time_spent_count = models.IntegerField(default=0)
    score = models.IntegerField(default=0)
    views = models.ManyToManyField(View, blank=True)

    objects = GroupManager()

    class Meta:
        unique_together = (('project', 'logger', 'culprit', 'checksum'),)
        verbose_name_plural = _('grouped messages')
        verbose_name = _('grouped message')
        permissions = (
            ("can_view", "Can view"),
        )
        db_table = 'sentry_groupedmessage'

    def __unicode__(self):
        return "(%s) %s" % (self.times_seen, self.error())

    def get_absolute_url(self):
        if self.project_id:
            return reverse('sentry-group', kwargs={'group_id': self.pk, 'project_id': self.project_id})
        return '#'

    def natural_key(self):
        return (self.logger, self.culprit, self.checksum)

    def get_score(self):
        return int(math.log(self.times_seen) * 600 + float(time.mktime(self.last_seen.timetuple())))

    def get_latest_event(self):
        if not hasattr(self, '_latest_event'):
            try:
                self._latest_event = self.event_set.order_by('-id')[0]
            except IndexError:
                self._latest_event = None
        return self._latest_event

    @property
    def unique_urls(self):
        return self.messagefiltervalue_set.filter(key='url')\
                   .values_list('value')\
                   .annotate(times_seen=Sum('times_seen'))\
                   .values_list('value', 'times_seen')\
                   .order_by('-times_seen')

    @property
    def unique_servers(self):
        return self.messagefiltervalue_set.filter(key='server_name')\
                   .values_list('value')\
                   .annotate(times_seen=Sum('times_seen'))\
                   .values_list('value', 'times_seen')\
                   .order_by('-times_seen')

    @property
    def unique_sites(self):
        return self.messagefiltervalue_set.filter(key='site')\
                   .values_list('value')\
                   .annotate(times_seen=Sum('times_seen'))\
                   .values_list('value', 'times_seen')\
                   .order_by('-times_seen')

    def get_version(self):
        if not self.data:
            return
        if 'version' not in self.data:
            return
        module = self.data.get('module', 'ver')
        return module, self.data['version']

    @property
    def avg_time_spent(self):
        if not self.time_spent_count:
            return
        return float(self.time_spent_total) / self.time_spent_count


class GroupMeta(Model):
    """
    Arbitrary key/value store for Groups.

    Generally useful for things like storing metadata
    provided by plugins.
    """
    group = models.ForeignKey(Group)
    key = models.CharField(max_length=64)
    value = models.TextField()

    objects = InstanceMetaManager('group')

    class Meta:
        unique_together = (('group', 'key'),)


class Event(MessageBase):
    """
    An individual event.
    """
    group = models.ForeignKey(Group, blank=True, null=True, related_name="event_set")
    event_id = models.CharField(max_length=32, null=True, unique=True, db_column="message_id")
    datetime = models.DateTimeField(default=datetime.now, db_index=True)
    time_spent = models.FloatField(null=True)
    server_name = models.CharField(max_length=128, db_index=True, null=True)
    site = models.CharField(max_length=128, db_index=True, null=True)

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        db_table = 'sentry_message'

    def __unicode__(self):
        return self.error()

    def get_absolute_url(self):
        if self.project_id:
            return reverse('sentry-group-event', kwargs={'group_id': self.group_id, 'event_id': self.pk, 'project_id': self.project_id})
        return '#'

    @cached_property
    def request(self):
        data = self.data
        if 'META' in data:
            kwargs = {
                'META': data.get('META'),
                'GET': data.get('GET'),
                'POST': data.get('POST'),
                'FILES': data.get('FILES'),
                'COOKIES': data.get('COOKIES'),
                'url': data.get('url'),
            }
        elif 'sentry.interfaces.Http' in data:
            http = data['sentry.interfaces.Http']
            kwargs = {
                'META': http
            }
        else:
            return MockDjangoRequest()

        fake_request = MockDjangoRequest(**kwargs)
        if kwargs['url']:
            fake_request.path_info = '/' + kwargs['url'].split('/', 3)[-1]
        else:
            fake_request.path_info = ''
        fake_request.path = fake_request.path_info
        return fake_request

    @cached_property
    def interfaces(self):
        result = []
        for k, v in self.data.iteritems():
            if '.' not in k:
                continue
            m, c = k.rsplit('.', 1)
            cls = getattr(__import__(m, {}, {}, [c]), c)
            v = cls(**v)
            result.append((v.score, k,  v))
        return SortedDict((k, v) for _, k, v in sorted(result, key=lambda x: x[0], reverse=True))

    def get_version(self):
        if not self.data:
            return
        if '__sentry__' not in self.data:
            return
        if 'version' not in self.data['__sentry__']:
            return
        module = self.data['__sentry__'].get('module', 'ver')
        return module, self.data['__sentry__']['version']


class GroupBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an
    aggregated event (Group).
    """
    project = models.ForeignKey(Project, related_name="bookmark_set")  # denormalized
    group = models.ForeignKey(Group, related_name="bookmark_set")
    # namespace related_name on User since we dont own the model
    user = models.ForeignKey(User, related_name="sentry_bookmark_set")

    class Meta:
        # composite index includes project for efficient queries
        unique_together = (('project', 'user', 'group'),)


class FilterValue(Model):
    """
    Stores references to available filters.
    """
    project = models.ForeignKey(Project, null=True)
    key = models.CharField(choices=FILTER_KEYS, max_length=32)
    value = models.CharField(max_length=200)

    class Meta:
        unique_together = (('project', 'key', 'value'),)

    def __unicode__(self):
        return u'key=%s, value=%s' % (self.key, self.value)


class MessageFilterValue(Model):
    """
    Stores the total number of messages seen by a group matching
    the given filter.
    """
    project = models.ForeignKey(Project, null=True)
    group = models.ForeignKey(Group)
    times_seen = models.PositiveIntegerField(default=0)
    key = models.CharField(choices=FILTER_KEYS, max_length=32)
    value = models.CharField(max_length=200)

    class Meta:
        unique_together = (('project', 'key', 'value', 'group'),)

    def __unicode__(self):
        return u'group_id=%s, times_seen=%s, key=%s, value=%s' % (self.group_id, self.times_seen,
                                                                  self.key, self.value)


class MessageCountByMinute(Model):
    """
    Stores the total number of messages seen by a group at N minute intervals.

    e.g. if it happened at 08:34:55 the time would be normalized to 08:30:00
    """

    project = models.ForeignKey(Project, null=True)
    group = models.ForeignKey(Group)
    date = models.DateTimeField()  # normalized to HH:MM:00
    times_seen = models.PositiveIntegerField(default=0)
    time_spent_total = models.FloatField(default=0)
    time_spent_count = models.IntegerField(default=0)

    class Meta:
        unique_together = (('project', 'group', 'date'),)

    def __unicode__(self):
        return u'group_id=%s, times_seen=%s, date=%s' % (self.group_id, self.times_seen, self.date)


class SearchDocument(Model):
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group)
    total_events = models.PositiveIntegerField(default=1)
    status = models.PositiveIntegerField(default=0)
    date_added = models.DateTimeField(default=datetime.now)
    date_changed = models.DateTimeField(default=datetime.now)

    objects = SearchDocumentManager()

    class Meta:
        unique_together = (('project', 'group'),)


class SearchToken(Model):
    document = models.ForeignKey(SearchDocument, related_name="token_set")
    field = models.CharField(max_length=64, default='text')
    token = models.CharField(max_length=128)
    times_seen = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = (('document', 'field', 'token'),)

### django-indexer


class MessageIndex(BaseIndex):
    model = Event

# Import modules to register various things
from . import management
