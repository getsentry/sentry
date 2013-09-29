"""
sentry.models
~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging
import math
import time
import uuid
import urlparse
from pkg_resources import parse_version as Version

from datetime import timedelta
from hashlib import md5
from picklefield.fields import PickledObjectField
from south.modelsinspector import add_introspection_rules

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.signals import user_logged_in
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import F
from django.db.models.signals import post_syncdb, post_save, pre_delete
from django.template.defaultfilters import slugify
from django.utils import timezone
from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext_lazy as _

from sentry.constants import (
    STATUS_LEVELS, MEMBER_TYPES,
    MEMBER_OWNER, MEMBER_USER, PLATFORM_TITLES, PLATFORM_LIST,
    STATUS_UNRESOLVED, STATUS_RESOLVED, STATUS_VISIBLE, STATUS_HIDDEN,
    MINUTE_NORMALIZATION, STATUS_MUTED, RESERVED_TEAM_SLUGS,
    LOG_LEVELS, MAX_CULPRIT_LENGTH, MAX_TAG_KEY_LENGTH, MAX_TAG_VALUE_LENGTH)
from sentry.db.models import (
    Model, GzippedDictField, BoundedIntegerField, BoundedPositiveIntegerField,
    update, sane_repr)
from sentry.manager import (
    GroupManager, ProjectManager,
    MetaManager, InstanceMetaManager, SearchDocumentManager, BaseManager,
    UserOptionManager, TagKeyManager, TeamManager, UserManager)
from sentry.signals import buffer_incr_complete, regression_signal
from sentry.utils.cache import memoize
from sentry.utils.db import has_trending
from sentry.utils.http import absolute_uri
from sentry.utils.imports import import_string
from sentry.utils.safe import safe_execute
from sentry.utils.strings import truncatechars, strip

__all__ = ('Event', 'Group', 'Project', 'SearchDocument')


def slugify_instance(inst, label, reserved=(), **kwargs):
    base_slug = slugify(label)
    if base_slug in reserved:
        base_slug = None
    if not base_slug:
        base_slug = uuid.uuid4().hex[:12]
    manager = type(inst).objects
    inst.slug = base_slug
    n = 0
    while manager.filter(slug__iexact=inst.slug, **kwargs).exists():
        n += 1
        inst.slug = base_slug + '-' + str(n)


class User(Model, AbstractUser):
    class Meta:
        db_table = 'auth_user'
        app_label = 'auth'

    def merge_to(from_user, to_user):
        # TODO: we could discover relations automatically and make this useful
        from sentry.models import (
            GroupBookmark, Project, ProjectKey, Team, TeamMember, UserOption)

        for obj in ProjectKey.objects.filter(user=from_user):
            obj.update(user=to_user)
        for obj in TeamMember.objects.filter(user=from_user):
            obj.update(user=to_user)
        for obj in Project.objects.filter(owner=from_user):
            obj.update(owner=to_user)
        for obj in Team.objects.filter(owner=from_user):
            obj.update(owner=to_user)
        for obj in GroupBookmark.objects.filter(user=from_user):
            obj.update(user=to_user)
        for obj in UserOption.objects.filter(user=from_user):
            obj.update(user=to_user)


User.add_to_class('objects', UserManager(cache_fields=['pk']))


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
    owner = models.ForeignKey(settings.AUTH_USER_MODEL)
    date_added = models.DateTimeField(default=timezone.now, null=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, through='sentry.TeamMember', related_name='team_memberships')

    objects = TeamManager(cache_fields=(
        'pk',
        'slug',
    ))

    __repr__ = sane_repr('slug', 'owner_id', 'name')

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, reserved=RESERVED_TEAM_SLUGS)
        super(Team, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry', args=[
            self.slug]))

    def get_owner_name(self):
        if not self.owner:
            return None
        if self.owner.first_name:
            return self.owner.first_name
        if self.owner.email:
            return self.owner.email.split('@', 1)[0]
        return self.owner.username


class AccessGroup(Model):
    """
    An access group identifies a set of members with a defined set
    of permissions (and project access) for a Team.

    Groups may be automated through extensions (such as LDAP) so that
    membership is automatically maintained. If this is the case the
    ``managed`` attribute will be ``True``.
    """
    team = models.ForeignKey(Team)
    name = models.CharField(max_length=64)
    type = BoundedIntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
    managed = models.BooleanField(default=False)
    data = GzippedDictField(blank=True, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    projects = models.ManyToManyField('sentry.Project')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL)

    objects = BaseManager()

    class Meta:
        unique_together = (('team', 'name'),)

    __repr__ = sane_repr('team_id', 'name', 'type', 'managed')


class TeamMember(Model):
    """
    Identifies relationships between teams and users.

    Users listed as team members are considered to have access to all projects
    and could be thought of as team owners (though their access level may not)
    be set to ownership.
    """
    team = models.ForeignKey(Team, related_name="member_set")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_teammember_set")
    type = BoundedIntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
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
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_owned_project_set", null=True)
    team = models.ForeignKey(Team, null=True)
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(default=0, choices=(
        (STATUS_VISIBLE, _('Visible')),
        (STATUS_HIDDEN, _('Hidden')),
    ), db_index=True)
    platform = models.CharField(max_length=32, choices=PLATFORM_CHOICES, null=True)

    objects = ProjectManager(cache_fields=[
        'pk',
        'slug',
    ])

    class Meta:
        unique_together = (('team', 'slug'),)

    __repr__ = sane_repr('team_id', 'slug', 'owner_id')

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, team=self.team)
        super(Project, self).save(*args, **kwargs)

    def delete(self):
        # This handles cascades properly
        # TODO: this doesn't clean up the index
        for model in (
                TagKey, TagValue, GroupTagKey, GroupTag, GroupCountByMinute,
                ProjectCountByMinute, Activity, EventMapping, Event, Group):
            logging.info('Removing %r objects where project=%s', model, self.id)
            has_results = True
            while has_results:
                has_results = False
                for obj in model.objects.filter(project=self)[:1000]:
                    obj.delete()
                    has_results = True
        super(Project, self).delete()

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry-stream', args=[
            self.team.slug, self.slug]))

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
                for model in (Event, GroupTag, GroupCountByMinute):
                    model.objects.filter(project=self, group=group).update(project=project)
            else:
                Event.objects.filter(group=group).update(group=other)

                for obj in GroupTag.objects.filter(group=group):
                    obj2, created = GroupTag.objects.get_or_create(
                        project=project,
                        group=group,
                        key=obj.key,
                        value=obj.value,
                        defaults={'times_seen': obj.times_seen}
                    )
                    if not created:
                        obj2.update(times_seen=F('times_seen') + obj.times_seen)

                for obj in GroupCountByMinute.objects.filter(group=group):
                    obj2, created = GroupCountByMinute.objects.get_or_create(
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

        for fv in TagValue.objects.filter(project=self):
            TagValue.objects.get_or_create(project=project, key=fv.key, value=fv.value)
            fv.delete()
        self.delete()

    def is_default_project(self):
        return str(self.id) == str(settings.SENTRY_PROJECT) or str(self.slug) == str(settings.SENTRY_PROJECT)

    def get_tags(self):
        if not hasattr(self, '_tag_cache'):
            tags = ProjectOption.objects.get_value(self, 'tags', None)
            if tags is None:
                tags = TagKey.objects.all_keys(self)
            self._tag_cache = [
                t for t in tags
                if not t.startswith('sentry:')
            ]
        return self._tag_cache

    # TODO: Make these a mixin
    def update_option(self, *args, **kwargs):
        return ProjectOption.objects.set_value(self, *args, **kwargs)

    def get_option(self, *args, **kwargs):
        return ProjectOption.objects.get_value(self, *args, **kwargs)


class ProjectKey(Model):
    project = models.ForeignKey(Project, related_name='key_set')
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True)

    # For audits
    user_added = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, related_name='keys_added_set')
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = BaseManager(cache_fields=(
        'public_key',
        'secret_key',
    ))

    __repr__ = sane_repr('project_id', 'user_id', 'public_key')

    def __unicode__(self):
        return unicode(self.public_key)

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
            url = settings.SENTRY_ENDPOINT
        else:
            key = self.public_key
            url = settings.SENTRY_PUBLIC_ENDPOINT

        urlparts = urlparse.urlparse(url or settings.SENTRY_URL_PREFIX)

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
    type = BoundedIntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        unique_together = (('team', 'email'),)

    __repr__ = sane_repr('team_id', 'email', 'type')

    @property
    def token(self):
        checksum = md5()
        for x in (str(self.team_id), self.email, settings.SECRET_KEY):
            checksum.update(x)
        return checksum.hexdigest()

    def send_invite_email(self):
        from django.core.mail import send_mail
        from sentry.web.helpers import render_to_string

        context = {
            'email': self.email,
            'team': self.team,
            'url': absolute_uri(reverse('sentry-accept-invite', kwargs={
                'member_id': self.id,
                'token': self.token,
            })),
        }
        body = render_to_string('sentry/emails/member_invite.txt', context)

        try:
            send_mail(
                '%sInvite to join team: %s' % (
                    settings.EMAIL_SUBJECT_PREFIX, self.team.name
                ),
                body, settings.SERVER_EMAIL, [self.email],
                fail_silently=False
            )
        except Exception, e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)


class EventBase(Model):
    """
    Abstract base class for both Event and Group.
    """
    project = models.ForeignKey(Project, null=True)
    logger = models.CharField(
        max_length=64, blank=True, default='root', db_index=True)
    level = BoundedPositiveIntegerField(
        choices=LOG_LEVELS.items(), default=logging.ERROR, blank=True,
        db_index=True)
    message = models.TextField()
    culprit = models.CharField(
        max_length=MAX_CULPRIT_LENGTH, blank=True, null=True,
        db_column='view')
    checksum = models.CharField(max_length=32, db_index=True)
    data = GzippedDictField(blank=True, null=True)
    num_comments = BoundedPositiveIntegerField(default=0, null=True)
    platform = models.CharField(max_length=64, null=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if len(self.logger) > 64:
            self.logger = self.logger[0:61] + u"..."
        super(EventBase, self).save(*args, **kwargs)

    def error(self):
        message = strip(self.message)
        if message:
            message = truncatechars(message, 100)
        else:
            message = '<unlabeled message>'
        return message
    error.short_description = _('error')

    def has_two_part_message(self):
        message = strip(self.message)
        return '\n' in message or len(message) > 100

    def message_top(self):
        culprit = strip(self.culprit)
        if culprit:
            return culprit
        message = strip(self.message)
        if not strip(message):
            return '<unlabeled message>'
        return truncatechars(message.splitlines()[0], 100)

    @property
    def team(self):
        return self.project.team

    @property
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

        ident = self.ip_address
        if ident:
            return 'ip:%s' % (ident,)

        return None


class Group(EventBase):
    """
    Aggregated message which summarizes a set of Events.
    """
    status = BoundedPositiveIntegerField(
        default=0, choices=STATUS_LEVELS, db_index=True)
    times_seen = BoundedPositiveIntegerField(default=1, db_index=True)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)
    resolved_at = models.DateTimeField(null=True, db_index=True)
    # active_at should be the same as first_seen by default
    active_at = models.DateTimeField(null=True, db_index=True)
    time_spent_total = BoundedIntegerField(default=0)
    time_spent_count = BoundedIntegerField(default=0)
    score = BoundedIntegerField(default=0)
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

    def delete(self):
        model_list = (
            GroupTagKey, GroupTag, GroupCountByMinute, EventMapping, Event
        )
        for model in model_list:
            logging.info('Removing %r objects where group=%s', model, self.id)
            has_results = True
            while has_results:
                has_results = False
                for obj in model.objects.filter(group=self)[:1000]:
                    obj.delete()
                    has_results = True
        super(Group, self).delete()

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry-group', args=[
            self.team.slug, self.project.slug, self.id]))

    @property
    def avg_time_spent(self):
        if not self.time_spent_count:
            return
        return float(self.time_spent_total) / self.time_spent_count

    def natural_key(self):
        return (self.project, self.logger, self.culprit, self.checksum)

    def is_over_resolve_age(self):
        resolve_age = self.project.get_option('sentry:resolve_age', None)
        if not resolve_age:
            return False
        return self.last_seen < timezone.now() - timedelta(hours=int(resolve_age))

    def is_muted(self):
        return self.get_status() == STATUS_MUTED

    def is_resolved(self):
        return self.get_status() == STATUS_RESOLVED

    def get_status(self):
        if self.status == STATUS_UNRESOLVED and self.is_over_resolve_age():
            return STATUS_RESOLVED
        return self.status

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
        return self.grouptag_set.filter(
            project=self.project,
            key=tag,
        ).values_list(
            'value',
            'times_seen',
            'first_seen',
            'last_seen',
        ).order_by('-times_seen')

    def get_tags(self):
        if not hasattr(self, '_tag_cache'):
            self._tag_cache = sorted([
                t for t in self.grouptagkey_set.filter(
                    project=self.project,
                ).values_list('key', flat=True)
                if not t.startswith('sentry:')
            ])
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
    time_spent = BoundedIntegerField(null=True)
    server_name = models.CharField(max_length=128, db_index=True, null=True)
    site = models.CharField(max_length=128, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        db_table = 'sentry_message'
        unique_together = ('project', 'event_id')

    __repr__ = sane_repr('project_id', 'group_id', 'checksum')

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
        data['logger'] = self.logger
        data['level'] = self.get_level_display()
        data['culprit'] = self.culprit
        for k, v in sorted(self.data.iteritems()):
            data[k] = v
        return data

    @property
    def size(self):
        return len(unicode(vars(self)))


class EventMapping(Model):
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group)
    event_id = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = (('project', 'event_id'),)

    __repr__ = sane_repr('project_id', 'group_id', 'event_id')

    @property
    def team(self):
        return self.project.team


class GroupBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an
    aggregated event (Group).
    """
    project = models.ForeignKey(Project, related_name="bookmark_set")  # denormalized
    group = models.ForeignKey(Group, related_name="bookmark_set")
    # namespace related_name on User since we don't own the model
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_bookmark_set")

    objects = BaseManager()

    class Meta:
        # composite index includes project for efficient queries
        unique_together = (('project', 'user', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id', 'user_id')


class TagKey(Model):
    """
    Stores references to available filters keys.
    """
    project = models.ForeignKey(Project)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)
    label = models.CharField(max_length=64, null=True)

    objects = TagKeyManager()

    class Meta:
        db_table = 'sentry_filterkey'
        unique_together = (('project', 'key'),)

    __repr__ = sane_repr('project_id', 'key')

    def get_label(self):
        return self.label or self.key.replace('_', ' ').title()


class TagValue(Model):
    """
    Stores references to available filters.
    """
    project = models.ForeignKey(Project, null=True)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    data = GzippedDictField(blank=True, null=True)
    times_seen = BoundedPositiveIntegerField(default=0)
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        db_table = 'sentry_filtervalue'
        unique_together = (('project', 'key', 'value'),)

    __repr__ = sane_repr('project_id', 'key', 'value')

FilterKey = TagKey
FilterValue = TagValue


class GroupTagKey(Model):
    """
    Stores a unique tag key name for a group.

    An example key might be "url" or "server_name".
    """
    project = models.ForeignKey(Project, null=True)
    group = models.ForeignKey(Group)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    values_seen = BoundedPositiveIntegerField(default=0)

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'group', 'key'),)

    __repr__ = sane_repr('project_id', 'group_id', 'key')


