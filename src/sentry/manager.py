"""
sentry.manager
~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import hashlib
import logging
import six
import warnings
import uuid

from datetime import datetime
from django.conf import settings
from django.contrib.auth.models import UserManager
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.utils.datastructures import SortedDict
from raven.utils.encoding import to_string

from sentry import app
from sentry.constants import (
    STATUS_RESOLVED, STATUS_UNRESOLVED, MEMBER_USER, LOG_LEVELS,
    DEFAULT_LOGGER_NAME, MAX_CULPRIT_LENGTH, MAX_TAG_VALUE_LENGTH
)
from sentry.db.models import BaseManager
from sentry.processors.base import send_group_processors
from sentry.signals import regression_signal
from sentry.tasks.index import index_event
from sentry.tsdb.base import TSDBModel
from sentry.utils.cache import memoize
from sentry.utils.db import get_db_engine, attach_foreignkey
from sentry.utils.safe import safe_execute, trim, trim_dict

logger = logging.getLogger('sentry.errors')

UNSAVED = dict()


def get_checksum_from_event(event):
    interfaces = event.interfaces
    for interface in interfaces.itervalues():
        result = interface.get_composite_hash(interfaces=event.interfaces)
        if result:
            hash = hashlib.md5()
            for r in result:
                hash.update(to_string(r))
            return hash.hexdigest()
    return hashlib.md5(to_string(event.message)).hexdigest()


class ScoreClause(object):
    def __init__(self, group):
        self.group = group

    def __int__(self):
        # Calculate the score manually when coercing to an int.
        # This is used within create_or_update and friends
        return self.group.get_score()

    def prepare_database_save(self, unused):
        return self

    def prepare(self, evaluator, query, allow_joins):
        return

    def evaluate(self, node, qn, connection):
        engine = get_db_engine(getattr(connection, 'alias', 'default'))
        if engine.startswith('postgresql'):
            sql = 'log(times_seen) * 600 + last_seen::abstime::int'
        elif engine.startswith('mysql'):
            sql = 'log(times_seen) * 600 + unix_timestamp(last_seen)'
        else:
            # XXX: if we cant do it atomically let's do it the best we can
            sql = int(self)

        return (sql, [])


def count_limit(count):
    # TODO: could we do something like num_to_store = max(math.sqrt(100*count)+59, 200) ?
    # ~ 150 * ((log(n) - 1.5) ^ 2 - 0.25)
    for amount, sample_rate in settings.SENTRY_SAMPLE_RATES:
        if count <= amount:
            return sample_rate
    return settings.SENTRY_MAX_SAMPLE_RATE


def time_limit(silence):  # ~ 3600 per hour
    for amount, sample_rate in settings.SENTRY_SAMPLE_TIMES:
        if silence >= amount:
            return sample_rate
    return settings.SENTRY_MAX_SAMPLE_TIME


class UserManager(BaseManager, UserManager):
    pass


class GroupManager(BaseManager):
    use_for_related_fields = True

    def normalize_event_data(self, data):
        # TODO(dcramer): store http.env.REMOTE_ADDR as user.ip
        # First we pull out our top-level (non-data attr) kwargs
        if not isinstance(data.get('level'), (six.string_types, int)):
            data['level'] = logging.ERROR
        elif data['level'] not in LOG_LEVELS:
            data['level'] = logging.ERROR

        if not data.get('logger'):
            data['logger'] = DEFAULT_LOGGER_NAME
        else:
            data['logger'] = trim(data['logger'], 64)

        if data.get('platform'):
            data['platform'] = trim(data['platform'], 64)

        timestamp = data.get('timestamp')
        if not timestamp:
            timestamp = timezone.now()

        if isinstance(timestamp, datetime):
            # We must convert date to local time so Django doesn't mess it up
            # based on TIME_ZONE
            if settings.TIME_ZONE:
                if not timezone.is_aware(timestamp):
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
            elif timezone.is_aware(timestamp):
                timestamp = timestamp.replace(tzinfo=None)
            timestamp = float(timestamp.strftime('%s'))

        data['timestamp'] = timestamp

        if not data.get('event_id'):
            data['event_id'] = uuid.uuid4().hex

        data.setdefault('message', None)
        data.setdefault('culprit', None)
        data.setdefault('time_spent', None)
        data.setdefault('server_name', None)
        data.setdefault('site', None)
        data.setdefault('checksum', None)
        data.setdefault('platform', None)
        data.setdefault('extra', {})

        tags = data.get('tags')
        if not tags:
            tags = []
        # full support for dict syntax
        elif isinstance(tags, dict):
            tags = tags.items()
        # prevent [tag, tag, tag] (invalid) syntax
        elif not all(len(t) == 2 for t in tags):
            tags = []
        else:
            tags = list(tags)

        data['tags'] = tags

        if not isinstance(data['extra'], dict):
            # throw it away
            data['extra'] = {}

        trim_dict(
            data['extra'], max_size=settings.SENTRY_MAX_EXTRA_VARIABLE_SIZE)

        # TODO(dcramer): find a better place for this logic
        exception = data.get('sentry.interfaces.Exception')
        stacktrace = data.get('sentry.interfaces.Stacktrace')
        if exception and len(exception['values']) == 1 and stacktrace:
            exception['values'][0]['stacktrace'] = stacktrace
            del data['sentry.interfaces.Stacktrace']

        if 'sentry.interfaces.Http' in data:
            # default the culprit to the url
            if not data['culprit']:
                data['culprit'] = data['sentry.interfaces.Http']['url']

        if data['culprit']:
            data['culprit'] = trim(data['culprit'], MAX_CULPRIT_LENGTH)

        if data['message']:
            data['message'] = trim(data['message'], 2048)

        return data

    def from_kwargs(self, project, **kwargs):
        data = self.normalize_event_data(kwargs)

        return self.save_data(project, data)

    @transaction.commit_on_success
    def save_data(self, project, data, raw=False):
        # TODO: this function is way too damn long and needs refactored
        # the inner imports also suck so let's try to move it away from
        # the objects manager

        # TODO: culprit should default to "most recent" frame in stacktraces when
        # it's not provided.
        from sentry.plugins import plugins
        from sentry.models import Event, Project, EventMapping

        project = Project.objects.get_from_cache(id=project)

        # First we pull out our top-level (non-data attr) kwargs
        event_id = data.pop('event_id')
        message = data.pop('message')
        culprit = data.pop('culprit') or ''
        level = data.pop('level')
        time_spent = data.pop('time_spent')
        logger_name = data.pop('logger')
        server_name = data.pop('server_name')
        site = data.pop('site')
        checksum = data.pop('checksum')
        platform = data.pop('platform')

        date = datetime.fromtimestamp(data.pop('timestamp'))
        date = date.replace(tzinfo=timezone.utc)

        kwargs = {
            'message': message,
            'platform': platform,
        }

        event = Event(
            project=project,
            event_id=event_id,
            data=data,
            time_spent=time_spent,
            datetime=date,
            **kwargs
        )

        # Calculate the checksum from the first highest scoring interface
        if not checksum:
            checksum = get_checksum_from_event(event)

        event.checksum = checksum

        group_kwargs = kwargs.copy()
        group_kwargs.update({
            'culprit': culprit,
            'logger': logger_name,
            'level': level,
            'last_seen': date,
            'first_seen': date,
            'time_spent_total': time_spent or 0,
            'time_spent_count': time_spent and 1 or 0,
        })

        tags = data['tags']
        tags.append(('level', LOG_LEVELS[level]))
        if logger:
            tags.append(('logger', logger_name))
        if server_name:
            tags.append(('server_name', server_name))
        if site:
            tags.append(('site', site))

        for plugin in plugins.for_project(project):
            added_tags = safe_execute(plugin.get_tags, event)
            if added_tags:
                tags.extend(added_tags)

        try:
            group, is_new, is_regression, is_sample = self._create_group(
                event=event,
                tags=data['tags'],
                **group_kwargs
            )
        except Exception as exc:
            # TODO: should we mail admins when there are failures?
            try:
                logger.exception(u'Unable to process log entry: %s', exc)
            except Exception as exc:
                warnings.warn(u'Unable to process log entry: %s', exc)
            return

        using = group._state.db

        event.group = group

        # save the event unless its been sampled
        if not is_sample:
            sid = transaction.savepoint(using=using)
            try:
                event.save()
            except IntegrityError:
                transaction.savepoint_rollback(sid, using=using)
                return event
            transaction.savepoint_commit(sid, using=using)

        sid = transaction.savepoint(using=using)
        try:
            EventMapping.objects.create(
                project=project, group=group, event_id=event_id)
        except IntegrityError:
            transaction.savepoint_rollback(sid, using=using)
            return event
        transaction.savepoint_commit(sid, using=using)
        transaction.commit_unless_managed(using=using)

        if not raw:
            send_group_processors(
                group=group,
                event=event,
                is_new=is_new or is_regression,  # backwards compat
                is_sample=is_sample,
                is_regression=is_regression,
            )

        index_event.delay(event)

        # TODO: move this to the queue
        if is_new and not raw:
            regression_signal.send_robust(sender=self.model, instance=group)

        return event

    def should_sample(self, group, event):
        if not settings.SENTRY_SAMPLE_DATA:
            return False

        silence_timedelta = event.datetime - group.last_seen
        silence = silence_timedelta.days * 86400 + silence_timedelta.seconds

        if group.times_seen % count_limit(group.times_seen):
            return False

        if group.times_seen % time_limit(silence):
            return False

        return True

    def _create_group(self, event, tags=None, **kwargs):
        date = event.datetime
        time_spent = event.time_spent
        project = event.project

        group, is_new = self.get_or_create(
            project=project,
            checksum=event.checksum,
            defaults=kwargs
        )
        if is_new:
            transaction.commit_unless_managed(using=group._state.db)

        update_kwargs = {
            'times_seen': 1,
        }
        if time_spent:
            update_kwargs.update({
                'time_spent_total': time_spent,
                'time_spent_count': 1,
            })

        if not is_new:
            extra = {
                'last_seen': max(event.datetime, group.last_seen),
                'score': ScoreClause(group),
            }
            if event.message and event.message != group.message:
                extra['message'] = event.message
            if group.level != kwargs['level']:
                extra['level'] = kwargs['level']
            if group.culprit != kwargs['culprit']:
                extra['culprit'] = kwargs['culprit']

            if group.status == STATUS_RESOLVED or group.is_over_resolve_age():
                # Making things atomic
                is_regression = bool(self.filter(
                    id=group.id,
                    status=STATUS_RESOLVED,
                ).exclude(
                    active_at__gte=date,
                ).update(active_at=date, status=STATUS_UNRESOLVED))

                transaction.commit_unless_managed(using=group._state.db)

                group.active_at = date
                group.status = STATUS_UNRESOLVED
            else:
                is_regression = False

            group.last_seen = extra['last_seen']

            app.buffer.incr(self.model, update_kwargs, {
                'id': group.id,
            }, extra)
        else:
            is_regression = False

            # TODO: this update should actually happen as part of create
            group.update(score=ScoreClause(group))

            # We need to commit because the queue can run too fast and hit
            # an issue with the group not existing before the buffers run
            transaction.commit_unless_managed(using=group._state.db)

        # Determine if we've sampled enough data to store this event
        if is_new:
            is_sample = False
        elif not self.should_sample(group, event):
            is_sample = False
        else:
            is_sample = True

        # Rounded down to the nearest interval
        try:
            self.add_tags(group, tags)
        except Exception as e:
            logger.exception('Unable to record tags: %s' % (e,))

        app.tsdb.incr_multi([
            (TSDBModel.group, group.id),
            (TSDBModel.project, project.id),
        ])

        return group, is_new, is_regression, is_sample

    def add_tags(self, group, tags):
        from sentry.models import TagValue, GroupTagValue

        project = group.project
        date = group.last_seen

        tsdb_keys = []

        for tag_item in tags:
            if len(tag_item) == 2:
                (key, value), data = tag_item, None
            else:
                key, value, data = tag_item

            if not value:
                continue

            value = six.text_type(value)
            if len(value) > MAX_TAG_VALUE_LENGTH:
                continue

            tsdb_id = u'%s=%s' % (key, value)

            tsdb_keys.extend([
                (TSDBModel.project_tag_value, tsdb_id),
            ])

            app.buffer.incr(TagValue, {
                'times_seen': 1,
            }, {
                'project': project,
                'key': key,
                'value': value,
            }, {
                'last_seen': date,
                'data': data,
            })

            app.buffer.incr(GroupTagValue, {
                'times_seen': 1,
            }, {
                'group': group,
                'project': project,
                'key': key,
                'value': value,
            }, {
                'last_seen': date,
            })

        if tsdb_keys:
            app.tsdb.incr_multi(tsdb_keys)

    def get_by_natural_key(self, project, logger, culprit, checksum):
        return self.get(project=project, logger=logger, view=culprit, checksum=checksum)

    @memoize
    def model_fields_clause(self):
        return ', '.join('sentry_groupedmessage."%s"' % (f.column,) for f in self.model._meta.fields)


class ProjectManager(BaseManager):
    def get_for_user(self, user=None, access=None, hidden=False, team=None,
                     superuser=True):
        """
        Returns a SortedDict of all projects a user has some level of access to.
        """
        from sentry.models import Team

        if not (user and user.is_authenticated()):
            return []

        # TODO: the result of this function should be cached
        is_authenticated = (user and user.is_authenticated())

        base_qs = self
        if not hidden:
            base_qs = base_qs.filter(status=0)
        if team:
            base_qs = base_qs.filter(team=team)

        if team and user.is_superuser and superuser:
            projects = set(base_qs)
        else:
            projects_qs = base_qs
            if not settings.SENTRY_PUBLIC:
                # If the user is authenticated, include their memberships
                teams = Team.objects.get_for_user(
                    user, access, access_groups=False).values()
                if not teams:
                    projects_qs = self.none()
                if team and team not in teams:
                    projects_qs = self.none()
                elif not team:
                    projects_qs = projects_qs.filter(team__in=teams)

            projects = set(projects_qs)

            if is_authenticated:
                projects |= set(base_qs.filter(accessgroup__members=user))

        attach_foreignkey(projects, self.model.team)

        return sorted(projects, key=lambda x: x.name.lower())


class TeamManager(BaseManager):
    def get_for_user(self, user, access=None, access_groups=True, with_projects=False):
        """
        Returns a SortedDict of all teams a user has some level of access to.

        Each <Team> returned has an ``access_type`` attribute which holds the
        MEMBER_TYPE value.
        """
        from sentry.models import TeamMember, AccessGroup, Project

        results = SortedDict()

        if not user.is_authenticated():
            return results

        all_teams = set()

        qs = TeamMember.objects.filter(
            user=user,
        ).select_related('team')
        if access is not None:
            qs = qs.filter(type__lte=access)

        for tm in qs:
            team = tm.team
            team.access_type = tm.type
            all_teams.add(team)

        if access_groups:
            qs = AccessGroup.objects.filter(
                members=user,
            ).select_related('team')
            if access is not None:
                qs = qs.filter(type__lte=access)

            for group in qs:
                team = group.team
                team.access_type = group.type
                all_teams.add(team)

        if settings.SENTRY_PUBLIC and access is None:
            for team in self.iterator():
                all_teams.add(team)
                team.access_type = MEMBER_USER

        for team in sorted(all_teams, key=lambda x: x.name.lower()):
            results[team.slug] = team

        if with_projects:
            # these kinds of queries make people sad :(
            new_results = SortedDict()
            for team in results.itervalues():
                project_list = list(Project.objects.get_for_user(
                    user, team=team))
                new_results[team.slug] = (team, project_list)
            results = new_results

        return results
