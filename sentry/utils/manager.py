"""
sentry.utils.manager
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import django
import logging
import warnings

from django.db import models
from django.db.models import signals, Sum, F

from sentry.conf import settings
from sentry.signals import regression_signal
from sentry.utils import construct_checksum, get_db_engine, should_mail
from sentry.utils.charts import has_charts
from sentry.utils.compat.db import connections

assert not settings.DATABASE_USING or django.VERSION >= (1, 2), 'The `SENTRY_DATABASE_USING` setting requires Django >= 1.2'

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

class SentryManager(models.Manager):
    use_for_related_fields = True

    def get_query_set(self):
        qs = super(SentryManager, self).get_query_set()
        if settings.DATABASE_USING:
            qs = qs.using(settings.DATABASE_USING)
        return qs


    def from_kwargs(self, **kwargs):
        from sentry.models import Message, GroupedMessage, FilterValue

        URL_MAX_LENGTH = Message._meta.get_field_by_name('url')[0].max_length
        now = kwargs.pop('timestamp', None) or datetime.datetime.now()

        view = kwargs.pop('view', None)
        logger_name = kwargs.pop('logger', 'root')
        url = kwargs.pop('url', None)
        server_name = kwargs.pop('server_name', settings.CLIENT)
        site = kwargs.pop('site', None)
        data = kwargs.pop('data', {}) or {}
        message_id = kwargs.pop('message_id', None)

        if url:
            data['url'] = url
            url = url[:URL_MAX_LENGTH]

        checksum = kwargs.pop('checksum', None)
        if not checksum:
            checksum = construct_checksum(**kwargs)

        mail = False
        try:
            kwargs['data'] = {}

            if 'url' in data:
                kwargs['data']['url'] = data['url']
            if 'version' in data.get('__sentry__', {}):
                kwargs['data']['version'] = data['__sentry__']['version']
            if 'module' in data.get('__sentry__', {}):
                kwargs['data']['module'] = data['__sentry__']['module']

            group_kwargs = kwargs.copy()
            group_kwargs.update({
                'last_seen': now,
                'first_seen': now,
            })

            group, created = GroupedMessage.objects.get_or_create(
                view=view,
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
                silence_timedelta = now - group.last_seen
                silence = silence_timedelta.days * 86400 + silence_timedelta.seconds
                group.status = 0
                group.last_seen = now
                group.times_seen += 1
                GroupedMessage.objects.filter(pk=group.pk).update(
                    times_seen=F('times_seen') + 1,
                    status=0,
                    last_seen=now,
                    score=ScoreClause(group),
                )
                signals.post_save.send(sender=GroupedMessage, instance=group, created=False)
            else:
                GroupedMessage.objects.filter(pk=group.pk).update(
                    score=ScoreClause(group),
                )
                silence = 0
                mail = True

            instance = Message(
                message_id=message_id,
                view=view,
                logger=logger_name,
                data=data,
                url=url,
                server_name=server_name,
                site=site,
                checksum=checksum,
                group=group,
                datetime=now,
                **kwargs
            )

            if not settings.SAMPLE_DATA or group.times_seen % min(count_limit(group.times_seen), time_limit(silence)) == 0:
                instance.save()

            # rounded down to the nearest interval
            if settings.MINUTE_NORMALIZATION:
                minutes = (now.minute - (now.minute % settings.MINUTE_NORMALIZATION))
            else:
                minutes = now.minute
            normalized_datetime = now.replace(second=0, microsecond=0, minute=minutes)

            affected = group.messagecountbyminute_set.filter(date=normalized_datetime).update(times_seen=F('times_seen') + 1)
            if not affected:
                group.messagecountbyminute_set.create(
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

                FilterValue.objects.get_or_create(key=key, value=value)

                affected = group.messagefiltervalue_set.filter(key=key, value=value).update(times_seen=F('times_seen') + 1)
                if not affected:
                    group.messagefiltervalue_set.create(
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
                regression_signal.send(sender=GroupedMessage, instance=group)
                group.mail_admins()

            return instance

class GroupedMessageManager(SentryManager):
    def get_by_natural_key(self, logger, view, checksum):
        return self.get(logger=logger, view=view, checksum=checksum)

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
