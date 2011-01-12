import datetime
import django
import logging
import warnings

from django.db import models
from django.db.models import signals

from sentry import conf
from sentry.helpers import construct_checksum

assert not conf.DATABASE_USING or django.VERSION >= (1, 2), 'The `SENTRY_DATABASE_USING` setting requires Django >= 1.2'

logger = logging.getLogger('sentry.errors')

class SentryManager(models.Manager):
    use_for_related_fields = True

    def get_query_set(self):
        qs = super(SentryManager, self).get_query_set()
        if conf.DATABASE_USING:
            qs = qs.using(conf.DATABASE_USING)
        return qs

    def from_kwargs(self, **kwargs):
        from sentry.models import Message, GroupedMessage, FilterValue
        
        URL_MAX_LENGTH = Message._meta.get_field_by_name('url')[0].max_length
        now = datetime.datetime.now()

        view = kwargs.pop('view', None)
        logger_name = kwargs.pop('logger', 'root')
        url = kwargs.pop('url', None)
        server_name = kwargs.pop('server_name', conf.CLIENT)
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

            group, created = GroupedMessage.objects.get_or_create(
                view=view,
                logger=logger_name,
                checksum=checksum,
                # we store some sample data for rendering
                defaults=kwargs
            )
            kwargs.pop('data', None)
            if not created:
                GroupedMessage.objects.filter(pk=group.pk).update(
                    times_seen=models.F('times_seen') + 1,
                    status=0,
                    last_seen=now,
                )
                # HACK: maintain appeared state
                if group.status == 1:
                    mail = True
                group.status = 0
                group.last_seen = now
                group.times_seen += 1
                signals.post_save.send(sender=GroupedMessage, instance=group, created=False)
            else: 
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