class GroupTag(Model):
    """
    Stores the total number of messages seen by a group matching
    the given filter.
    """
    project = models.ForeignKey(Project, null=True)
    group = models.ForeignKey(Group)
    times_seen = BoundedPositiveIntegerField(default=0)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        db_table = 'sentry_messagefiltervalue'
        unique_together = (('project', 'key', 'value', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id', 'key', 'value')

    def save(self, *args, **kwargs):
        if not self.first_seen:
            self.first_seen = self.last_seen
        super(GroupTag, self).save(*args, **kwargs)

# Legacy
MessageFilterValue = GroupTag


class GroupCountByMinute(Model):
    """
    Stores the total number of messages seen by a group at N minute intervals.

    e.g. if it happened at 08:34:55 the time would be normalized to 08:30:00
    """

    project = models.ForeignKey(Project, null=True)
    group = models.ForeignKey(Group)
    date = models.DateTimeField(db_index=True)  # normalized to HH:MM:00
    times_seen = BoundedPositiveIntegerField(default=0)
    time_spent_total = BoundedIntegerField(default=0)
    time_spent_count = BoundedIntegerField(default=0)

    objects = BaseManager()

    class Meta:
        db_table = 'sentry_messagecountbyminute'
        unique_together = (('project', 'group', 'date'),)

    __repr__ = sane_repr('project_id', 'group_id', 'date')

# Legacy
MessageCountByMinute = GroupCountByMinute


class ProjectCountByMinute(Model):
    """
    Stores the total number of messages seen by a project at N minute
    intervals.

    e.g. if it happened at 08:34:55 the time would be normalized to 08:30:00
    """

    project = models.ForeignKey(Project, null=True)
    date = models.DateTimeField()  # normalized to HH:MM:00
    times_seen = BoundedPositiveIntegerField(default=0)
    time_spent_total = BoundedIntegerField(default=0)
    time_spent_count = BoundedIntegerField(default=0)

    objects = BaseManager()

    class Meta:
        unique_together = (('project', 'date'),)

    __repr__ = sane_repr('project_id', 'date')


class SearchDocument(Model):
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group)
    total_events = BoundedPositiveIntegerField(default=1)
    status = BoundedPositiveIntegerField(default=0)
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
    times_seen = BoundedPositiveIntegerField(default=1)

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
    user = models.ForeignKey(settings.AUTH_USER_MODEL)
    project = models.ForeignKey(Project, null=True)
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    objects = UserOptionManager()

    class Meta:
        unique_together = (('user', 'project', 'key',),)

    __repr__ = sane_repr('user_id', 'project_id', 'key', 'value')


class LostPasswordHash(Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, unique=True)
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
            'domain': urlparse.urlparse(settings.SENTRY_URL_PREFIX).hostname,
            'url': absolute_uri(reverse(
                'sentry-account-recover-confirm',
                args=[self.user.id, self.hash]
            )),
        }
        body = render_to_string('sentry/emails/recover_account.txt', context)

        try:
            send_mail(
                '%sPassword Recovery' % (settings.EMAIL_SUBJECT_PREFIX,),
                body, settings.SERVER_EMAIL, [self.user.email],
                fail_silently=False
            )
        except Exception, e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)


