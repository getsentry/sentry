"""
sentry.models
~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging
import math
import time
import uuid
import urlparse

from datetime import timedelta
from hashlib import md5
from indexer.models import BaseIndex
from picklefield.fields import PickledObjectField
from south.modelsinspector import add_introspection_rules

from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import F, Sum
from django.db.models.signals import (post_syncdb, post_save, pre_delete,
    class_prepared)
from django.template.defaultfilters import slugify
from django.utils import timezone
from django.utils.datastructures import SortedDict
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.constants import (STATUS_LEVELS, MEMBER_TYPES,
    MEMBER_OWNER, MEMBER_USER, PLATFORM_TITLES, PLATFORM_LIST,
    STATUS_VISIBLE, STATUS_HIDDEN)
from sentry.manager import (GroupManager, ProjectManager,
    MetaManager, InstanceMetaManager, SearchDocumentManager, BaseManager,
    UserOptionManager, FilterKeyManager, TeamManager)
from sentry.signals import buffer_incr_complete, regression_signal
from sentry.utils import cached_property, MockDjangoRequest
from sentry.utils.models import Model, GzippedDictField, update
from sentry.utils.imports import import_string
from sentry.utils.strings import truncatechars

__all__ = ('Event', 'Group', 'Project', 'SearchDocument')


def slugify_instance(inst, label, **kwargs):
    base_slug = slugify(label)
    manager = type(inst).objects
    inst.slug = base_slug
    n = 0
    while manager.filter(slug=inst.slug, **kwargs).exists():
        n += 1
        inst.slug = base_slug + '-' + str(n)


def sane_repr(*attrs):
    if 'id' not in attrs and 'pk' not in attrs:
        attrs = ('id',) + attrs

    def _repr(self):
        cls = type(self).__name__

        pairs = ('%s=%s' % (a, repr(getattr(self, a, None)))
            for a in attrs)

        return u'<%s at 0x%x: %s>' % (cls, id(self), ', '.join(pairs))

    return _repr


class Option(Model):
    """
    Global options which apply in most situations as defaults,
    and generally can be overwritten by per-project options.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    key = models.CharField(max_length=64, unique=True)
    value = PickledObjectField()

    objects = MetaManager(cache_fields=[
        'key',
    ])

    __repr__ = sane_repr('key', 'value')


class Team(Model):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=64)
    owner = models.ForeignKey(User)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = TeamManager(cache_fields=(
        'pk',
        'slug',
    ))

    __repr__ = sane_repr('slug', 'owner_id')

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name)
        super(Team, self).save(*args, **kwargs)

    def get_owner_name(self):
        if not self.owner:
            return None
        if self.owner.first_name:
            return self.owner.first_name
        if self.owner.email:
            return self.owner.email.split('@', 1)[0]
        return self.owner.username


class TeamMember(Model):
    """
    Identifies relationships between teams and users.
    """
    team = models.ForeignKey(Team, related_name="member_set")
    user = models.ForeignKey(User, related_name="sentry_teammember_set")
    is_active = models.BooleanField(default=True)
    type = models.IntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        unique_together = (('team', 'user'),)

    __repr__ = sane_repr('team_id', 'user_id', 'type')


