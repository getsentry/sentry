"""
sentry.manager
~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from collections import defaultdict
import datetime
import hashlib
import itertools
import logging
import re
import warnings

from django.db import models
from django.db.models import Sum, F

from sentry.conf import settings
from sentry.exceptions import InvalidInterface, InvalidData
from sentry.signals import regression_signal
from sentry.utils import get_db_engine
from sentry.utils.charts import has_charts
from sentry.utils.compat.db import connections
from sentry.utils.dates import utc_to_local
from sentry.processors.base import send_group_processors

logger = logging.getLogger('sentry.errors')


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
    if count <= 50:  # 200
        return 1
    if count <= 1000:  # 400
        return 2
    if count <= 10000:  # 900
        return 10
    if count <= 100000:  # 1800
        return 50
    if count <= 1000000:  # 3000
        return 300
    if count <= 10000000:  # 4500
        return 2000
    return 10000


def time_limit(silence):  # ~ 3600 per hour
    if silence >= 3600:
        return 1
    if silence >= 360:
        return 10
    if silence >= 60:
        return 60
    return 10000


class ModuleProxyCache(dict):
    def __missing__(self, key):
        module, class_name = key.rsplit('.', 1)

        handler = getattr(__import__(module, {}, {}, [class_name], -1), class_name)

        self[key] = handler

        return handler


class ChartMixin(object):
    def _get_date_trunc(self, col, db='default'):
        conn = connections[db]

        engine = get_db_engine(db)
        # TODO: does extract work for sqlite?
        if engine.startswith('oracle'):
            method = conn.ops.date_trunc_sql('hh24', col)
        else:
            method = conn.ops.date_trunc_sql('hour', col)

        return method

    def get_chart_data(self, instance, max_days=90):
        if hasattr(instance, '_state'):
            db = instance._state.db
        else:
            db = 'default'

        if not has_charts(db):
            return []

        hours = max_days * 24
        today = datetime.datetime.utcnow().replace(microsecond=0, second=0, minute=0)
        min_date = today - datetime.timedelta(hours=hours)

        method = self._get_date_trunc('date', db)

        chart_qs = list(instance.messagecountbyminute_set\
                          .filter(date__gte=min_date)\
                          .extra(select={'grouper': method}).values('grouper')\
                          .annotate(num=Sum('times_seen')).values_list('grouper', 'num')\
                          .order_by('grouper'))

        if not chart_qs:
            return []

        rows = dict(chart_qs)

        #just skip zeroes
        first_seen = hours
        while not rows.get(today - datetime.timedelta(hours=first_seen)) and first_seen > 24:
            first_seen -= 1

        return [rows.get(today - datetime.timedelta(hours=d), 0) for d in xrange(first_seen, -1, -1)]


class GroupManager(models.Manager, ChartMixin):
    use_for_related_fields = True

    def __init__(self, *args, **kwargs):
        super(GroupManager, self).__init__(*args, **kwargs)
        self.module_cache = ModuleProxyCache()

    def convert_legacy_kwargs(self, kwargs):
        from sentry.interfaces import Http, User, Exception, Stacktrace, Template
        from sentry.utils.template_info import get_template_info

        data = kwargs.pop('data', None) or {}
        sentry = data.pop('__sentry__', None) or {}

        result = {
            'event_id': kwargs.pop('message_id', None),
            'level': kwargs.pop('level', None),
            'logger': kwargs.pop('logger', None),
            'server_name': kwargs.pop('server_name', None),
            'message': kwargs.pop('message', ''),
            'culprit': kwargs.pop('view', None),
            'timestamp': kwargs.pop('timestamp', None),
        }

        result = dict((k, v) for k, v in result.iteritems() if v is not None)

        class_name = kwargs.pop('class_name', None)
        if class_name:
            result['message'] = '%s: %s' % (class_name, result['message'])

        if 'url' in data or 'url' in kwargs and 'META' in data:
            meta = data.pop('META', {})
            if 'GET' in data:
                del data['GET']
            result['sentry.interfaces.Http'] = Http(
                url=data.pop('url', None) or kwargs['url'],
                method=meta.get('REQUEST_METHOD'),
                query_string=meta.get('QUERY_STRING'),
                data=data.pop('POST', None),
                cookies=data.pop('COOKIES', None),
                env=meta,
            ).serialize()

        if 'user' in sentry:
            user = sentry['user']
            result['sentry.interfaces.User'] = User(
                **user
            ).serialize()

        if 'exception' in sentry:
            exc = sentry['exception']
            result['sentry.interfaces.Exception'] = Exception(
                type=exc[0],
                value=u' '.join(itertools.imap(unicode, exc[1])),
            ).serialize()

        if 'frames' in sentry:
            frames = []
            keys = ('filename', 'function', 'vars', 'pre_context', 'context_line', 'post_context', 'lineno')
            for frame in sentry['frames']:
                if 'vars' in frame:
                    frame['vars'] = dict(frame['vars'])
                frames.append(dict((k, v) for k, v in frame.iteritems() if k in keys))

            if frames:
                result['sentry.interfaces.Stacktrace'] = Stacktrace(
                    frames=frames,
                ).serialize()

        if 'template' in sentry:
            template = sentry['template']
            result['sentry.interfaces.Template'] = Template(
                **get_template_info(template)
            ).serialize()

        result['extra'] = data
        return result

    def from_kwargs(self, project, **kwargs):
        # TODO: this function is way too damn long and needs refactored
        # the inner imports also suck so let's try to move it away from
        # the objects manager
        from sentry.models import Event, Project, View, SearchDocument
        from sentry.views import View as ViewHandler

        project = Project.objects.get(pk=project)

        if any(k in kwargs for k in ('view', 'message_id')):
            # we must be passing legacy data, let's convert it
            kwargs = self.convert_legacy_kwargs(kwargs)

        # First we pull out our top-level (non-data attr) kwargs
        event_id = kwargs.pop('event_id', None)
        message = kwargs.pop('message', None)
        culprit = kwargs.pop('culprit', None)
        level = kwargs.pop('level', None) or logging.ERROR
        time_spent = kwargs.pop('time_spent', None)
        logger_name = kwargs.pop('logger', 'root')
        server_name = kwargs.pop('server_name', None)
        site = kwargs.pop('site', None)
        date = kwargs.pop('timestamp', None) or datetime.datetime.utcnow()
        extra = kwargs.pop('extra', None)
        modules = kwargs.pop('modules', None)

        # We must convert date to local time so Django doesn't mess it up
        # based on TIME_ZONE
        date = utc_to_local(date)

        if not message:
            raise InvalidData('Missing required parameter: message')

        checksum = kwargs.pop('checksum', None)
        if not checksum:
            checksum = hashlib.md5(message).hexdigest()

        data = kwargs

        for k, v in kwargs.iteritems():
            if '.' not in k:
                raise InvalidInterface('%r is not a valid interface name' % k)
            try:
                interface = self.module_cache[k]
            except ImportError, e:
                raise InvalidInterface('%r is not a valid interface name: %s' % (k, e))

            try:
                data[k] = interface(**v).serialize()
            except Exception, e:
                raise InvalidData('Unable to validate interface, %r: %s' % (k, e))

        data['modules'] = modules

        # TODO: at this point we should validate what is left in kwargs (it should either
        #       be an interface or it should be in ``extra``)
        if extra:
            data['extra'] = extra

        kwargs = {
            'level': level,
            'message': message,
        }

        event = Event(
            project=project,
            event_id=event_id,
            culprit=culprit,
            logger=logger_name,
            data=data,
            server_name=server_name,
            site=site,
            checksum=checksum,
            time_spent=time_spent,
            datetime=date,
            **kwargs
        )

        group_kwargs = kwargs.copy()
        group_kwargs.update({
            'last_seen': date,
            'first_seen': date,
            'time_spent_total': time_spent or 0,
            'time_spent_count': time_spent and 1 or 0,
        })

        views = set()
        for viewhandler in ViewHandler.objects.all():
            try:
                if not viewhandler.should_store(event):
                    continue

                path = '%s.%s' % (viewhandler.__module__, viewhandler.__class__.__name__)

                if not viewhandler.ref:
                    # TODO: this should handle race conditions
                    viewhandler.ref = View.objects.get_or_create(
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

        try:
            group, is_new, is_sample = self._create_group(event, **group_kwargs)
        except Exception, exc:
            # TODO: should we mail admins when there are failures?
            try:
                logger.exception(u'Unable to process log entry: %s' % (exc,))
            except Exception, exc:
                warnings.warn(u'Unable to process log entry: %s' % (exc,))

            return

        event.group = group

        for view in views:
            group.views.add(view)

        # save the event unless its been sampled
        if not is_sample:
            event.save()

        if settings.USE_SEARCH:
            try:
                SearchDocument.objects.index(event)
            except Exception, e:
                logger.exception(u'Error indexing document: %s', e)

        if is_new:
            try:
                regression_signal.send(sender=self.model, instance=group)
            except Exception, e:
                logger.exception(u'Error sending regression signal: %s', e)

        send_group_processors(group=group, event=event, is_new=is_new, is_sample=is_sample)

        return event

    def _create_group(self, event, **kwargs):
        from sentry.models import FilterValue, STATUS_RESOLVED

        date = event.datetime
        time_spent = event.time_spent
        project = event.project

        group, is_new = self.get_or_create(
            project=project,
            culprit=event.culprit,
            logger=event.logger,
            checksum=event.checksum,
            defaults=kwargs
        )
        if not is_new:
            if group.status == STATUS_RESOLVED:
                # Group has changed from resolved -> unresolved
                is_new = True
            silence_timedelta = date - group.last_seen
            silence = silence_timedelta.days * 86400 + silence_timedelta.seconds
            update_kwargs = {
                'status': 0,
                'last_seen': date,
                'times_seen': F('times_seen') + 1,
                'score': ScoreClause(group),
            }
            if time_spent:
                update_kwargs.update({
                    'time_spent_total': F('time_spent_total') + time_spent,
                    'time_spent_count': F('time_spent_count') + 1,
                })
            group.update(**update_kwargs)
        else:
            group.update(score=ScoreClause(group))
            silence = 0

        # Determine if we've sampled enough data to store this event
        if not settings.SAMPLE_DATA or group.times_seen % min(count_limit(group.times_seen), time_limit(silence)) == 0:
            is_sample = False
        else:
            is_sample = True

        # Rounded down to the nearest interval
        if settings.MINUTE_NORMALIZATION:
            minutes = (date.minute - (date.minute % settings.MINUTE_NORMALIZATION))
        else:
            minutes = date.minute
        normalized_datetime = date.replace(second=0, microsecond=0, minute=minutes)

        update_kwargs = {
            'times_seen': F('times_seen') + 1,
        }
        if time_spent:
            update_kwargs.update({
                'time_spent_total': F('time_spent_total') + time_spent,
                'time_spent_count': F('time_spent_count') + 1,
            })

        affected = group.messagecountbyminute_set.filter(date=normalized_datetime).update(**update_kwargs)
        if not affected:
            group.messagecountbyminute_set.create(
                project=project,
                date=normalized_datetime,
                times_seen=1,
                time_spent_total=time_spent or 0,
                time_spent_count=time_spent and 1 or 0,
            )

        http = event.interfaces.get('sentry.interfaces.Http')
        if http:
            url = http.url
        else:
            url = None

        for key, value in (
                ('server_name', event.server_name),
                ('site', event.site),
                ('url', url),
            ):
            if not value:
                continue

            FilterValue.objects.get_or_create(
                project=project,
                key=key,
                value=value,
            )

            affected = group.messagefiltervalue_set.filter(key=key, value=value).update(times_seen=F('times_seen') + 1)
            if not affected:
                group.messagefiltervalue_set.create(
                    project=project,
                    key=key,
                    value=value,
                    times_seen=1,
                )

        return group, is_new, is_sample

    def get_by_natural_key(self, logger, culprit, checksum):
        return self.get(logger=logger, view=culprit, checksum=checksum)

    def get_accelerated(self, queryset=None, minutes=15):
        # mintues should
        from sentry.models import MessageCountByMinute
        mcbm_tbl = MessageCountByMinute._meta.db_table
        if queryset is None:
            queryset = self

        assert minutes >= settings.MINUTE_NORMALIZATION

        queryset = queryset.extra(where=["%s.date >= now() - interval '%s minutes'" % (mcbm_tbl, minutes)]).annotate(x=Sum('messagecountbyminute__times_seen'))
        sql, params = queryset.query.get_compiler(queryset.db).as_sql()
        before_select, after_select = str(sql).split('SELECT ', 1)
        before_where, after_where = after_select.split(' WHERE ', 1)
        before_group, after_group = after_where.split(' GROUP BY ', 1)

        query = """
        SELECT (SUM(%(mcbm_tbl)s.times_seen) + 1.0) / (COALESCE(z.accel, 0) + 1.0) as accel, z.accel as prev_accel, %(before_where)s
        LEFT JOIN (SELECT a.group_id, SUM(a.times_seen) / 3.0 as accel FROM %(mcbm_tbl)s as a WHERE a.date BETWEEN now() - interval '%(max_time)s minutes' AND now() - interval '%(min_time)s minutes'
        GROUP BY a.group_id) as z ON z.group_id = %(mcbm_tbl)s.group_id WHERE %(before_group)s GROUP BY prev_accel, %(after_group)s HAVING SUM(%(mcbm_tbl)s.times_seen) > 0 ORDER BY accel DESC
        """ % dict(
            mcbm_tbl=mcbm_tbl,
            before_where=before_where,
            before_group=before_group,
            after_group=after_group,
            min_time=minutes + 1,
            max_time=minutes * 4,
        )

        return RawQuerySet(self, query, params)


class RawQuerySet(object):
    def __init__(self, queryset, query, params):
        self.queryset = queryset
        self.query = query
        self.params = params

    def __getitem__(self, k):
        offset = k.start
        limit = k.stop - k.start

        limit_clause = ' LIMIT %d OFFSET %d' % (limit, offset)

        query = self.query + limit_clause

        return self.queryset.raw(query, self.params)


class ProjectManager(models.Manager, ChartMixin):
    pass


class MetaManager(models.Manager):
    NOTSET = object()

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
            self._metadata = dict(self.values_list('key', 'value'))
        return self._metadata


class InstanceMetaManager(models.Manager):
    NOTSET = object()

    def __init__(self, field_name, *args, **kwargs):
        super(InstanceMetaManager, self).__init__(*args, **kwargs)
        self.field_name = field_name

    def get_value_bulk(self, instances, key):
        return dict(self.filter(**{
            '%s__in' % self.field_name: instances,
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
            result = dict(self.filter(**{
                self.field_name: instance,
            }).values_list('key', 'value'))
            self._metadata[instance.pk] = result
        return self._metadata[instance.pk]


class SearchDocumentManager(models.Manager):
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

        sql = """
            SELECT sd.id, sd.group_id, SUM(st.times_seen) / sd.total_events as score,
                sd.date_changed, sd.date_added
            FROM sentry_searchdocument as sd
            INNER JOIN sentry_searchtoken as st
                ON st.document_id = sd.id
            WHERE st.token IN (%s)
                AND sd.project_id = %s
            GROUP BY sd.id, sd.group_id, sd.total_events, sd.date_changed, sd.date_added
            ORDER BY %s
            LIMIT %d OFFSET %d
        """ % (
            ', '.join('%s' for i in range(len(tokens))),
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
                values = itertools.chain(*[self._tokenize(v) for v in values])
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