class Activity(Model):
    SET_RESOLVED = 1
    SET_UNRESOLVED = 2
    SET_MUTED = 3
    SET_PUBLIC = 4
    SET_PRIVATE = 5
    SET_REGRESSION = 6
    CREATE_ISSUE = 7
    NOTE = 8

    TYPE = (
        # (TYPE, verb-slug)
        (SET_RESOLVED, 'set_resolved'),
        (SET_UNRESOLVED, 'set_unresolved'),
        (SET_MUTED, 'set_muted'),
        (SET_PUBLIC, 'set_public'),
        (SET_PRIVATE, 'set_private'),
        (SET_REGRESSION, 'set_regression'),
        (CREATE_ISSUE, 'create_issue'),
        (NOTE, 'note'),
    )

    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group, null=True)
    event = models.ForeignKey(Event, null=True)
    # index on (type, ident)
    type = BoundedPositiveIntegerField(choices=TYPE)
    ident = models.CharField(max_length=64, null=True)
    # if the user is not set, it's assumed to be the system
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    data = GzippedDictField(null=True)

    __repr__ = sane_repr('project_id', 'group_id', 'event_id', 'user_id',
                         'type', 'ident')

    def save(self, *args, **kwargs):
        created = bool(not self.id)

        super(Activity, self).save(*args, **kwargs)

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F('num_comments') + 1)

            if self.event:
                self.event.update(num_comments=F('num_comments') + 1)


