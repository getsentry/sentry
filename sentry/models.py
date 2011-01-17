import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import datetime
import logging
import sys

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models, transaction
from django.db.models import Count
from django.db.models.signals import post_syncdb
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from sentry import conf
from sentry.helpers import cached_property, construct_checksum, get_db_engine, transform, get_filters
from sentry.manager import GroupedMessageManager, SentryManager
from sentry.reporter import FakeRequest

_reqs = ('paging', 'indexer')
for r in _reqs:
    if r not in settings.INSTALLED_APPS:
        raise ImproperlyConfigured("Put '%s' in your "
            "INSTALLED_APPS setting in order to use the sentry application." % r)

from indexer.models import Index

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
    level           = models.PositiveIntegerField(choices=conf.LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
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
        db_table = 'sentry_groupedmessage'

    def __unicode__(self):
        return "(%s) %s" % (self.times_seen, self.error())

    @models.permalink
    def get_absolute_url(self):
        return ('sentry-group', (self.pk,), {})

    def natural_key(self):
        return (self.logger, self.view, self.checksum)

    @classmethod
    def create_sort_index(cls, sender, db, created_models, **kwargs):
        # This is only supported in postgres
        engine = get_db_engine()
        if not engine.startswith('postgresql'):
            return
        if cls not in created_models:
            return

        from django.db import connections
        
        try:
            cursor = connections[db].cursor()
            cursor.execute("create index sentry_groupedmessage_score on sentry_groupedmessage ((%s))" % (cls.get_score_clause(),))
            cursor.close()
        except:
            transaction.rollback()
        
    @classmethod
    def get_score_clause(cls):
        engine = get_db_engine()
        if engine.startswith('postgresql'):
            return 'log(times_seen) * 600 + last_seen::abstime::int'
        if engine.startswith('mysql'):
            return 'log(times_seen) * 600 + unix_timestamp(last_seen)'
        return 'times_seen'

    def mail_admins(self, request=None, fail_silently=True):
        if not conf.ADMINS:
            return
        
        from django.core.mail import send_mail
        from django.template.loader import render_to_string

        message = self.message_set.order_by('-id')[0]

        obj_request = message.request

        subject = 'Error (%s IP): %s' % ((obj_request.META.get('REMOTE_ADDR') in settings.INTERNAL_IPS and 'internal' or 'EXTERNAL'), obj_request.path)
        if message.site:
            subject  = '[%s] %s' % (message.site, subject)
        try:
            request_repr = repr(obj_request)
        except:
            request_repr = "Request repr() unavailable"

        if request:
            link = request.build_absolute_url(self.get_absolute_url())
        else:
            link = '%s%s' % (conf.URL_PREFIX, self.get_absolute_url())

        body = render_to_string('sentry/emails/error.txt', {
            'request_repr': request_repr,
            'request': obj_request,
            'group': self,
            'traceback': message.traceback,
            'link': link,
        })
        
        send_mail(subject, body,
                  settings.SERVER_EMAIL, conf.ADMINS,
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
    datetime        = models.DateTimeField(default=datetime.datetime.now, db_index=True)
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
        fake_request = FakeRequest()
        fake_request.META = self.data.get('META') or {}
        fake_request.GET = self.data.get('GET') or {}
        fake_request.POST = self.data.get('POST') or {}
        fake_request.FILES = self.data.get('FILES') or {}
        fake_request.COOKIES = self.data.get('COOKIES') or {}
        fake_request.url = self.url
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

### Helper methods

def register_indexes():
    """
    Grabs all required indexes from filters and registers them.
    """
    logger = logging.getLogger('sentry.setup')
    for filter_ in get_filters():
        if filter_.column.startswith('data__'):
            Index.objects.register_model(Message, filter_.column, index_to='group')
            logger.debug('Registered index for for %s' % filter_.column)
register_indexes()

# XXX: Django sucks and we can't listen to our specific app
# post_syncdb.connect(GroupedMessage.create_sort_index, sender=__name__)
post_syncdb.connect(GroupedMessage.create_sort_index, sender=sys.modules[__name__])
