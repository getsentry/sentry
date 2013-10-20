"""
sentry.manager
~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import with_statement

from collections import defaultdict
import datetime
import hashlib
import itertools
import logging
import re
import time
import warnings
import uuid

from celery.signals import task_postrun
from django.conf import settings
from django.contrib.auth.models import UserManager
from django.core.signals import request_finished
from django.db import models, transaction, IntegrityError
from django.db.models import Sum
from django.utils import timezone
from django.utils.datastructures import SortedDict
from django.utils.encoding import force_unicode

from raven.utils.encoding import to_string
from sentry import app
from sentry.constants import (
    STATUS_RESOLVED, STATUS_UNRESOLVED, MINUTE_NORMALIZATION,
    MAX_EXTRA_VARIABLE_SIZE, LOG_LEVELS, DEFAULT_LOGGER_NAME,
    MAX_CULPRIT_LENGTH)
from sentry.db.models import BaseManager
from sentry.processors.base import send_group_processors
from sentry.signals import regression_signal
from sentry.tasks.index import index_event
from sentry.utils.cache import cache, memoize
from sentry.utils.dates import get_sql_date_trunc, normalize_datetime
from sentry.utils.db import get_db_engine, has_charts, attach_foreignkey
from sentry.utils.safe import safe_execute, trim, trim_dict
from sentry.utils.strings import strip

logger = logging.getLogger('sentry.errors')

UNSAVED = dict()
MAX_TAG_LENGTH = 200


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
            sql = self.group.get_score()

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


class ChartMixin(object):
    def get_chart_data_for_group(self, instances, max_days=90, key=None):
        if not instances:
            if key is None:
                return []
            return {}

        if hasattr(instances[0], '_state'):
            db = instances[0]._state.db or 'default'
        else:
            db = 'default'

        field = self.model.groupcountbyminute_set.related
        column = field.field.name
        queryset = field.model.objects.filter(**{
            '%s__in' % column: instances,
        })

        return self._get_chart_data(queryset, max_days, db, key=key)

    def get_chart_data(self, instance, max_days=90, key=None):
        if hasattr(instance, '_state'):
            db = instance._state.db or 'default'
        else:
            db = 'default'

        queryset = instance.groupcountbyminute_set

        return self._get_chart_data(queryset, max_days, db, key=key)

    def _get_chart_data(self, queryset, max_days=90, db='default', key=None):
        if not has_charts(db):
            if key is None:
                return []
            return {}

        today = timezone.now().replace(microsecond=0, second=0)

        # the last interval is not accurate, so we exclude it
        # TODO: it'd be ideal to normalize the last datapoint so that we can include it
        # and not have ~inaccurate data for up to MINUTE_NORMALIZATION
        today -= datetime.timedelta(minutes=MINUTE_NORMALIZATION)

        if max_days >= 30:
            g_type = 'date'
            d_type = 'days'
            points = max_days
            modifier = 1
            today = today.replace(hour=0)
        elif max_days >= 1:
            g_type = 'hour'
            d_type = 'hours'
            points = max_days * 24
            modifier = 1
            today = today.replace(minute=0)
        else:
            g_type = 'minute'
            d_type = 'minutes'
            modifier = MINUTE_NORMALIZATION
            points = max_days * 24 * (60 / modifier)

        min_date = today - datetime.timedelta(days=max_days)

        method = get_sql_date_trunc('date', db, grouper=g_type)

        chart_qs = queryset.filter(
            date__gte=min_date,
        ).extra(
            select={'grouper': method},
        )
        if key:
            chart_qs = chart_qs.values('grouper', key)
        else:
            chart_qs = chart_qs.values('grouper')

        chart_qs = chart_qs.annotate(
            num=Sum('times_seen'),
        )
        if key:
            chart_qs = chart_qs.values_list(key, 'grouper', 'num').order_by(key, 'grouper')
        else:
            chart_qs = chart_qs.values_list('grouper', 'num').order_by('grouper')

        if key is None:
            rows = {None: dict(chart_qs)}
        else:
            rows = {}
            for item, grouper, num in chart_qs:
                if item not in rows:
                    rows[item] = {}
                rows[item][grouper] = num

        results = {}
        for item, tsdata in rows.iteritems():
            results[item] = []
            for point in xrange(points, -1, -1):
                dt = today - datetime.timedelta(**{d_type: point * modifier})
                results[item].append((int(time.mktime((dt).timetuple())) * 1000, tsdata.get(dt, 0)))

        if key is None:
            return results[None]
        return results


class GroupManager(BaseManager, ChartMixin):
    use_for_related_fields = True

    def normalize_event_data(self, data):
        # TODO(dcramer): store http.env.REMOTE_ADDR as user.ip
        # First we pull out our top-level (non-data attr) kwargs
        if not data.get('level') or data['level'] not in LOG_LEVELS:
            data['level'] = logging.ERROR
        if not data.get('logger'):
            data['logger'] = DEFAULT_LOGGER_NAME

        timestamp = data.get('timestamp')
        if not timestamp:
            timestamp = timezone.now()

        # We must convert date to local time so Django doesn't mess it up
        # based on TIME_ZONE
        if settings.TIME_ZONE:
            if not timezone.is_aware(timestamp):
                timestamp = timestamp.replace(tzinfo=timezone.utc)
        elif timezone.is_aware(timestamp):
            timestamp = timestamp.replace(tzinfo=None)
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
        data['message'] = strip(data['message'])
        data['culprit'] = strip(data['culprit'])

        if not isinstance(data['extra'], dict):
            # throw it away
            data['extra'] = {}

        trim_dict(data['extra'], max_size=MAX_EXTRA_VARIABLE_SIZE)

        if 'sentry.interfaces.Exception' in data:
            if 'values' not in data['sentry.interfaces.Exception']:
                data['sentry.interfaces.Exception'] = {
                    'values': [data['sentry.interfaces.Exception']]
                }

            # convert stacktrace + exception into expanded exception
            if 'sentry.interfaces.Stacktrace' in data:
                data['sentry.interfaces.Exception']['values'][0]['stacktrace'] = data.pop('sentry.interfaces.Stacktrace')

            for exc_data in data['sentry.interfaces.Exception']['values']:
                for key in ('type', 'module', 'value'):
                    value = exc_data.get(key)
                    if value:
                        exc_data[key] = trim(value)
                if exc_data.get('stacktrace'):
                    for frame in exc_data['stacktrace']['frames']:
                        stack_vars = frame.get('vars', {})
                        trim_dict(stack_vars)

        if 'sentry.interfaces.Stacktrace' in data:
            for frame in data['sentry.interfaces.Stacktrace']['frames']:
                stack_vars = frame.get('vars', {})
                trim_dict(stack_vars)

        if 'sentry.interfaces.Message' in data:
            msg_data = data['sentry.interfaces.Message']
            trim(msg_data['message'], 1024)
            if msg_data.get('params'):
                msg_data['params'] = trim(msg_data['params'])

        if 'sentry.interfaces.Http' in data:
            http_data = data['sentry.interfaces.Http']
            for key in ('cookies', 'querystring', 'headers', 'env', 'url'):
                value = http_data.get(key)
                if not value:
                    continue

                if type(value) == dict:
                    trim_dict(value)
                else:
                    http_data[key] = trim(value)

            value = http_data.get('data')
            if value:
                http_data['data'] = trim(value, 2048)

            # default the culprit to the url
            if not data['culprit']:
                data['culprit'] = trim(strip(http_data.get('url')), MAX_CULPRIT_LENGTH)

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
        culprit = data.pop('culprit')
        level = data.pop('level')
        time_spent = data.pop('time_spent')
        logger_name = data.pop('logger')
        server_name = data.pop('server_name')
        site = data.pop('site')
        date = data.pop('timestamp')
        checksum = data.pop('checksum')
        platform = data.pop('platform')

        if 'sentry.interfaces.Exception' in data:
            if 'values' not in data['sentry.interfaces.Exception']:
                data['sentry.interfaces.Exception'] = {'values': [data['sentry.interfaces.Exception']]}

            # convert stacktrace + exception into expanded exception
            if 'sentry.interfaces.Stacktrace' in data:
                data['sentry.interfaces.Exception']['values'][0]['stacktrace'] = data.pop('sentry.interfaces.Stacktrace')

        kwargs = {
            'level': level,
            'message': message,
            'platform': platform,
            'culprit': culprit or '',
            'logger': logger_name,
        }

        event = Event(
            project=project,
            event_id=event_id,
            data=data,
            server_name=server_name,
            site=site,
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
            group, is_new, is_sample = self._create_group(
                event=event,
                tags=data['tags'],
                **group_kwargs
            )
        except Exception as exc:
            # TODO: should we mail admins when there are failures?
            try:
                logger.exception(u'Unable to process log entry: %s', exc)
            except Exception, exc:
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
                is_new=is_new,
                is_sample=is_sample
            )

        if settings.SENTRY_USE_SEARCH:
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
        from sentry.models import ProjectCountByMinute, GroupCountByMinute

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
            if group.level != event.level:
                extra['level'] = event.level

            if group.status == STATUS_RESOLVED or group.is_over_resolve_age():
                # Making things atomic
                is_new = bool(self.filter(
                    id=group.id,
                    status=STATUS_RESOLVED,
                ).exclude(
                    active_at__gte=date,
                ).update(active_at=date, status=STATUS_UNRESOLVED))

                transaction.commit_unless_managed(using=group._state.db)

                group.active_at = date
                group.status = STATUS_UNRESOLVED

            group.last_seen = extra['last_seen']

            app.buffer.incr(self.model, update_kwargs, {
                'id': group.id,
            }, extra)
        else:
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
        normalized_datetime = normalize_datetime(date)

        app.buffer.incr(GroupCountByMinute, update_kwargs, {
            'group': group,
            'project': project,
            'date': normalized_datetime,
        })

        app.buffer.incr(ProjectCountByMinute, update_kwargs, {
            'project': project,
            'date': normalized_datetime,
        })

        try:
            self.add_tags(group, tags)
        except Exception, e:
            logger.exception('Unable to record tags: %s' % (e,))

        return group, is_new, is_sample

    def add_tags(self, group, tags):
        from sentry.models import TagValue, GroupTag

        project = group.project
        date = group.last_seen

        for tag_item in tags:
            if len(tag_item) == 2:
                (key, value), data = tag_item, None
            else:
                key, value, data = tag_item

            if not value:
                continue

            value = unicode(value)
            if len(value) > MAX_TAG_LENGTH:
                continue

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

            app.buffer.incr(GroupTag, {
                'times_seen': 1,
            }, {
                'group': group,
                'project': project,
                'key': key,
                'value': value,
            }, {
                'last_seen': date,
            })

    def get_by_natural_key(self, project, logger, culprit, checksum):
        return self.get(project=project, logger=logger, view=culprit, checksum=checksum)

    @memoize
    def model_fields_clause(self):
        return ', '.join('sentry_groupedmessage."%s"' % (f.column,) for f in self.model._meta.fields)

    def get_accelerated(self, project_ids, queryset=None, minutes=15):
        if not project_ids:
            return self.none()

        if queryset is None:
            queryset = self.filter(
                project__in=project_ids,
                status=STATUS_UNRESOLVED,
            )
        else:
            queryset = queryset._clone()
            queryset.query.select_related = False

        normalization = float(MINUTE_NORMALIZATION)

        assert minutes >= normalization

        intervals = 8

        engine = get_db_engine(queryset.db)
        # We technically only support mysql and postgresql, since there seems to be no standard
        # way to get the epoch from a datetime/interval
        if engine.startswith('mysql'):
            minute_clause = "interval %s minute"
            epoch_clause = "unix_timestamp(utc_timestamp()) - unix_timestamp(mcbm.date)"
            now_clause = 'utc_timestamp()'
        else:
            minute_clause = "interval '%s minutes'"
            epoch_clause = "extract(epoch from now()) - extract(epoch from mcbm.date)"
            now_clause = 'now()'

        sql, params = queryset.query.get_compiler(queryset.db).as_sql()
        before_select, after_select = str(sql).split('SELECT ', 1)
        after_where = after_select.split(' WHERE ', 1)[1]

        # Ensure we remove any ordering clause
        after_where = after_where.split(' ORDER BY ')[0]

        query = """
        SELECT ((mcbm.times_seen + 1) / ((%(epoch_clause)s) / 60)) / (COALESCE(z.rate, 0) + 1) as sort_value,
               %(fields)s
        FROM sentry_groupedmessage
        INNER JOIN sentry_messagecountbyminute as mcbm
            ON (sentry_groupedmessage.id = mcbm.group_id)
        LEFT JOIN (SELECT a.group_id, (SUM(a.times_seen)) / COUNT(a.times_seen) / %(norm)f as rate
            FROM sentry_messagecountbyminute as a
            WHERE a.date >=  %(now)s - %(max_time)s
            AND a.date < %(now)s - %(min_time)s
            AND a.project_id IN (%(project_ids)s)
            GROUP BY a.group_id) as z
        ON z.group_id = mcbm.group_id
        WHERE mcbm.date >= %(now)s - %(min_time)s
        AND mcbm.date < %(now)s - %(offset_time)s
        AND mcbm.times_seen > 0
        AND ((mcbm.times_seen + 1) / ((%(epoch_clause)s) / 60)) > (COALESCE(z.rate, 0) + 1)
        AND %(after_where)s
        GROUP BY z.rate, mcbm.times_seen, mcbm.date, %(fields)s
        ORDER BY sort_value DESC
        """ % dict(
            fields=self.model_fields_clause,
            after_where=after_where,
            offset_time=minute_clause % (1,),
            min_time=minute_clause % (minutes + 1,),
            max_time=minute_clause % (minutes * intervals + 1,),
            norm=normalization,
            epoch_clause=epoch_clause,
            now=now_clause,
            project_ids=', '.join((str(int(x)) for x in project_ids)),
        )
        return RawQuerySet(self, query, params)


class RawQuerySet(object):
    def __init__(self, queryset, query, params):
        self.queryset = queryset
        self.query = query
        self.params = params

    def __getitem__(self, k):
        offset = k.start or 0
        limit = k.stop - offset

        limit_clause = ' LIMIT %d OFFSET %d' % (limit, offset)

        query = self.query + limit_clause

        return self.queryset.raw(query, self.params)


class ProjectManager(BaseManager, ChartMixin):
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


class MetaManager(BaseManager):
    NOTSET = object()

    def __init__(self, *args, **kwargs):
        super(MetaManager, self).__init__(*args, **kwargs)
        task_postrun.connect(self.clear_cache)
        request_finished.connect(self.clear_cache)
        self.__metadata = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_MetaManager__metadata', None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__metadata = {}

    def get_value(self, key, default=NOTSET):
        result = self.get_all_values()
        if default is self.NOTSET:
            return result[key]
        return result.get(key, default)

    def unset_value(self, key):
        self.filter(key=key).delete()
        self.__metadata.pop(key, None)

    def set_value(self, key, value):
        print key, value
        inst, _ = self.get_or_create(
            key=key,
            defaults={
                'value': value,
            }
        )
        if inst.value != value:
            inst.update(value=value)

        self.__metadata[key] = value

    def get_all_values(self):
        if not hasattr(self, '_MetaManager__metadata'):
            self.__metadata = dict(self.values_list('key', 'value'))
        return self.__metadata

    def clear_cache(self, **kwargs):
        self.__metadata = {}


class InstanceMetaManager(BaseManager):
    NOTSET = object()

    def __init__(self, field_name, *args, **kwargs):
        super(InstanceMetaManager, self).__init__(*args, **kwargs)
        self.field_name = field_name
        task_postrun.connect(self.clear_cache)
        request_finished.connect(self.clear_cache)
        self.__metadata = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_InstanceMetaManager__metadata', None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__metadata = {}

    def get_value_bulk(self, instances, key):
        return dict(self.filter(**{
            '%s__in' % self.field_name: instances,
            'key': key,
        }).values_list(self.field_name, 'value'))

    def get_value(self, instance, key, default=NOTSET):
        result = self.get_all_values(instance)
        if default is self.NOTSET:
            return result[key]
        return result.get(key, default)

    def unset_value(self, instance, key):
        self.filter(**{self.field_name: instance, 'key': key}).delete()
        if instance.pk not in self.__metadata:
            return
        self.__metadata[instance.pk].pop(key, None)

    def set_value(self, instance, key, value):
        inst, created = self.get_or_create(**{
            self.field_name: instance,
            'key': key,
            'defaults': {
                'value': value,
            }
        })
        if not created and inst.value != value:
            inst.update(value=value)

        if instance.pk not in self.__metadata:
            return
        self.__metadata[instance.pk][key] = value

    def get_all_values(self, instance):
        if isinstance(instance, models.Model):
            instance_id = instance.pk
        else:
            instance_id = instance

        if instance_id not in self.__metadata:
            result = dict(
                (i.key, i.value) for i in
                self.filter(**{
                    self.field_name: instance_id,
                })
            )
            self.__metadata[instance_id] = result
        return self.__metadata.get(instance_id, {})

    def clear_cache(self, **kwargs):
        self.__metadata = {}


class UserOptionManager(BaseManager):
    NOTSET = object()

    def __init__(self, *args, **kwargs):
        super(UserOptionManager, self).__init__(*args, **kwargs)
        task_postrun.connect(self.clear_cache)
        request_finished.connect(self.clear_cache)
        self.__metadata = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_UserOptionManager__metadata', None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__metadata = {}

    def get_value(self, user, project, key, default=NOTSET):
        result = self.get_all_values(user, project)
        if default is self.NOTSET:
            return result[key]
        return result.get(key, default)

    def unset_value(self, user, project, key):
        self.filter(user=user, project=project, key=key).delete()
        if not hasattr(self, '_metadata'):
            return
        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self.__metadata:
            return
        self.__metadata[metakey].pop(key, None)

    def set_value(self, user, project, key, value):
        inst, created = self.get_or_create(
            user=user,
            project=project,
            key=key,
            defaults={
                'value': value,
            },
        )
        if not created and inst.value != value:
            inst.update(value=value)

        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self.__metadata:
            return
        self.__metadata[metakey][key] = value

    def get_all_values(self, user, project):
        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self.__metadata:
            result = dict(
                (i.key, i.value) for i in
                self.filter(
                    user=user,
                    project=project,
                )
            )
            self.__metadata[metakey] = result
        return self.__metadata.get(metakey, {})

    def clear_cache(self, **kwargs):
        self.__metadata = {}


class SearchDocumentManager(BaseManager):
    # Words which should not be indexed
    STOP_WORDS = set(['the', 'of', 'to', 'and', 'a', 'in', 'is', 'it', 'you', 'that'])

    # Do not index any words shorter than this
    MIN_WORD_LENGTH = 3

    # Consider these characters to be punctuation (they will be replaced with spaces prior to word extraction)
    PUNCTUATION_CHARS = re.compile('[%s]' % re.escape(".,;:!?@$%^&*()-<>[]{}\\|/`~'\""))

    def _tokenize(self, text):
        """
        Given a string, returns a list of tokens.
        """
        if not text:
            return []

        text = self.PUNCTUATION_CHARS.sub(' ', text)

        words = [t[:128].lower() for t in text.split() if len(t) >= self.MIN_WORD_LENGTH and t.lower() not in self.STOP_WORDS]

        return words

    def search(self, project, query, sort_by='score', offset=0, limit=100):
        tokens = self._tokenize(query)

        if sort_by == 'score':
            order_by = 'SUM(st.times_seen) / sd.total_events DESC'
        elif sort_by == 'new':
            order_by = 'sd.date_added DESC'
        elif sort_by == 'date':
            order_by = 'sd.date_changed DESC'
        else:
            raise ValueError('sort_by: %r' % sort_by)

        if tokens:
            token_sql = ' st.token IN (%s) AND ' % \
                ', '.join('%s' for i in range(len(tokens)))
        else:
            token_sql = ' '

        sql = """
            SELECT sd.*,
                   SUM(st.times_seen) / sd.total_events as score
            FROM sentry_searchdocument as sd
            INNER JOIN sentry_searchtoken as st
                ON st.document_id = sd.id
            WHERE %s
                sd.project_id = %s
            GROUP BY sd.id, sd.group_id, sd.total_events, sd.date_changed, sd.date_added, sd.project_id, sd.status
            ORDER BY %s
            LIMIT %d OFFSET %d
        """ % (
            token_sql,
            project.id,
            order_by,
            limit,
            offset,
        )
        params = tokens

        return self.raw(sql, params)

    def index(self, event):
        from sentry.models import SearchToken

        group = event.group
        document, created = self.get_or_create(
            project=event.project,
            group=group,
            defaults={
                'status': group.status,
                'total_events': 1,
                'date_added': group.first_seen,
                'date_changed': group.last_seen,
            }
        )
        if not created:
            app.buffer.incr(self.model, {
                'total_events': 1,
            }, {
                'id': document.id,
            }, {
                'date_changed': group.last_seen,
                'status': group.status,
            })

            document.total_events += 1
            document.date_changed = group.last_seen
            document.status = group.status

        context = defaultdict(list)
        for interface in event.interfaces.itervalues():
            for k, v in interface.get_search_context(event).iteritems():
                context[k].extend(v)

        context['text'].extend([
            event.message,
            event.logger,
            event.server_name,
            event.culprit,
        ])

        token_counts = defaultdict(lambda: defaultdict(int))
        for field, values in context.iteritems():
            field = field.lower()
            if field == 'text':
                # we only tokenize the base text field
                values = itertools.chain(*[self._tokenize(force_unicode(v)) for v in values])
            else:
                values = [v.lower() for v in values]
            for value in values:
                if not value:
                    continue
                token_counts[field][value] += 1

        for field, tokens in token_counts.iteritems():
            for token, count in tokens.iteritems():
                app.buffer.incr(SearchToken, {
                    'times_seen': count,
                }, {
                    'document': document,
                    'token': token,
                    'field': field,
                })

        return document


class TagKeyManager(BaseManager):
    def _get_cache_key(self, project_id):
        return 'filterkey:all:%s' % project_id

    def all_keys(self, project):
        # TODO: cache invalidation via post_save/post_delete signals much like BaseManager
        key = self._get_cache_key(project.id)
        result = cache.get(key)
        if result is None:
            result = list(self.filter(project=project).values_list('key', flat=True))
            cache.set(key, result, 60)
        return result


class TeamManager(BaseManager):
    def get_for_user(self, user, access=None, access_groups=True, with_projects=False):
        """
        Returns a SortedDict of all teams a user has some level of access to.

        Each <Team> returned has a ``membership`` attribute which holds the
        <TeamMember> instance.
        """
        from sentry.models import TeamMember, AccessGroup, Project

        results = SortedDict()

        if not user.is_authenticated():
            return results

        if settings.SENTRY_PUBLIC and access is None:
            for team in sorted(self.iterator(), key=lambda x: x.name.lower()):
                results[team.slug] = team
        else:
            all_teams = set()

            qs = TeamMember.objects.filter(
                user=user,
            ).select_related('team')
            if access is not None:
                qs = qs.filter(type__lte=access)

            for tm in qs:
                all_teams.add(tm.team)

            if access_groups:
                qs = AccessGroup.objects.filter(
                    members=user,
                ).select_related('team')
                if access is not None:
                    qs = qs.filter(type__lte=access)

                for group in qs:
                    all_teams.add(group.team)

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