class GroupSeen(Model):
    """
    Track when a group is last seen by a user.
    """
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, db_index=False)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = (('user', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id', 'user_id', 'last_seen')


class Alert(Model):
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    message = models.TextField()
    data = GzippedDictField(null=True)
    related_groups = models.ManyToManyField(Group, through='sentry.AlertRelatedGroup', related_name='related_alerts')
    status = BoundedPositiveIntegerField(default=0, choices=(
        (STATUS_UNRESOLVED, _('Unresolved')),
        (STATUS_RESOLVED, _('Resolved')),
    ), db_index=True)

    __repr__ = sane_repr('project_id', 'group_id', 'datetime')

    # TODO: move classmethods to manager
    @classmethod
    def get_recent_for_project(cls, project_id):
        return cls.objects.filter(
            project=project_id,
            group_id__isnull=True,
            datetime__gte=timezone.now() - timedelta(minutes=60),
            status=STATUS_UNRESOLVED,
        ).order_by('-datetime')

    @classmethod
    def maybe_alert(cls, project_id, message, group_id=None):
        now = timezone.now()
        manager = cls.objects
        # We only create an alert based on:
        # - an alert for the project hasn't been created in the last 30 minutes
        # - an alert for the event hasn't been created in the last 60 minutes

        # TODO: there is a race condition if we're calling this function for the same project
        if manager.filter(
                project=project_id, datetime__gte=now - timedelta(minutes=60)).exists():
            return

        if manager.filter(
                project=project_id, group=group_id,
                datetime__gte=now - timedelta(minutes=60)).exists():
            return

        alert = manager.create(
            project_id=project_id,
            group_id=group_id,
            datetime=now,
            message=message,
        )

        if not group_id and has_trending():
            # Capture the top 5 trending events at the time of this error
            related_groups = Group.objects.get_accelerated([project_id], minutes=MINUTE_NORMALIZATION)[:5]
            for group in related_groups:
                AlertRelatedGroup.objects.create(
                    group=group,
                    alert=alert,
                )

        return alert

    @property
    def team(self):
        return self.project.team

    @property
    def is_resolved(self):
        return (self.status == STATUS_RESOLVED
                or self.datetime < timezone.now() - timedelta(minutes=60))

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry-alert-details', args=[
            self.team.slug, self.project.slug, self.id]))


