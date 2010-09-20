import datetime
import django
import logging
import warnings

from django.db import models
from django.db.models import signals
from django.template import TemplateSyntaxError
from django.views.debug import ExceptionReporter

from sentry import settings
from sentry.helpers import construct_checksum, transform, varmap

assert not settings.DATABASE_USING or django.VERSION >= (1, 2), 'The `SENTRY_DATABASE_USING` setting requires Django >= 1.2'

logger = logging.getLogger('sentry')

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
        now = datetime.datetime.now()

        view = kwargs.pop('view', None)
        logger_name = kwargs.pop('logger', 'root')
        url = kwargs.pop('url', None)
        server_name = kwargs.pop('server_name', settings.CLIENT)
        data = kwargs.pop('data', {}) or {}

        if url:
            data['url'] = url
            url = url[:URL_MAX_LENGTH]

        checksum = construct_checksum(**kwargs)

        mail = False
        try:
            group, created = GroupedMessage.objects.get_or_create(
                view=view,
                logger=logger_name,
                checksum=checksum,
                defaults=kwargs
            )
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
                view=view,
                logger=logger_name,
                data=data,
                url=url,
                server_name=server_name,
                checksum=checksum,
                group=group,
                **kwargs
            )
            FilterValue.objects.get_or_create(key='server_name', value=server_name)
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