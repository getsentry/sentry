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
from datetime import datetime
from hashlib import md5
from indexer.models import BaseIndex
from picklefield.fields import PickledObjectField

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import F
from django.db.models.signals import post_syncdb, post_save, pre_delete, \
  class_prepared
from django.template.defaultfilters import slugify
from django.utils.datastructures import SortedDict
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.manager import GroupManager, ProjectManager, \
  MetaManager, InstanceMetaManager, SearchDocumentManager, BaseManager
from sentry.utils import cached_property, \
  MockDjangoRequest
from sentry.utils.models import Model, GzippedDictField, update
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
    value = PickledObjectField()

    objects = MetaManager(cache_fields=[
        'key',
    ])


class Team(Model):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=64)
    owner = models.ForeignKey(User)

    objects = BaseManager(cache_fields=(
        'pk',
        'slug',
    ))

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super(Team, self).save(*args, **kwargs)


class TeamMember(Model):
    """
    Identifies relationships between teams and users.
    """
    team = models.ForeignKey(Team, related_name="member_set")
    user = models.ForeignKey(User, related_name="sentry_teammember_set")
    is_active = models.BooleanField(default=True)
    type = models.IntegerField(choices=MEMBER_TYPES, default=globals().get(settings.DEFAULT_PROJECT_ACCESS))
    date_added = models.DateTimeField(default=datetime.now)

    objects = BaseManager()

    class Meta:
        unique_together = (('team', 'user'),)

    def __unicode__(self):
        return u'team=%s, user=%s, type=%s' % (self.team_id, self.user_id, self.get_type_display())


class Project(Model):
    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.

    A project may be owned by only a single team, and may or may not
    have an owner (which is thought of as a project creator).
    """
    slug = models.SlugField(unique=True, null=True)
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, related_name="sentry_owned_project_set", null=True)
    team = models.ForeignKey(Team, null=True)
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=datetime.now)
    status = models.PositiveIntegerField(default=0, choices=(
        (0, 'Visible'),
        (1, 'Hidden'),
    ), db_index=True)

    objects = ProjectManager(cache_fields=[
        'pk',
        'slug',
    ])

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
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


class ProjectKey(Model):
    project = models.ForeignKey(Project, related_name='key_set')
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)
    user = models.ForeignKey(User, null=True)

    objects = BaseManager(cache_fields=(
        'public_key',
        'secret_key',
    ))

    def __unicode__(self):
        return u'project=%s, user=%s' % (self.project_id, self.user_id)

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

    def __unicode__(self):
        return u'project=%s, key=%s, value=%s' % (self.project_id, self.key, self.value)


class PendingTeamMember(Model):
    """
    Identifies relationships between teams and pending invites.
    """
    team = models.ForeignKey(Team, related_name="pending_member_set")
    email = models.EmailField()
    type = models.IntegerField(choices=MEMBER_TYPES, default=globals().get(settings.DEFAULT_PROJECT_ACCESS))
    date_added = models.DateTimeField(default=datetime.now)

    class Meta:
        unique_together = (('team', 'email'),)

    def __unicode__(self):
        return u'team=%s, email=%s, type=%s' % (self.team_id, self.email, self.get_type_display())

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
            send_mail('%s Invite to join team: %s' % (settings.EMAIL_SUBJECT_PREFIX, self.team.name),
                body, settings.SERVER_EMAIL, [self.email],
                fail_silently=False)
        except Exception, e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)


class View(Model):
    """
    A view ties directly to a view extension and simply
    identifies it at the db level.
    """
    path = models.CharField(max_length=100, unique=True)
    verbose_name = models.CharField(max_length=200, null=True)
    verbose_name_plural = models.CharField(max_length=200, null=True)

    objects = BaseManager(cache_fields=[
        'path',
    ])

    def __unicode__(self):
        return self.path


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
            return reverse('sentry-group', kwargs={'group_id': self.pk, 'project_id': self.project.slug})
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
    event_id = models.CharField(max_length=32, null=True, db_column="message_id")
    datetime = models.DateTimeField(default=datetime.now, db_index=True)
    time_spent = models.FloatField(null=True)
    server_name = models.CharField(max_length=128, db_index=True, null=True)
    site = models.CharField(max_length=128, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        db_table = 'sentry_message'
        unique_together = ('project', 'event_id')

    def __unicode__(self):
        return self.error()

    def get_absolute_url(self):
        if self.project_id:
            return reverse('sentry-group-event', kwargs={'group_id': self.group_id, 'event_id': self.pk, 'project_id': self.project.slug})
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
            result.append((v.score, k, v))
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


class FilterValue(Model):
    """
    Stores references to available filters.
    """
    project = models.ForeignKey(Project, null=True)
    key = models.CharField(choices=FILTER_KEYS, max_length=32)
    value = models.CharField(max_length=200)

    objects = BaseManager()

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
    last_seen = models.DateTimeField(default=datetime.now, db_index=True, null=True)
    first_seen = models.DateTimeField(default=datetime.now, db_index=True, null=True)

    objects = BaseManager()

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

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'group', 'date'),)

    def __unicode__(self):
        return u'group_id=%s, times_seen=%s, date=%s' % (self.group_id, self.times_seen, self.date)


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

    objects = BaseManager()

    class Meta:
        unique_together = (('document', 'field', 'token'),)

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
        logger.debug('Registered index for for %r' % cls.column)
class_prepared.connect(register_indexes, sender=MessageIndex)


def create_default_project(created_models, verbosity=2, **kwargs):
    if Project in created_models:
        try:
            owner = User.objects.filter(is_staff=True, is_superuser=True).order_by('id')[0]
        except IndexError:
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

        if verbosity > 0:
            print 'Created default Sentry project owned by %s' % owner

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
    if not created:
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
        type=globals()[settings.DEFAULT_PROJECT_ACCESS]
    )


def update_document(instance, created, **kwargs):
    if created:
        return

    SearchDocument.objects.filter(
        project=instance.project,
        group=instance,
    ).update(status=instance.status)


def create_key_for_team_member(instance, created, **kwargs):
    if not created:
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