class AlertRelatedGroup(Model):
    group = models.ForeignKey(Group)
    alert = models.ForeignKey(Alert)
    data = GzippedDictField(null=True)

    class Meta:
        unique_together = (('group', 'alert'),)

    __repr__ = sane_repr('group_id', 'alert_id')


def create_default_project(created_models, verbosity=2, **kwargs):
    if Project not in created_models:
        return
    if Project.objects.filter(id=settings.SENTRY_PROJECT).exists():
        return

    try:
        user = User.objects.filter(is_superuser=True)[0]
    except IndexError:
        user = None

    project = Project.objects.create(
        public=False,
        name='Sentry (Internal)',
        slug='sentry',
        owner=user,
        platform='django',
    )
    # HACK: manually update the ID after insert due to Postgres
    # sequence issues. Seriously, fuck everything about this.
    # TODO(dcramer): find a better solution
    if project.id != settings.SENTRY_PROJECT:
        project.key_set.all().delete()
        project.update(id=settings.SENTRY_PROJECT)
        create_team_and_keys_for_project(project, created=True)

    if verbosity > 0:
        print 'Created internal Sentry project (slug=%s, id=%s)' % (project.slug, project.id)


def set_sentry_version(latest=None, **kwargs):
    import sentry
    current = sentry.get_version()

    version = Option.objects.get_value(
        key='sentry:latest_version',
        default=''
    )

    for ver in (current, version):
        if Version(ver) >= Version(latest):
            return

    Option.objects.set_value(
        key='sentry:latest_version',
        value=(latest or current)
    )


