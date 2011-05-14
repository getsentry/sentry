from __future__ import absolute_import

import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import logging
import math

from datetime import datetime

from django.db import models
from django.db.models import Count
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.utils import cached_property, construct_checksum, transform, get_filters, \
                         MockDjangoRequest
from sentry.utils.manager import GroupedMessageManager, SentryManager

from indexer.models import BaseIndex

try:
    from idmapper.models import SharedMemoryModel as Model
except ImportError:
    Model = models.Model

__all__ = ('Message', 'GroupedMessage')

STATUS_LEVELS = (
    (0, _('unresolved')),
    (1, _('resolved')),
)

class GzippedDictField(models.TextField):
    """
    Slightly different from a JSONField in the sense that the default
    value is a dictionary.
    """
    __metaclass__ = models.SubfieldBase
 
    def to_python(self, value):
        if isinstance(value, basestring) and value:
            value = pickle.loads(base64.b64decode(value).decode('zlib'))
        elif not value:
            return {}
        return value

    def get_prep_value(self, value):
        if value is None: return
        return base64.b64encode(pickle.dumps(transform(value)).encode('zlib'))
 
    def value_to_string(self, obj):
        value = self._get_val_from_obj(obj)
        return self.get_db_prep_value(value)

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        from south.modelsinspector import introspector
        field_class = "django.db.models.fields.TextField"
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)

