"""
sentry.manager
~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import with_statement

from collections import defaultdict
import datetime
import hashlib
import itertools
import logging
import re
import warnings
import weakref

from django.conf import settings as dj_settings
from django.core.signals import request_finished
from django.db import models, transaction, IntegrityError
from django.db.models import Sum
from django.db.models.expressions import F, ExpressionNode
from django.db.models.signals import post_save, post_delete, post_init, class_prepared
from django.utils import timezone
from django.utils.datastructures import SortedDict
from django.utils.encoding import force_unicode, smart_str

from raven.utils.encoding import to_string
from sentry import app
from sentry.conf import settings
from sentry.constants import STATUS_RESOLVED, STATUS_UNRESOLVED
from sentry.processors.base import send_group_processors
from sentry.signals import regression_signal
from sentry.tasks.index import index_event
from sentry.utils.cache import cache, Lock
from sentry.utils.dates import get_sql_date_trunc
from sentry.utils.db import get_db_engine, has_charts, resolve_expression_node
from sentry.utils.queue import maybe_delay

logger = logging.getLogger('sentry.errors')

UNSAVED = dict()
MAX_TAG_LENGTH = 200


def get_checksum_from_event(event):
    for interface in event.interfaces.itervalues():
        result = interface.get_hash()
        if result:
            hash = hashlib.md5()
            for r in result:
                hash.update(to_string(r))
            return hash.hexdigest()
    return hashlib.md5(to_string(event.message)).hexdigest()


class BaseManager(models.Manager):
    lookup_handlers = {
        'iexact': lambda x: x.upper(),
    }

    def __init__(self, *args, **kwargs):
        self.cache_fields = kwargs.pop('cache_fields', [])
        self.cache_ttl = kwargs.pop('cache_ttl', 60 * 5)
        self.__cache = weakref.WeakKeyDictionary()
        super(BaseManager, self).__init__(*args, **kwargs)

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        del d['_BaseManager__cache']
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__cache = weakref.WeakKeyDictionary()

    def __prep_value(self, key, value):
        if isinstance(value, models.Model):
            value = value.pk
        else:
            value = unicode(value)
        parts = key.split('__')
        if len(key) > 1 and parts[-1] in self.lookup_handlers:
            value = self.lookup_handlers[parts[-1]](value)
        return value

    def __prep_key(self, key):
        if key == 'pk':
            return self.model._meta.pk.name
        return key

    def __make_key(self, prefix, kwargs):
        kwargs_bits = []
        for k, v in sorted(kwargs.iteritems()):
            k = self.__prep_key(k)
            v = smart_str(self.__prep_value(k, v))
            kwargs_bits.append('%s=%s' % (k, v))
        kwargs_bits = ':'.join(kwargs_bits)

        return '%s:%s:%s' % (prefix, self.model.__name__, hashlib.md5(kwargs_bits).hexdigest())

    def __class_prepared(self, sender, **kwargs):
        """
        Given the cache is configured, connects the required signals for invalidation.
        """
        if not self.cache_fields:
            return
        post_init.connect(self.__post_init, sender=sender, weak=False)
        post_save.connect(self.__post_save, sender=sender, weak=False)
        post_delete.connect(self.__post_delete, sender=sender, weak=False)

    def __cache_state(self, instance):
        """
        Updates the tracked state of an instance.
        """
        if instance.pk:
            self.__cache[instance] = dict((f, getattr(instance, f)) for f in self.cache_fields)
        else:
            self.__cache[instance] = UNSAVED

    def __post_init(self, instance, **kwargs):
        """
        Stores the initial state of an instance.
        """
        self.__cache_state(instance)

    def __post_save(self, instance, **kwargs):
        """
        Pushes changes to an instance into the cache, and removes invalid (changed)
        lookup values.
        """
        pk_name = instance._meta.pk.name
        pk_names = ('pk', pk_name)
        pk_val = instance.pk
        for key in self.cache_fields:
            if key in pk_names:
                continue
            # store pointers
            cache.set(self.__get_lookup_cache_key(**{key: getattr(instance, key)}), pk_val, self.cache_ttl)  # 1 hour

        # Ensure we dont serialize the database into the cache
        db = instance._state.db
        instance._state.db = None
        # store actual object
        cache.set(self.__get_lookup_cache_key(**{pk_name: pk_val}), instance, self.cache_ttl)
        instance._state.db = db

        # Kill off any keys which are no longer valid
        if instance in self.__cache:
            for key in self.cache_fields:
                if key not in self.__cache[instance]:
                    continue
                value = self.__cache[instance][key]
                if value != getattr(instance, key):
                    cache.delete(self.__get_lookup_cache_key(**{key: value}))

        self.__cache_state(instance)

    def __post_delete(self, instance, **kwargs):
        """
        Drops instance from all cache storages.
        """
        pk_name = instance._meta.pk.name
        for key in self.cache_fields:
            if key in ('pk', pk_name):
                continue
            # remove pointers
            cache.delete(self.__get_lookup_cache_key(**{key: getattr(instance, key)}))
        # remove actual object
        cache.delete(self.__get_lookup_cache_key(**{pk_name: instance.pk}))

    def __get_lookup_cache_key(self, **kwargs):
        return self.__make_key('modelcache', kwargs)

    def contribute_to_class(self, model, name):
        super(BaseManager, self).contribute_to_class(model, name)
        class_prepared.connect(self.__class_prepared, sender=model)

    def get_from_cache(self, **kwargs):
        """
        Wrapper around QuerySet.get which supports caching of the
        intermediate value.  Callee is responsible for making sure
        the cache key is cleared on save.
        """
        if not self.cache_fields or len(kwargs) > 1:
            return self.get(**kwargs)

        pk_name = self.model._meta.pk.name
        key, value = kwargs.items()[0]

        # Kill __exact since it's the default behavior
        if key.endswith('__exact'):
            key = key.split('__exact', 1)[0]

        if key in self.cache_fields or key in ('pk', pk_name):
            cache_key = self.__get_lookup_cache_key(**{key: value})

            retval = cache.get(cache_key)
            if retval is None:
                result = self.get(**kwargs)
                # Ensure we're pushing it into the cache
                self.__post_save(instance=result)
                return result

            # If we didn't look up by pk we need to hit the reffed
            # key
            if key not in (pk_name, 'pk'):
                return self.get(pk=retval)

            return retval

    def get_or_create(self, _cache=False, **kwargs):
        """
        A modified version of Django's get_or_create which will create a distributed
        lock (using the cache backend) whenever it hits the create clause.
        """
        defaults = kwargs.pop('defaults', {})

        # before locking attempt to fetch the instance
        try:
            if _cache:
                return self.get_from_cache(**kwargs), False
            return self.get(**kwargs), False
        except self.model.DoesNotExist:
            pass
        lock_key = self.__make_key('lock', kwargs)

        # instance not found, lets grab a lock and attempt to create it
        with Lock(lock_key):
            # its important we get() before create() to ensure that if
            # someone beat us to creating it from the time we did our very
            # first .get(), that we get the result back as we cannot
            # rely on unique constraints existing
            instance, created = super(BaseManager, self).get_or_create(defaults=defaults, **kwargs)

        return instance, created

    def create_or_update(self, **kwargs):
        """
        Similar to get_or_create, either updates a row or creates it.

        The result will be (rows affected, False), if the row was not created,
        or (instance, True) if the object is new.
        """
        defaults = kwargs.pop('defaults', {})

        # before locking attempt to fetch the instance
        affected = self.filter(**kwargs).update(**defaults)
        if affected:
            return affected, False
        lock_key = self.__make_key('lock', kwargs)

        # instance not found, lets grab a lock and attempt to create it
        with Lock(lock_key) as lock:
            if lock.was_locked:
                affected = self.filter(**kwargs).update(**defaults)
                return affected, False

            for k, v in defaults.iteritems():
                if isinstance(v, ExpressionNode):
                    kwargs[k] = resolve_expression_node(self.model(), v)
            return self.create(**kwargs), True


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
            # XXX: if we cant do it atomicly let's do it the best we can
            sql = self.group.get_score()

        return (sql, [])


def count_limit(count):
    # TODO: could we do something like num_to_store = max(math.sqrt(100*count)+59, 200) ?
    # ~ 150 * ((log(n) - 1.5) ^ 2 - 0.25)
    for amount, sample_rate in settings.SAMPLE_RATES:
        if count <= amount:
            return sample_rate
    return settings.MAX_SAMPLE_RATE


def time_limit(silence):  # ~ 3600 per hour
    for amount, sample_rate in settings.SAMPLE_TIMES:
        if silence >= amount:
            return sample_rate
    return settings.MAX_SAMPLE_TIME


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

        field = self.model.messagecountbyminute_set.related
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

        queryset = instance.messagecountbyminute_set

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
        today -= datetime.timedelta(minutes=settings.MINUTE_NORMALIZATION)

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
            modifier = settings.MINUTE_NORMALIZATION
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
                results[item].append((int((dt).strftime('%s')) * 1000, tsdata.get(dt, 0)))

        if key is None:
            return results[None]
        return results


class GroupManager(BaseManager, ChartMixin):
    use_for_related_fields = True

    def _get_views(self, event):
        from sentry.models import View
        from sentry.views import View as ViewHandler

        views = set()
        for viewhandler in ViewHandler.objects.all():
            try:
                if not viewhandler.should_store(event):
                    continue

                path = '%s.%s' % (viewhandler.__module__, viewhandler.__class__.__name__)

                if not viewhandler.ref:
                    viewhandler.ref = View.objects.get_or_create(
                        _cache=True,
                        path=path,
                        defaults=dict(
                            verbose_name=viewhandler.verbose_name,
                            verbose_name_plural=viewhandler.verbose_name_plural,
                        ),
                    )[0]

                views.add(viewhandler.ref)

            except Exception, exc:
                # TODO: should we mail admins when there are failures?
                try:
                    logger.exception(exc)
                except Exception, exc:
                    warnings.warn(exc)

        return views

    @transaction.commit_on_success
    def from_kwargs(self, project, **kwargs):
        # TODO: this function is way too damn long and needs refactored
        # the inner imports also suck so let's try to move it away from
        # the objects manager
        from sentry.models import Event, Project

        project = Project.objects.get_from_cache(pk=project)

        # First we pull out our top-level (non-data attr) kwargs
        event_id = kwargs.pop('event_id', None)
        message = kwargs.pop('message', None)
        culprit = kwargs.pop('culprit', None)
        level = kwargs.pop('level', None) or logging.ERROR
        time_spent = kwargs.pop('time_spent', None)
        logger_name = kwargs.pop('logger', None) or settings.DEFAULT_LOGGER_NAME
        server_name = kwargs.pop('server_name', None)
        site = kwargs.pop('site', None)
        date = kwargs.pop('timestamp', None) or timezone.now()
        checksum = kwargs.pop('checksum', None)
        tags = kwargs.pop('tags', [])

        # full support for dict syntax
        if isinstance(tags, dict):
            tags = tags.items()

        # We must convert date to local time so Django doesn't mess it up
        # based on TIME_ZONE
        if dj_settings.TIME_ZONE:
            if not timezone.is_aware(date):
                date = date.replace(tzinfo=timezone.utc)
        elif timezone.is_aware(date):
            date = date.replace(tzinfo=None)

        data = kwargs

        kwargs = {
            'level': level,
            'message': message,
        }

        event = Event(
            project=project,
            event_id=event_id,
            culprit=culprit or '',
            logger=logger_name,
            data=data,
            server_name=server_name,
            site=site,
            time_spent=time_spent,
            datetime=date,
            **kwargs
        )

        # Calculcate the checksum from the first highest scoring interface
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

        views = self._get_views(event)

        try:
            group, is_new, is_sample = self._create_group(event, tags=tags, **group_kwargs)
        except Exception, exc:
            # TODO: should we mail admins when there are failures?
            try:
                logger.exception(u'Unable to process log entry: %s', exc)
            except Exception, exc:
                warnings.warn(u'Unable to process log entry: %s', exc)

            return

        event.group = group

        for view in views:
            group.views.add(view)

        # save the event unless its been sampled
        if not is_sample:
            try:
                event.save()
            except IntegrityError:
                transaction.rollback_unless_managed(using=group._state.db)
                return event

        transaction.commit_unless_managed(using=group._state.db)

        if settings.USE_SEARCH:
            try:
                maybe_delay(index_event, event)
            except Exception, e:
                transaction.rollback_unless_managed(using=group._state.db)
                logger.exception(u'Error indexing document: %s', e)

        if is_new:
            try:
                regression_signal.send(sender=self.model, instance=group)
            except Exception, e:
                transaction.rollback_unless_managed(using=group._state.db)
                logger.exception(u'Error sending regression signal: %s', e)

        send_group_processors(group=group, event=event, is_new=is_new, is_sample=is_sample)

        return event

    def _create_group(self, event, tags=None, **kwargs):
        from sentry.models import ProjectCountByMinute, MessageCountByMinute

        date = event.datetime
        time_spent = event.time_spent
        project = event.project

        try:
            group, is_new = self.get_or_create(
                project=project,
                culprit=event.culprit,
                logger=event.logger,
                checksum=event.checksum,
                defaults=kwargs
            )
        except self.model.MultipleObjectsReturned:
            # Fix for multiple groups existing due to a race
            groups = list(self.filter(
                project=project,
                culprit=event.culprit,
                logger=event.logger,
                checksum=event.checksum,
            ))
            for g in groups[1:]:
                g.delete()
            group, is_new = groups[0], False

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
            message = kwargs.get('message')
            if message:
                extra['message'] = message

            if group.status == STATUS_RESOLVED:
                # Group has changed from resolved -> unresolved
                is_new = True

                # We have to perform this update inline, as waiting on buffers means
                # this event could be treated as "new" several times
                group.update(active_at=date, status=STATUS_UNRESOLVED)

            group.last_seen = extra['last_seen']

            silence_timedelta = date - group.last_seen
            silence = silence_timedelta.days * 86400 + silence_timedelta.seconds

            app.buffer.incr(self.model, update_kwargs, {
                'pk': group.pk,
            }, extra)
        else:
            # TODO: this update should actually happen as part of create
            group.update(score=ScoreClause(group))
            silence = 0

            # We need to commit because the queue can run too fast and hit
            # an issue with the group not existing before the buffers run
            transaction.commit_unless_managed(using=group._state.db)

        # Determine if we've sampled enough data to store this event
        if is_new:
            is_sample = False
        elif not settings.SAMPLE_DATA or group.times_seen % min(count_limit(group.times_seen), time_limit(silence)) == 0:
            is_sample = False
        else:
            is_sample = True

        # Rounded down to the nearest interval
        if settings.MINUTE_NORMALIZATION:
            minutes = (date.minute - (date.minute % settings.MINUTE_NORMALIZATION))
        else:
            minutes = date.minute
        normalized_datetime = date.replace(second=0, microsecond=0, minute=minutes)

        app.buffer.incr(MessageCountByMinute, update_kwargs, {
            'group': group,
            'project': project,
            'date': normalized_datetime,
        })

        app.buffer.incr(ProjectCountByMinute, update_kwargs, {
            'project': project,
            'date': normalized_datetime,
        })

        if not tags:
            tags = []
        else:
            tags = list(tags)

        tags += [('logger', event.logger)]

        self.add_tags(group, tags)

        return group, is_new, is_sample

    def add_tags(self, group, tags):
        from sentry.models import FilterValue, FilterKey, MessageFilterValue

        project = group.project
        date = group.last_seen

        for key, value in itertools.ifilter(lambda x: bool(x[1]), tags):
            if len(value) > MAX_TAG_LENGTH:
                continue

            # TODO: FilterKey and FilterValue queries should be create's under a try/except
            FilterKey.objects.get_or_create(
                project=project,
                key=key,
            )

            FilterValue.objects.get_or_create(
                project=project,
                key=key,
                value=value,
            )

            app.buffer.incr(MessageFilterValue, {
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

    def get_accelerated(self, queryset=None, minutes=15):
        # mintues should
        from sentry.models import MessageCountByMinute
        mcbm_tbl = MessageCountByMinute._meta.db_table
        if queryset is None:
            queryset = self

        normalization = float(settings.MINUTE_NORMALIZATION)
        assert minutes >= normalization

        engine = get_db_engine(queryset.db)
        # We technically only support mysql and postgresql, since there seems to be no standard
        # way to get the epoch from a datetime/interval
        if engine.startswith('mysql'):
            minute_clause = "interval %s minute"
            epoch_clause = "unix_timestamp(utc_timestamp()) - unix_timestamp(%(mcbm_tbl)s.date)"
            now_clause = 'utc_timestamp()'
        else:
            minute_clause = "interval '%s minutes'"
            epoch_clause = "extract(epoch from now()) - extract(epoch from %(mcbm_tbl)s.date)"
            now_clause = 'now()'

        epoch_clause = epoch_clause % dict(mcbm_tbl=mcbm_tbl)

        queryset = queryset.extra(
            where=[
                "%s.date >= %s - %s" % (mcbm_tbl, now_clause, minute_clause % (minutes + 1, )),
                "%s.date <= %s - %s" % (mcbm_tbl, now_clause, minute_clause % (1, ))
            ],
        ).annotate(x=Sum('messagecountbyminute__times_seen')).order_by('id')

        sql, params = queryset.query.get_compiler(queryset.db).as_sql()
        before_select, after_select = str(sql).split('SELECT ', 1)
        before_where, after_where = after_select.split(' WHERE ', 1)
        before_group, after_group = after_where.split(' GROUP BY ', 1)

        # Ensure we remove any ordering clause
        after_group = after_group.split(' ORDER BY ')[0]

        query = """
        SELECT (SUM(%(mcbm_tbl)s.times_seen) * (%(norm)f / (%(epoch_clause)s / 60)) + 1.0) / (COALESCE(z.rate, 0) + 1.0) as accel,
               (COALESCE(z.rate, 0) + 1.0) as prev_rate,
               %(before_where)s
        LEFT JOIN (SELECT a.group_id, SUM(a.times_seen) / COUNT(a.times_seen) / %(norm)f as rate
            FROM %(mcbm_tbl)s as a
            WHERE a.date BETWEEN %(now)s - %(max_time)s
            AND %(now)s - %(min_time)s
            GROUP BY a.group_id) as z
        ON z.group_id = %(mcbm_tbl)s.group_id
        WHERE %(mcbm_tbl)s.date BETWEEN %(now)s - %(min_time)s
        AND %(now)s - %(offset_time)s
        AND %(before_group)s
        GROUP BY prev_rate, %(mcbm_tbl)s.date, %(after_group)s
        HAVING SUM(%(mcbm_tbl)s.times_seen) > 0
        ORDER BY accel DESC
        """ % dict(
            mcbm_tbl=mcbm_tbl,
            before_where=before_where,
            before_group=before_group,
            after_group=after_group,
            offset_time=minute_clause % (1,),
            min_time=minute_clause % (minutes + 1,),
            max_time=minute_clause % (minutes * (60 / normalization),),
            norm=normalization,
            epoch_clause=epoch_clause,
            now=now_clause,
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
    pass


class MetaManager(BaseManager):
    NOTSET = object()

    def __init__(self, *args, **kwargs):
        super(MetaManager, self).__init__(*args, **kwargs)
        request_finished.connect(self.clear_cache)

    def get_value(self, key, default=NOTSET):
        result = self.get_all_values()
        if default is self.NOTSET:
            return result[key]
        return result.get(key, default)

    def unset_value(self, key):
        self.filter(key=key).delete()
        if not hasattr(self, '_metadata'):
            return
        self._metadata.pop(key, None)

    def set_value(self, key, value):
        inst, created = self.get_or_create(
            key=key,
            defaults={
                'value': value,
            }
        )
        if not created and inst.value != value:
            inst.update(value=value)

        if not hasattr(self, '_metadata'):
            return
        self._metadata[key] = value

    def get_all_values(self):
        if not hasattr(self, '_metadata'):
            self._metadata = dict((i.key, i.value) for i in self.all())
        return self._metadata

    def clear_cache(self, **kwargs):
        self._metadata = {}


class InstanceMetaManager(BaseManager):
    NOTSET = object()

    def __init__(self, field_name, *args, **kwargs):
        super(InstanceMetaManager, self).__init__(*args, **kwargs)
        self.field_name = field_name
        request_finished.connect(self.clear_cache)

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
        if not hasattr(self, '_metadata'):
            return
        if instance.pk not in self._metadata:
            return
        self._metadata[instance.pk].pop(key, None)

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

        if not hasattr(self, '_metadata'):
            return
        if instance.pk not in self._metadata:
            return
        self._metadata[instance.pk][key] = value

    def get_all_values(self, instance):
        if not hasattr(self, '_metadata'):
            self._metadata = {}
        if instance.pk not in self._metadata:
            result = dict(
                (i.key, i.value) for i in
                self.filter(**{
                    self.field_name: instance,
                })
            )
            self._metadata[instance.pk] = result
        return self._metadata[instance.pk]

    def clear_cache(self, **kwargs):
        self._metadata = {}


class UserOptionManager(BaseManager):
    NOTSET = object()

    def __init__(self, *args, **kwargs):
        super(UserOptionManager, self).__init__(*args, **kwargs)
        request_finished.connect(self.clear_cache)

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
        if metakey not in self._metadata:
            return
        self._metadata[metakey].pop(key, None)

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

        if not hasattr(self, '_metadata'):
            return
        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self._metadata:
            return
        self._metadata[metakey][key] = value

    def get_all_values(self, user, project):
        if not hasattr(self, '_metadata'):
            self._metadata = {}
        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self._metadata:
            result = dict(
                (i.key, i.value) for i in
                self.filter(
                    user=user,
                    project=project,
                )
            )
            self._metadata[metakey] = result
        return self._metadata[metakey]

    def clear_cache(self, **kwargs):
        self._metadata = {}


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

        words = [t[:128] for t in text.split() if len(t) >= self.MIN_WORD_LENGTH and t.lower() not in self.STOP_WORDS]

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
            SELECT sd.id AS id,
                   sd.group_id AS group_id,
                   SUM(st.times_seen) / sd.total_events as score,
                   sd.date_changed AS date_changed,
                   sd.date_added AS date_added
            FROM sentry_searchdocument as sd
            INNER JOIN sentry_searchtoken as st
                ON st.document_id = sd.id
            WHERE %s
                sd.project_id = %s
            GROUP BY sd.id, sd.group_id, sd.total_events, sd.date_changed, sd.date_added
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
            document.update(
                status=group.status,
                total_events=F('total_events') + 1,
                date_changed=group.last_seen,
            )

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
            for value in values:
                if not value:
                    continue
                token_counts[field][value.lower()] += 1

        # TODO: might be worthwhile to make this update then create
        for field, tokens in token_counts.iteritems():
            for token, count in tokens.iteritems():
                token, created = document.token_set.get_or_create(
                    field=field,
                    token=token,
                    defaults={
                        'times_seen': count,
                    }
                )
                if not created:
                    token.update(
                        times_seen=F('times_seen') + count,
                    )

        return document


class FilterKeyManager(BaseManager):
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
    def get_for_user(self, user, access=None):
        """
        Returns a SortedDict of all teams a user has some level of access to.

        Each <Team> returned has a ``membership`` attribute which holds the
        <TeamMember> instance.
        """
        from sentry.models import TeamMember

        if not user.is_authenticated():
            return SortedDict()

        qs = TeamMember.objects.filter(
            user=user,
            is_active=True,
        ).select_related('team')
        if access is not None:
            qs = qs.filter(type__lte=access)

        results = SortedDict()
        for tm in sorted(qs, key=lambda x: x.team.name):
            team = tm.team
            team.membership = tm
            results[team.slug] = team

        return results