class Project(Model):
    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.

    A project may be owned by only a single team, and may or may not
    have an owner (which is thought of as a project creator).
    """
    PLATFORM_CHOICES = tuple(
        (p, PLATFORM_TITLES.get(p, p.title()))
        for p in PLATFORM_LIST
    ) + (('other', 'Other'),)

    slug = models.SlugField(null=True)
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, related_name="sentry_owned_project_set", null=True)
    team = models.ForeignKey(Team, null=True)
    public = models.BooleanField(default=settings.ALLOW_PUBLIC_PROJECTS and settings.PUBLIC)
    date_added = models.DateTimeField(default=timezone.now)
    status = models.PositiveIntegerField(default=0, choices=(
        (STATUS_VISIBLE, 'Visible'),
        (STATUS_HIDDEN, 'Hidden'),
    ), db_index=True)
    platform = models.CharField(max_length=32, choices=PLATFORM_CHOICES, null=True)

    objects = ProjectManager(cache_fields=[
        'pk',
        'slug',
    ])

    class Meta:
        unique_together = (('team', 'slug'),)

    __repr__ = sane_repr('team_id', 'slug', 'owner_id')

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, team=self.team)
        super(Project, self).save(*args, **kwargs)

    def delete(self):
        # This hadles cascades properly
        # TODO: this doesnt clean up the index
        for model in (Event, Group, FilterValue, MessageFilterValue, MessageCountByMinute):
            model.objects.filter(project=self).delete()
        super(Project, self).delete()

    def merge_to(self, project):
        if not isinstance(project, Project):
            project = Project.objects.get_from_cache(pk=project)

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
                            time_spent_count=F('time_spent_count') + obj.time_spent_count,
                        )

        for fv in FilterValue.objects.filter(project=self):
            FilterValue.objects.get_or_create(project=project, key=fv.key, value=fv.value)
            fv.delete()
        self.delete()

    def is_default_project(self):
        return str(self.id) == str(settings.PROJECT) or str(self.slug) == str(settings.PROJECT)

    def get_tags(self):
        if not hasattr(self, '_tag_cache'):
            tags = ProjectOption.objects.get_value(self, 'tags', None)
            if tags is None:
                tags = FilterKey.objects.all_keys(self)
            self._tag_cache = tags
        return self._tag_cache


class ProjectKey(Model):
    project = models.ForeignKey(Project, related_name='key_set')
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)
    user = models.ForeignKey(User, null=True)

    # For audits
    user_added = models.ForeignKey(User, null=True, related_name='keys_added_set')
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = BaseManager(cache_fields=(
        'public_key',
        'secret_key',
    ))

    __repr__ = sane_repr('project_id', 'user_id', 'public_key')

    @classmethod
    def generate_api_key(cls):
        return uuid.uuid4().hex

    def save(self, *args, **kwargs):
        if not self.public_key:
            self.public_key = ProjectKey.generate_api_key()
        if not self.secret_key:
            self.secret_key = ProjectKey.generate_api_key()
        super(ProjectKey, self).save(*args, **kwargs)

    def get_dsn(self, domain=None, secure=True, public=False):
        # TODO: change the DSN to use project slug once clients are compatible
        if not public:
            key = '%s:%s' % (self.public_key, self.secret_key)
        else:
            key = self.public_key

        urlparts = urlparse.urlparse(settings.URL_PREFIX)

        return '%s://%s@%s/%s' % (
            urlparts.scheme,
            key,
            urlparts.netloc + urlparts.path,
            self.project_id,
        )

    @property
    def dsn_private(self):
        return self.get_dsn(public=False)

    @property
    def dsn_public(self):
        return self.get_dsn(public=True)


class ProjectOption(Model):
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    project = models.ForeignKey(Project)
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    objects = InstanceMetaManager('project')

    class Meta:
        db_table = 'sentry_projectoptions'
        unique_together = (('project', 'key',),)

    __repr__ = sane_repr('project_id', 'key', 'value')


class PendingTeamMember(Model):
    """
    Identifies relationships between teams and pending invites.
    """
    team = models.ForeignKey(Team, related_name="pending_member_set")
    email = models.EmailField()
    type = models.IntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        unique_together = (('team', 'email'),)

    __repr__ = sane_repr('team_id', 'email', 'type')

    @property
    def token(self):
        checksum = md5()
        for x in (str(self.team_id), self.email, settings.KEY):
            checksum.update(x)
        return checksum.hexdigest()

    def send_invite_email(self):
        from django.core.mail import send_mail
        from sentry.web.helpers import render_to_string

        context = {
            'email': self.email,
            'team': self.team,
            'url': '%s%s' % (settings.URL_PREFIX, reverse('sentry-accept-invite', kwargs={
                'member_id': self.id,
                'token': self.token,
            })),
        }
        body = render_to_string('sentry/emails/member_invite.txt', context)

        try:
            send_mail('%sInvite to join team: %s' % (settings.EMAIL_SUBJECT_PREFIX, self.team.name),
                body, settings.SERVER_EMAIL, [self.email],
                fail_silently=False)
        except Exception, e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)


class EventBase(Model):
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
    num_comments = models.PositiveIntegerField(default=0, null=True)
    platform = models.CharField(max_length=64, null=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if len(self.logger) > 64:
            self.logger = self.logger[0:61] + u"..."
        super(EventBase, self).save(*args, **kwargs)

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
        return truncatechars(self.message.splitlines()[0], 100)

    @property
    def team(self):
        return self.project.team

    @property
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

        http_data = self.data.get('sentry.interfaces.Http')
        if http_data:
            if 'env' in http_data:
                ident = http_data['env'].get('REMOTE_ADDR')
                if ident:
                    return 'ip:%s' % (ident,)

        return None


class Group(EventBase):
    """
    Aggregated message which summarizes a set of Events.
    """
    status = models.PositiveIntegerField(default=0, choices=STATUS_LEVELS, db_index=True)
    times_seen = models.PositiveIntegerField(default=1, db_index=True)
    users_seen = models.PositiveIntegerField(default=0, db_index=True)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)
    resolved_at = models.DateTimeField(null=True, db_index=True)
    # active_at should be the same as first_seen by default
    active_at = models.DateTimeField(null=True, db_index=True)
    time_spent_total = models.FloatField(default=0)
    time_spent_count = models.IntegerField(default=0)
    score = models.IntegerField(default=0)
    is_public = models.NullBooleanField(default=False, null=True)

    objects = GroupManager()

    class Meta:
        unique_together = (('project', 'checksum'),)
        verbose_name_plural = _('grouped messages')
        verbose_name = _('grouped message')
        permissions = (
            ("can_view", "Can view"),
        )
        db_table = 'sentry_groupedmessage'

    __repr__ = sane_repr('project_id', 'checksum')

    def __unicode__(self):
        return "(%s) %s" % (self.times_seen, self.error())

    def save(self, *args, **kwargs):
        if not self.last_seen:
            self.last_seen = timezone.now()
        if not self.first_seen:
            self.first_seen = self.last_seen
        if not self.active_at:
            self.active_at = self.first_seen
        if self.message:
            # We limit what we store for the message body
            self.message = self.message.splitlines()[0][:255]
        super(Group, self).save(*args, **kwargs)

    @property
    def avg_time_spent(self):
        if not self.time_spent_count:
            return
        return float(self.time_spent_total) / self.time_spent_count

    def natural_key(self):
        return (self.project, self.logger, self.culprit, self.checksum)

    def get_score(self):
        return int(math.log(self.times_seen) * 600 + float(time.mktime(self.last_seen.timetuple())))

    def get_latest_event(self):
        if not hasattr(self, '_latest_event'):
            try:
                self._latest_event = self.event_set.order_by('-datetime')[0]
            except IndexError:
                self._latest_event = None
        return self._latest_event

    def get_version(self):
        if not self.data:
            return
        if 'version' not in self.data:
            return
        module = self.data.get('module', 'ver')
        return module, self.data['version']

    def get_unique_tags(self, tag):
        return self.messagefiltervalue_set.filter(
            key=tag,
        ).values_list(
            'value',
        ).annotate(
            times_seen=Sum('times_seen'),
        ).values_list(
            'value',
            'times_seen',
            'first_seen',
            'last_seen',
        ).order_by('-times_seen')

    def get_tags(self):
        if not hasattr(self, '_tag_cache'):
            tags = sorted(self.messagefiltervalue_set.values_list('key', flat=True).distinct())
            self._tag_cache = tags
        return self._tag_cache


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

    __repr__ = sane_repr('group_id', 'key', 'value')


class Event(EventBase):
    """
    An individual event.
    """
    group = models.ForeignKey(Group, blank=True, null=True, related_name="event_set")
    event_id = models.CharField(max_length=32, null=True, db_column="message_id")
    datetime = models.DateTimeField(default=timezone.now, db_index=True)
    time_spent = models.FloatField(null=True)
    server_name = models.CharField(max_length=128, db_index=True, null=True)
    site = models.CharField(max_length=128, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        db_table = 'sentry_message'
        unique_together = ('project', 'event_id')

    __repr__ = sane_repr('project_id', 'group_id', 'checksum')

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
        for key, data in self.data.iteritems():
            if '.' not in key:
                continue

            try:
                cls = import_string(key)
            except ImportError:
                pass  # suppress invalid interfaces

            value = cls(**data)
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

    def as_dict(self):
        # We use a SortedDict to keep elements ordered for a potential JSON serializer
        data = SortedDict()
        data['id'] = self.event_id
        data['checksum'] = self.checksum
        data['project'] = self.project.slug
        data['logger'] = self.logger
        data['level'] = self.get_level_display()
        data['culprit'] = self.culprit
        for k, v in sorted(self.data.iteritems()):
            data[k] = v
        return data


class GroupBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an
    aggregated event (Group).
    """
    project = models.ForeignKey(Project, related_name="bookmark_set")  # denormalized
    group = models.ForeignKey(Group, related_name="bookmark_set")
    # namespace related_name on User since we dont own the model
    user = models.ForeignKey(User, related_name="sentry_bookmark_set")

    objects = BaseManager()

    class Meta:
        # composite index includes project for efficient queries
        unique_together = (('project', 'user', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id', 'user_id')


class FilterKey(Model):
    """
    Stores references to available filters keys.
    """
    project = models.ForeignKey(Project)
    key = models.CharField(max_length=32)

    objects = FilterKeyManager()

    class Meta:
        unique_together = (('project', 'key'),)

    __repr__ = sane_repr('project_id', 'key')


class FilterValue(Model):
    """
    Stores references to available filters.
    """
    project = models.ForeignKey(Project, null=True)
    key = models.CharField(max_length=32)
    value = models.CharField(max_length=200)

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'key', 'value'),)

    __repr__ = sane_repr('project_id', 'key', 'value')


