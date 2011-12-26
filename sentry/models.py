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
from bitfield import BitField
from datetime import datetime
from indexer.models import BaseIndex


from django.contrib.auth.models import User
from django.db import models
from django.db.models import Sum
from django.db.models.signals import post_syncdb
from django.utils.datastructures import SortedDict
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.utils import cached_property, \
                         MockDjangoRequest
from sentry.utils.models import Model, GzippedDictField
from sentry.utils.manager import GroupManager
from sentry.templatetags.sentry_helpers import truncatechars

__all__ = ('Event', 'Group')

STATUS_LEVELS = (
    (0, _('unresolved')),
    (1, _('resolved')),
)

# These are predefined builtin's
FILTER_KEYS = (
    ('server_name', _('server name')),
    ('logger', _('logger')),
    ('site', _('site')),
)

PERMISSIONS = (
    ('read_message', 'View events'),
    ('change_message_status', 'Change event status'),
    ('add_member', 'Add project members'),
    ('change_member', 'Change project members'),
    ('delete_member', 'Delete project members'),
    ('add_message', 'Store new events'),
)
PERMISSIONS_DICT = dict(PERMISSIONS)


class Project(Model):
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, related_name="owned_project_set", null=True)
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=datetime.now)


class ProjectMember(Model):
    project = models.ForeignKey(Project, related_name="member_set")
    user = models.ForeignKey(User, related_name="project_set")
    is_superuser = models.BooleanField(default=False)
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)
    permissions = BitField(flags=[p[0] for p in PERMISSIONS])
    date_added = models.DateTimeField(default=datetime.now)

    class Meta:
        unique_together = (('project', 'user'),)

    def save(self, *args, **kwargs):
        if not self.public_key:
            self.public_key = ProjectMember.generate_api_key()
        if not self.secret_key:
            self.secret_key = ProjectMember.generate_api_key()
        super(ProjectMember, self).save(*args, **kwargs)

    def has_perm(self, flag):
        if self.is_superuser:
            return True
        return getattr(self.permissions, flag, False)

    @classmethod
    def generate_api_key(cls):
        return uuid.uuid4().hex


class ProjectDomain(Model):
    project = models.ForeignKey(Project, related_name="domain_set")
    domain = models.CharField(max_length=128)

    class Meta:
        unique_together = (('project', 'domain'),)


class MessageBase(Model):
    project = models.ForeignKey(Project, null=True)
    logger = models.CharField(max_length=64, blank=True, default='root', db_index=True)
    level = models.PositiveIntegerField(choices=settings.LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
    message = models.TextField()
    culprit = models.CharField(max_length=200, blank=True, null=True, db_column='view')
    checksum = models.CharField(max_length=32, db_index=True)
    data = GzippedDictField(blank=True, null=True)

    class Meta:
        abstract = True

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
    status = models.PositiveIntegerField(default=0, choices=STATUS_LEVELS, db_index=True)
    times_seen = models.PositiveIntegerField(default=1, db_index=True)
    last_seen = models.DateTimeField(default=datetime.now, db_index=True)
    first_seen = models.DateTimeField(default=datetime.now, db_index=True)
    time_spent_total = models.FloatField(default=0)
    time_spent_count = models.IntegerField(default=0)
    score = models.IntegerField(default=0)

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

    @models.permalink
    def get_absolute_url(self):
        if self.project_id:
            return ('sentry-group', [], {'group_id': self.pk, 'project_id': self.project_id})
        return ('sentry-group', [], {'group_id': self.pk})

    def natural_key(self):
        return (self.logger, self.culprit, self.checksum)

    def get_score(self):
        return int(math.log(self.times_seen) * 600 + float(time.mktime(self.last_seen.timetuple())))

    def get_latest_event(self):
        return self.event_set.order_by('-id')[0]

    def mail_admins(self, request=None, fail_silently=True):
        from django.core.mail import send_mail
        from django.template.loader import render_to_string

        if not settings.ADMINS:
            return

        event = self.get_latest_event()

        interfaces = event.interfaces

        if 'sentry.interfaces.Exception' in interfaces:
            traceback = interfaces['sentry.interfaces.Exception'].to_string(event)
        else:
            traceback = None

        http = interfaces.get('sentry.interfaces.Http')

        if http:
            ip_repr = (http.env.get('REMOTE_ADDR') in settings.INTERNAL_IPS and 'internal' or 'EXTERNAL')
            subject = '%sError (%s IP): %s' % (settings.EMAIL_SUBJECT_PREFIX, ip_repr, http.url)
        else:
            subject = '%sError: %s' % (settings.EMAIL_SUBJECT_PREFIX, event.message)

        if event.site:
            subject = '[%s] %s' % (event.site, subject)

        if request:
            link = request.build_absolute_url(self.get_absolute_url())
        else:
            link = '%s%s' % (settings.URL_PREFIX, self.get_absolute_url())

        body = render_to_string('sentry/emails/error.txt', {
            'traceback': traceback,
            'group': self,
            'event': event,
            'link': link,
        })

        send_mail(subject, body,
                  settings.SERVER_EMAIL, settings.ADMINS,
                  fail_silently=fail_silently)

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


class Event(MessageBase):
    event_id = models.CharField(max_length=32, null=True, unique=True, db_column="message_id")
    group = models.ForeignKey(Group, blank=True, null=True, related_name="event_set")
    datetime = models.DateTimeField(default=datetime.now, db_index=True)
    time_spent = models.FloatField(null=True)
    server_name = models.CharField(max_length=128, db_index=True)
    site = models.CharField(max_length=128, db_index=True, null=True)

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        db_table = 'sentry_message'

    def __unicode__(self):
        return self.error()

    @models.permalink
    def get_absolute_url(self):
        if self.project_id:
            return ('sentry-group-event', [], {'group_id': self.group_id, 'event_id': self.pk, 'project_id': self.project_id})
        return ('sentry-group-event', [], {'group_id': self.group_id, 'event_id': self.pk})

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


class FilterValue(models.Model):
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


class MessageFilterValue(models.Model):
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
    Stores the total number of messages seen by a group at 5 minute intervals

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


### django-indexer

class MessageIndex(BaseIndex):
    model = Event

### Helper methods

# This comes later due to recursive imports
from sentry.utils import get_filters


def register_indexes():
    """
    Grabs all required indexes from filters and registers them.
    """
    logger = logging.getLogger('sentry.setup')
    for filter_ in get_filters():
        if filter_.column.startswith('data__'):
            MessageIndex.objects.register_index(filter_.column, index_to='group')
            logger.debug('Registered index for for %s' % filter_.column)
register_indexes()


def create_default_project(created_models, verbosity=2, **kwargs):
    if Project in created_models:
        try:
            owner = User.objects.filter(is_staff=True, is_superuser=True).order_by('id').get()
        except User.DoesNotExist:
            owner = None

        project, created = Project.objects.get_or_create(
            id=1,
            defaults=dict(
                public=True,
                name='Default',
                owner=owner,
            )
        )
        if not created:
            return

        if owner:
            ProjectMember.objects.create(
                project=project,
                user=owner,
                is_superuser=True,
            )

        if verbosity > 0:
            print 'Created default Sentry project owned by %s' % owner

post_syncdb.connect(create_default_project)
