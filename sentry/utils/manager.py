"""
sentry.utils.manager
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import logging
import warnings

from django.db import models
from django.db.models import Sum, F

from sentry.conf import settings
from sentry.signals import regression_signal
from sentry.utils import construct_checksum, get_db_engine, should_mail
from sentry.utils.charts import has_charts
from sentry.utils.compat.db import connections

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
    if count <= 50: # 200
        return 1
    if count <= 1000: # 400
        return 2
    if count <= 10000: # 900
        return 10
    if count <= 100000: # 1800
        return 50
    if count <= 1000000: # 3000
        return 300
    if count <= 10000000: # 4500
        return 2000
    return 10000

def time_limit(silence): # ~ 3600 per hour
    if silence >= 3600:
        return 1
    if silence >= 360:
        return 10
    if silence >= 60:
        return 60
    return 10000

class GroupManager(models.Manager):
    use_for_related_fields = True

    def convert_legacy_kwargs(self, kwargs):
        from sentry.interfaces import Http, User, Exception, Stacktrace, Template
        from sentry.utils.template_info import get_template_info

        date = kwargs.pop('timestamp', None)

        data = kwargs.pop('data', {}) or {}
        sentry = data.get('__sentry__', {})
        message_id = kwargs.pop('message_id', None)

        if 'version' in sentry and 'module' in sentry:
            version = [sentry['module'], sentry['version']]
        else:
            version = None

        extra = {}

        data = {
            'version': version,
        }

        if 'url' in data or 'url' in kwargs and 'META' in sentry:
            meta = sentry['META']
            data['sentry.interfaces.Http'] = Http(
                url=data.get('url', kwargs['url']),
                method=meta['REQUEST_METHOD'],
                query_string=meta['QUERY_STRING'],
                data=meta.get('POST') or meta.get('GET'),
            ).serialize()

        if 'user' in sentry:
            user = sentry['user']
            data['sentry.interfaces.User'] = User(
                **user
            ).serialize()

        if 'exception' in sentry:
            exc = sentry['exception']
            data['sentry.interfaces.Exception'] = Exception(
                type=exc[0],
                value=' '.join(exc[1]),
            ).serialize()

        if 'frames' in sentry:
            frames = []
            keys = ('filename', 'function', 'vars', 'pre_context', 'context_line', 'post_context', 'lineno')
            for frame in sentry['frames']:
                frames.append(dict((k, v) for k, v in frame.iteritems() if k in keys))

            data['sentry.interfaces.Traceback'] = Stacktrace(
                frames=frames,
            ).serialize()

        if 'template' in sentry:
            template = sentry['template']
            data['sentry.interfaces.Template'] = Template(
                **get_template_info(template)
            ).serialize()


        return {
            'culprit': kwargs.pop('view', None),
            'date': date,
            'event_id': message_id,
            'data': data,
            'extra': extra,
        }

    def from_kwargs(self, project, **kwargs):
        from sentry.models import Event, FilterValue, Project

        view = kwargs.pop('view', None)
        if view:
            # assume legacy
            kwargs = self.convert_legacy_kwargs(kwargs)

        culprit = kwargs.pop('culprit', None)

        logger_name = kwargs.pop('logger', 'root')
        server_name = kwargs.pop('server_name', None)
        site = kwargs.pop('site', None)
        project = Project.objects.get(pk=project)

        date = kwargs.pop('date', None) or datetime.datetime.now()

        data = kwargs.pop('data', None) or {}
        event_id = kwargs.pop('event_id', None)

        checksum = kwargs.pop('checksum', None)
        if not checksum:
            checksum = construct_checksum(**kwargs)

        mail = False
        try:
            if 'extra' in kwargs:
                data['extra'] = kwargs.pop('extra')
            kwargs['data'] = data

            group_kwargs = kwargs.copy()
            group_kwargs.update({
                'last_seen': date,
                'first_seen': date,
            })

            group, created = self.get_or_create(
                project=project,
                culprit=culprit,
                logger=logger_name,
                checksum=checksum,
                # we store some sample data for rendering
                defaults=group_kwargs
            )
            kwargs.pop('data', None)
            if not created:
                # HACK: maintain appeared state
                if group.status == 1:
                    mail = True
                silence_timedelta = date - group.last_seen
                silence = silence_timedelta.days * 86400 + silence_timedelta.seconds
                group.update(status=0, last_seen=date, times_seen=F('times_seen') + 1, score=ScoreClause(group))
            else:
                group.update(score=ScoreClause(group))
                silence = 0
                mail = True

            instance = Event(
                project=project,
                event_id=event_id,
                culprit=culprit,
                logger=logger_name,
                data=data,
                server_name=server_name,
                site=site,
                checksum=checksum,
                group=group,
                datetime=date,
                **kwargs
            )

            if not settings.SAMPLE_DATA or group.times_seen % min(count_limit(group.times_seen), time_limit(silence)) == 0:
                instance.save()

            # rounded down to the nearest interval
            if settings.MINUTE_NORMALIZATION:
                minutes = (date.minute - (date.minute % settings.MINUTE_NORMALIZATION))
            else:
                minutes = date.minute
            normalized_datetime = date.replace(second=0, microsecond=0, minute=minutes)

            affected = group.messagecountbyminute_set.filter(date=normalized_datetime).update(times_seen=F('times_seen') + 1)
            if not affected:
                group.messagecountbyminute_set.create(
                    project=project,
                    date=normalized_datetime,
                    times_seen=1,
                )

            for key, value in (
                    ('server_name', server_name),
                    ('site', site),
                    ('logger', logger_name),
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

        except Exception, exc:
            # TODO: should we mail admins when there are failures?
            try:
                logger.exception(u'Unable to process log entry: %s' % (exc,))
            except Exception, exc:
                warnings.warn(u'Unable to process log entry: %s' % (exc,))
        else:
            if mail and should_mail(group):
                regression_signal.send(sender=self.model, instance=group)
                group.mail_admins()

            return instance

    def get_by_natural_key(self, logger, culprit, checksum):
        return self.get(logger=logger, view=culprit, checksum=checksum)

    def get_chart_data(self, group, max_days=90):
        if hasattr(group, '_state'):
            db = group._state.db
        else:
            db = 'default'

        if not has_charts(db):
            return []

        conn = connections[db]

        engine = get_db_engine(db)
        # TODO: does extract work for sqlite?
        if engine.startswith('oracle'):
            method = conn.ops.date_trunc_sql('hh24', 'date')
        else:
            method = conn.ops.date_trunc_sql('hour', 'date')

        hours = max_days*24
        today = datetime.datetime.now().replace(microsecond=0, second=0, minute=0)
        min_date = today - datetime.timedelta(hours=hours)

        chart_qs = list(group.messagecountbyminute_set.all()\
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

        return [rows.get(today-datetime.timedelta(hours=d), 0) for d in xrange(first_seen, -1, -1)]