class MessageFilterValue(Model):
    """
    Stores the total number of messages seen by a group matching
    the given filter.
    """
    project = models.ForeignKey(Project, null=True)
    group = models.ForeignKey(Group)
    times_seen = models.PositiveIntegerField(default=0)
    key = models.CharField(max_length=32)
    value = models.CharField(max_length=200)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'key', 'value', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id', 'key', 'value')

    def save(self, *args, **kwargs):
        if not self.first_seen:
            self.first_seen = self.last_seen
        super(MessageFilterValue, self).save(*args, **kwargs)


class MessageCountByMinute(Model):
    """
    Stores the total number of messages seen by a group at N minute intervals.

    e.g. if it happened at 08:34:55 the time would be normalized to 08:30:00
    """

    project = models.ForeignKey(Project, null=True)
    group = models.ForeignKey(Group)
    date = models.DateTimeField(db_index=True)  # normalized to HH:MM:00
    times_seen = models.PositiveIntegerField(default=0)
    time_spent_total = models.FloatField(default=0)
    time_spent_count = models.IntegerField(default=0)

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'group', 'date'),)

    __repr__ = sane_repr('project_id', 'group_id', 'date')


class ProjectCountByMinute(Model):
    """
    Stores the total number of messages seen by a project at N minute intervals.

    e.g. if it happened at 08:34:55 the time would be normalized to 08:30:00
    """

    project = models.ForeignKey(Project, null=True)
    date = models.DateTimeField()  # normalized to HH:MM:00
    times_seen = models.PositiveIntegerField(default=0)
    time_spent_total = models.FloatField(default=0)
    time_spent_count = models.IntegerField(default=0)

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'date'),)

    __repr__ = sane_repr('project_id', 'date')


