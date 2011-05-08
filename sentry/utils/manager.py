import datetime
import django
import logging
import warnings

from django.db import models
from django.db.models import signals

from sentry.conf import settings
from sentry.utils import construct_checksum, get_db_engine

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
                group.status = 0
                group.last_seen = now
                group.times_seen += 1
                GroupedMessage.objects.filter(pk=group.pk).update(
                    times_seen=models.F('times_seen') + 1,
                    status=0,
                    last_seen=now,
                    score=ScoreClause(group),
                )
                signals.post_save.send(sender=GroupedMessage, instance=group, created=False)
            else:
                GroupedMessage.objects.filter(pk=group.pk).update(
                    score=ScoreClause(group),
                )
                mail = True

                
            instance = Message.objects.create(
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
            if server_name:
                FilterValue.objects.get_or_create(key='server_name', value=server_name)
            if site:
                FilterValue.objects.get_or_create(key='site', value=site)
            if logger_name:
                FilterValue.objects.get_or_create(key='logger', value=logger_name)
        except Exception, exc:
            # TODO: should we mail admins when there are failures?
            try:
                logger.exception(u'Unable to process log entry: %s' % (exc,))
            except Exception, exc:
                warnings.warn(u'Unable to process log entry: %s' % (exc,))
        else:
            if mail:
                group.mail_admins()
            return instance

class GroupedMessageManager(SentryManager):
    def get_by_natural_key(self, logger, view, checksum):
        return self.get(logger=logger, view=view, checksum=checksum)