def create_team_and_keys_for_project(instance, created, **kwargs):
    if not created or kwargs.get('raw'):
        return

    if not instance.owner:
        return

    if not instance.team:
        team = Team(owner=instance.owner, name=instance.name)
        slugify_instance(team, instance.slug)
        team.save()
        update(instance, team=team)

    if not ProjectKey.objects.filter(project=instance, user__isnull=True).exists():
        ProjectKey.objects.create(
            project=instance,
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


@buffer_incr_complete.connect(sender=TagValue, weak=False)
def record_project_tag_count(filters, created, **kwargs):
    from sentry import app

    if not created:
        return

    app.buffer.incr(TagKey, {
        'values_seen': 1,
    }, {
        'project': filters['project'],
        'key': filters['key'],
    })


@buffer_incr_complete.connect(sender=GroupTag, weak=False)
def record_group_tag_count(filters, created, **kwargs):
    from sentry import app

    if not created:
        return

    app.buffer.incr(GroupTagKey, {
        'values_seen': 1,
    }, {
        'project': filters['project'],
        'group': filters['group'],
        'key': filters['key'],
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


def on_alert_creation(instance, **kwargs):
    from sentry.plugins import plugins

    for plugin in plugins.for_project(instance.project):
        safe_execute(plugin.on_alert, alert=instance)


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
post_save.connect(
    on_alert_creation,
    sender=Alert,
    dispatch_uid="on_alert_creation",
    weak=False,
)

add_introspection_rules([], ["^social_auth\.fields\.JSONField"])
