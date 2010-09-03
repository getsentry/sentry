from django.conf import settings as dj_settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models, transaction
from django.core.signals import got_request_exception
from django.http import Http404
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from sentry import settings
from sentry.helpers import construct_checksum, get_installed_apps
from sentry.manager import SentryManager, GroupedMessageManager
from sentry.utils import GzippedDictField

import datetime
import logging
import sys
import traceback
import warnings

_reqs = ('paging', 'indexer')
for r in _reqs:
    if r not in dj_settings.INSTALLED_APPS:
        raise ImproperlyConfigured("Put '%s' in your "
            "INSTALLED_APPS setting in order to use the sentry application." % r)

try:
    from idmapper.models import SharedMemoryModel as Model
except ImportError:
    Model = models.Model

logger = logging.getLogger('sentry')

__all__ = ('Message', 'GroupedMessage')

STATUS_LEVELS = (
    (0, _('unresolved')),
    (1, _('resolved')),
)

class MessageBase(Model):
    logger          = models.CharField(max_length=64, blank=True, default='root', db_index=True)
    class_name      = models.CharField(_('type'), max_length=128, blank=True, null=True, db_index=True)
    level           = models.PositiveIntegerField(choices=settings.LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
    message         = models.TextField()
    traceback       = models.TextField(blank=True, null=True)
    view            = models.CharField(max_length=255, db_index=True, blank=True, null=True)
    checksum        = models.CharField(max_length=32, db_index=True)

    objects         = SentryManager()

    class Meta:
        abstract = True

    def shortened_traceback(self):
        return '\n'.join(self.traceback.split('\n')[-5:])
    shortened_traceback.short_description = _('traceback')
    shortened_traceback.admin_order_field = 'traceback'
    
    def error(self):
        if self.message:
            message = smart_unicode(self.message)
            if len(message) > 100:
                message = message[:97] + '...'
            if self.class_name:
                return "%s: %s" % (self.class_name, message)
        else:
            self.message = self._class_name or ''
        return message
    error.short_description = _('error')

    def description(self):
        return self.traceback or ''
    description.short_description = _('description')

class GroupedMessage(MessageBase):
    status          = models.PositiveIntegerField(default=0, choices=STATUS_LEVELS)
    times_seen      = models.PositiveIntegerField(default=1)
    last_seen       = models.DateTimeField(default=datetime.datetime.now, db_index=True)
    first_seen      = models.DateTimeField(default=datetime.datetime.now, db_index=True)

    objects         = GroupedMessageManager()

    class Meta:
        unique_together = (('logger', 'view', 'checksum'),)
        verbose_name_plural = _('grouped messages')
        verbose_name = _('grouped message')
        permissions = (
            ("can_view", "Can view"),
        )

    def __unicode__(self):
        return "(%s) %s: %s" % (self.times_seen, self.class_name, self.error())

    def natural_key(self):
        return (self.logger, self.view, self.checksum)

    @staticmethod
    @transaction.commit_on_success
    def handle_exception(sender, request=None, **kwargs):
        try:
            exc_type, exc_value, exc_traceback = sys.exc_info()

            if not settings.CATCH_404_ERRORS \
                    and issubclass(exc_type, Http404):
                return

            if dj_settings.DEBUG or getattr(exc_type, 'skip_sentry', False):
                return

            if transaction.is_dirty():
                transaction.rollback()

            # kudos to Tapz for this idea
            modules = get_installed_apps()

            # only retrive last 10 lines
            tb = traceback.extract_tb(exc_traceback)

            # retrive final file and line number where the exception occured
            file, line_number = tb[-1][:2]

            # tiny hack to get the python path from filename
            for (filename, line, function, text) in reversed(tb):
                for path in sys.path:
                    if filename.startswith(path):
                        view = '%s.%s' % (filename[len(path)+1:].replace('/', '.').replace('.py', ''), function)
                        break
                if view.split('.')[0] in modules:
                    break
                else:
                    view = '%s.%s' % (exc_traceback.tb_frame.f_globals['__name__'], tb[-1][2]) 

            if request:
                data = dict(
                    META=request.META,
                    POST=request.POST,
                    GET=request.GET,
                    COOKIES=request.COOKIES,
                )
            else:
                data = dict()

            extra = dict(
                url=request and request.build_absolute_uri() or None,
                data=data,
                view=view,
            )

            if settings.USE_LOGGING:
                logging.getLogger('sentry').critical(exc_value, exc_info=sys.exc_info(), extra=extra)
            else:
                Message.objects.create_from_exception(**extra)
        except Exception, exc:
            try:
                logger.exception(u'Unable to process log entry: %s' % (exc,))
            except Exception, exc:
                warnings.warn(u'Unable to process log entry: %s' % (exc,))

    @classmethod
    def get_score_clause(cls):
        if dj_settings.DATABASE_ENGINE.rsplit('.', 1)[-1].startswith('postgresql'):
            return 'times_seen / (pow((floor(extract(epoch from now() - last_seen) / 3600) + 2), 1.25) + 1)'
        if dj_settings.DATABASE_ENGINE.rsplit('.', 1)[-1].startswith('mysql'):
            return 'times_seen / (pow((floor(unix_timestamp(now() - last_seen) / 3600) + 2), 1.25) + 1)'
        return 'times_seen'

class Message(MessageBase):
    group           = models.ForeignKey(GroupedMessage, blank=True, null=True, related_name="message_set")
    datetime        = models.DateTimeField(default=datetime.datetime.now, db_index=True)
    data            = GzippedDictField(blank=True, null=True)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    server_name     = models.CharField(max_length=128, db_index=True)

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')

    def __unicode__(self):
        return "%s: %s" % (self.class_name, smart_unicode(self.message))

    def save(self, *args, **kwargs):
        if not self.checksum:
            self.checksum = construct_checksum(**self.__dict__)
        super(Message, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return self.url
    
    def shortened_url(self):
        if not self.url:
            return _('no data')
        url = self.url
        if len(url) > 60:
            url = url[:60] + '...'
        return url
    shortened_url.short_description = _('url')
    shortened_url.admin_order_field = 'url'
    
    def full_url(self):
        return self.data.get('url') or self.url
    full_url.short_description = _('url')
    full_url.admin_order_field = 'url'
 
got_request_exception.connect(GroupedMessage.handle_exception)