class MessageBase(Model):
    logger          = models.CharField(max_length=64, blank=True, default='root', db_index=True)
    class_name      = models.CharField(_('type'), max_length=128, blank=True, null=True, db_index=True)
    level           = models.PositiveIntegerField(choices=settings.LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
    message         = models.TextField()
    traceback       = models.TextField(blank=True, null=True)
    view            = models.CharField(max_length=200, blank=True, null=True)
    checksum        = models.CharField(max_length=32)
    data            = GzippedDictField(blank=True, null=True)

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
            message = self.class_name or ''
        return message
    error.short_description = _('error')

    def description(self):
        return self.traceback or ''
    description.short_description = _('description')

    def has_two_part_message(self):
        return '\n' in self.message.strip('\n')
    
    def message_top(self):
        return self.message.split('\n')[0]

class GroupedMessage(MessageBase):
    status          = models.PositiveIntegerField(default=0, choices=STATUS_LEVELS, db_index=True)
    times_seen      = models.PositiveIntegerField(default=1, db_index=True)
    last_seen       = models.DateTimeField(default=datetime.now, db_index=True)
    first_seen      = models.DateTimeField(default=datetime.now, db_index=True)

    score           = models.IntegerField(default=0)
    
    objects         = GroupedMessageManager()

    class Meta:
        unique_together = (('logger', 'view', 'checksum'),)
        verbose_name_plural = _('grouped messages')
        verbose_name = _('grouped message')
        permissions = (
            ("can_view", "Can view"),
        )
        db_table = 'sentry_groupedmessage'

    def __unicode__(self):
        return "(%s) %s" % (self.times_seen, self.error())

    @models.permalink
    def get_absolute_url(self):
        return ('sentry-group', (self.pk,), {})

    def natural_key(self):
        return (self.logger, self.view, self.checksum)

    def get_score(self):
        return int(math.log(self.times_seen) * 600 + int(self.last_seen.strftime('%s')))

    def mail_admins(self, request=None, fail_silently=True):
        from django.core.mail import send_mail
        from django.template.loader import render_to_string

        if not settings.ADMINS:
            return
        
        message = self.message_set.order_by('-id')[0]

        obj_request = message.request

        ip_repr = (obj_request.META.get('REMOTE_ADDR') in settings.INTERNAL_IPS and 'internal' or 'EXTERNAL')

        subject = '%sError (%s IP): %s' % (settings.EMAIL_SUBJECT_PREFIX, ip_repr, obj_request.path)

        if message.site:
            subject  = '[%s] %s' % (message.site, subject)
        try:
            request_repr = repr(obj_request)
        except:
            request_repr = "Request repr() unavailable"

        if request:
            link = request.build_absolute_url(self.get_absolute_url())
        else:
            link = '%s%s' % (settings.URL_PREFIX, self.get_absolute_url())

        body = render_to_string('sentry/emails/error.txt', {
            'request_repr': request_repr,
            'request': obj_request,
            'group': self,
            'traceback': message.traceback,
            'link': link,
        })
        
        send_mail(subject, body,
                  settings.SERVER_EMAIL, settings.ADMINS,
                  fail_silently=fail_silently)
    
    @property
    def unique_urls(self):
        return self.message_set.filter(url__isnull=False)\
                   .values_list('url', 'logger', 'view', 'checksum')\
                   .annotate(times_seen=Count('url'))\
                   .values('url', 'times_seen')\
                   .order_by('-times_seen')

    @property
    def unique_servers(self):
        return self.message_set.filter(server_name__isnull=False)\
                   .values_list('server_name', 'logger', 'view', 'checksum')\
                   .annotate(times_seen=Count('server_name'))\
                   .values('server_name', 'times_seen')\
                   .order_by('-times_seen')

    @property
    def unique_sites(self):
        return self.message_set.filter(site__isnull=False)\
                   .values_list('site', 'logger', 'view', 'checksum')\
                   .annotate(times_seen=Count('site'))\
                   .values('site', 'times_seen')\
                   .order_by('-times_seen')

    def get_version(self):
        if not self.data:
            return
        if 'version' not in self.data:
            return
        module = self.data.get('module', 'ver')
        return module, self.data['version']

class Message(MessageBase):
    message_id      = models.CharField(max_length=32, null=True, unique=True)
    group           = models.ForeignKey(GroupedMessage, blank=True, null=True, related_name="message_set")
    datetime        = models.DateTimeField(default=datetime.now, db_index=True)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    server_name     = models.CharField(max_length=128, db_index=True)
    site            = models.CharField(max_length=128, db_index=True, null=True)

    class Meta:
        verbose_name = _('message')
        verbose_name_plural = _('messages')
        db_table = 'sentry_message'

    def __unicode__(self):
        return self.error()

    def save(self, *args, **kwargs):
        if not self.checksum:
            self.checksum = construct_checksum(**self.__dict__)
        super(Message, self).save(*args, **kwargs)

    @models.permalink
    def get_absolute_url(self):
        return ('sentry-group-message', (self.group_id, self.pk), {})
    
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

    @cached_property
    def request(self):
        fake_request = MockDjangoRequest(
            META = self.data.get('META') or {},
            GET = self.data.get('GET') or {},
            POST = self.data.get('POST') or {},
            FILES = self.data.get('FILES') or {},
            COOKIES = self.data.get('COOKIES') or {},
            url = self.url,
        )
        if self.url:
            fake_request.path_info = '/' + self.url.split('/', 3)[-1]
        else:
            fake_request.path_info = ''
        fake_request.path = fake_request.path_info
        return fake_request

    def get_version(self):
        if not self.data:
            return
        if '__sentry__' not in self.data:
            return
        if 'version' not in self.data['__sentry__']:
            return
        module = self.data['__sentry__'].get('module', 'ver')
        return module, self.data['__sentry__']['version']

class FilterValue(models.Model):
    FILTER_KEYS = (
        ('server_name', _('server name')),
        ('logger', _('logger')),
        ('site', _('site')),
    )
    
    key = models.CharField(choices=FILTER_KEYS, max_length=32)
    value = models.CharField(max_length=200)
    
    class Meta:
        unique_together = (('key', 'value'),)

### django-indexer

class MessageIndex(BaseIndex):
    model = Message

### Helper methods

def register_indexes():
    """
    Grabs all required indexes from filters and registers them.
    """
    logger = logging.getLogger('sentry.setup')
    for filter_ in get_filters():
        if filter_.column.startswith('data__'):
            MessageIndex.objects.register_index(filter_.column, index_to='group')
            logger.debug('Registered index for for %s' % filter_.column)
register_indexes()