class SearchDocument(Model):
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group)
    total_events = models.PositiveIntegerField(default=1)
    status = models.PositiveIntegerField(default=0)
    date_added = models.DateTimeField(default=timezone.now)
    date_changed = models.DateTimeField(default=timezone.now)

    objects = SearchDocumentManager()

    class Meta:
        unique_together = (('project', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id')


class SearchToken(Model):
    document = models.ForeignKey(SearchDocument, related_name="token_set")
    field = models.CharField(max_length=64, default='text')
    token = models.CharField(max_length=128)
    times_seen = models.PositiveIntegerField(default=1)

    objects = BaseManager()

    class Meta:
        unique_together = (('document', 'field', 'token'),)

    __repr__ = sane_repr('document_id', 'field', 'token')


class UserOption(Model):
    """
    User options apply only to a user, and optionally a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    user = models.ForeignKey(User)
    project = models.ForeignKey(Project, null=True)
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    objects = UserOptionManager()

    class Meta:
        unique_together = (('user', 'project', 'key',),)

    __repr__ = sane_repr('user_id', 'project_id', 'key', 'value')


class LostPasswordHash(Model):
    user = models.ForeignKey(User, unique=True)
    hash = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    __repr__ = sane_repr('user_id', 'hash')

    def save(self, *args, **kwargs):
        if not self.hash:
            self.set_hash()
        super(LostPasswordHash, self).save(*args, **kwargs)

    def set_hash(self):
        import hashlib
        import random

        self.hash = hashlib.md5(str(random.randint(1, 10000000))).hexdigest()

    def is_valid(self):
        return self.date_added > timezone.now() - timedelta(days=1)

    def send_recover_mail(self):
        from django.core.mail import send_mail
        from sentry.web.helpers import render_to_string

        context = {
            'user': self.user,
            'domain': urlparse.urlparse(settings.URL_PREFIX).hostname,
            'url': '%s%s' % (settings.URL_PREFIX,
                reverse('sentry-account-recover-confirm', args=[self.user.id, self.hash])),
        }
        body = render_to_string('sentry/emails/recover_account.txt', context)

        try:
            send_mail('%sPassword Recovery' % (settings.EMAIL_SUBJECT_PREFIX,),
                body, settings.SERVER_EMAIL, [self.user.email],
                fail_silently=False)
        except Exception, e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)


class TrackedUser(Model):
    project = models.ForeignKey(Project)
    ident = models.CharField(max_length=200)
    email = models.EmailField(null=True)
    data = GzippedDictField(blank=True, null=True)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)
    num_events = models.PositiveIntegerField(default=0)
    groups = models.ManyToManyField(Group, through='sentry.AffectedUserByGroup')

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'ident'),)

    __repr__ = sane_repr('project_id', 'ident', 'email')


class AffectedUserByGroup(Model):
    """
    Stores a count of how many times a ``Group`` has affected
    a user.
    """
    project = models.ForeignKey(Project)
    tuser = models.ForeignKey(TrackedUser, null=True)
    group = models.ForeignKey(Group)
    ident = models.CharField(max_length=200, null=True)
    times_seen = models.PositiveIntegerField(default=0)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'tuser', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id', 'tuser_id')


class Activity(Model):
    COMMENT = 0
    SET_RESOLVED = 1
    SET_UNRESOLVED = 2
    SET_MUTED = 3
    SET_PUBLIC = 4
    SET_PRIVATE = 5
    SET_REGRESSION = 6

    TYPE = (
        # (TYPE, verb-slug)
        (COMMENT, 'comment'),
        (SET_RESOLVED, 'set_resolved'),
        (SET_UNRESOLVED, 'set_unresolved'),
        (SET_MUTED, 'set_muted'),
        (SET_PUBLIC, 'set_public'),
        (SET_PRIVATE, 'set_private'),
        (SET_REGRESSION, 'set_regression'),
    )

    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group, null=True)
    event = models.ForeignKey(Event, null=True)
    # index on (type, ident)
    type = models.PositiveIntegerField(choices=TYPE)
    ident = models.CharField(max_length=64, null=True)
    # if the user is not set, it's assumed to be the system
    user = models.ForeignKey(User, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    data = GzippedDictField(null=True)

    __repr__ = sane_repr('project_id', 'group_id', 'event_id', 'user_id', 'type', 'ident')

    def save(self, *args, **kwargs):
        created = bool(not self.id)

        super(Activity, self).save(*args, **kwargs)

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == Activity.COMMENT:
            self.group.update(num_comments=F('num_comments') + 1)

            if self.event:
                self.event.update(num_comments=F('num_comments') + 1)


### django-indexer


class MessageIndex(BaseIndex):
    model = Event


## Register Signals

def register_indexes(**kwargs):
    """
    Grabs all required indexes from filters and registers them.
    """
    from sentry.filters import get_filters
    logger = logging.getLogger('sentry.setup')
    for cls in (f for f in get_filters() if f.column.startswith('data__')):
        MessageIndex.objects.register_index(cls.column, index_to='group')
        logger.debug('Registered index for for %r', cls.column)
class_prepared.connect(register_indexes, sender=MessageIndex)


def create_default_project(created_models, verbosity=2, **kwargs):
    if Project in created_models:
        if Project.objects.filter(pk=settings.PROJECT).exists():
            return

        project = Project.objects.create(
            public=settings.ALLOW_PUBLIC_PROJECTS and settings.PUBLIC,
            name='Sentry (Internal)',
            slug='sentry',
        )
        # default key (used by sentry-js client, etc)
        ProjectKey.objects.create(
            project=project,
        )

        if verbosity > 0:
            print 'Created internal Sentry project (slug=%s, id=%s)' % (project.slug, project.id)

        # Iterate all groups to update their relations
        for model in (Group, Event, FilterValue, MessageFilterValue,
                      MessageCountByMinute):
            if verbosity > 0:
                print ('Backfilling project ids for %s.. ' % model),
            model.objects.filter(project__isnull=True).update(
                project=project,
            )
            if verbosity > 0:
                print 'done!'


def create_team_and_keys_for_project(instance, created, **kwargs):
    if not created or kwargs.get('raw'):
        return

    if not instance.owner:
        return

    if not instance.team:
        update(instance, team=Team.objects.create(
            owner=instance.owner,
            name=instance.name,
            slug=instance.slug,
        ))

        ProjectKey.objects.get_or_create(
            project=instance,
            user=instance.owner,
        )
    else:
        for member in instance.team.member_set.all():
            ProjectKey.objects.get_or_create(
                project=instance,
                user=member.user,
            )


def create_team_member_for_owner(instance, created, **kwargs):
    if not created:
        return

    if not instance.owner:
        return

    instance.member_set.get_or_create(
        user=instance.owner,
        type=MEMBER_OWNER,
    )


def update_document(instance, created, **kwargs):
    if created:
        return

    SearchDocument.objects.filter(
        project=instance.project,
        group=instance,
    ).update(status=instance.status)


def create_key_for_team_member(instance, created, **kwargs):
    if not created or kwargs.get('raw'):
        return

    for project in instance.team.project_set.all():
        ProjectKey.objects.get_or_create(
            project=project,
            user=instance.user,
        )


def remove_key_for_team_member(instance, **kwargs):
    for project in instance.team.project_set.all():
        ProjectKey.objects.filter(
            project=project,
            user=instance.user,
        ).delete()


# Set user language if set
def set_language_on_logon(request, user, **kwargs):
    language = UserOption.objects.get_value(
        user=user,
        project=None,
        key='language',
        default=None,
    )
    if language and hasattr(request, 'session'):
        request.session['django_language'] = language


@buffer_incr_complete.connect(sender=AffectedUserByGroup, weak=False)
def record_user_count(filters, created, **kwargs):
    from sentry import app

    if not created:
        # if it's not a new row, it's not a unique user
        return

    app.buffer.incr(Group, {
        'users_seen': 1,
    }, {
        'id': filters['group'].id,
    })


@regression_signal.connect(weak=False)
def create_regression_activity(instance, **kwargs):
    if instance.times_seen == 1:
        # this event is new
        return
    Activity.objects.create(
        project=instance.project,
        group=instance,
        type=Activity.SET_REGRESSION,
    )


# Signal registration
post_syncdb.connect(
    create_default_project,
    dispatch_uid="create_default_project",
    weak=False,
)
post_save.connect(
    create_team_and_keys_for_project,
    sender=Project,
    dispatch_uid="create_team_and_keys_for_project",
    weak=False,
)
post_save.connect(
    create_team_member_for_owner,
    sender=Team,
    dispatch_uid="create_team_member_for_owner",
    weak=False,
)
post_save.connect(
    update_document,
    sender=Group,
    dispatch_uid="update_document",
    weak=False,
)
post_save.connect(
    create_key_for_team_member,
    sender=TeamMember,
    dispatch_uid="create_key_for_team_member",
    weak=False,
)
pre_delete.connect(
    remove_key_for_team_member,
    sender=TeamMember,
    dispatch_uid="remove_key_for_team_member",
    weak=False,
)
user_logged_in.connect(
    set_language_on_logon,
    dispatch_uid="set_language_on_logon",
    weak=False
)

add_introspection_rules([], ["^social_auth\.fields\.JSONField"])
