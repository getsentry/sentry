"""
sentry.models.projectkey
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from bitfield import BitField
from urlparse import urlparse
from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone

import six

from sentry.db.models import (
    Model, BaseManager, sane_repr
)


class ProjectKey(Model):
    project = models.ForeignKey('sentry.Project', related_name='key_set')
    label = models.CharField(max_length=64, blank=True, null=True)
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True)
    roles = BitField(flags=(
        # access to post events to the store endpoint
        ('store', 'Event API access'),

        # read/write access to rest API
        ('api', 'Web API access'),
    ), default=['store'])

    # For audits
    user_added = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, related_name='keys_added_set')
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = BaseManager(cache_fields=(
        'public_key',
        'secret_key',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectkey'

    __repr__ = sane_repr('project_id', 'user_id', 'public_key')

    def __unicode__(self):
        return six.text_type(self.public_key)

    @classmethod
    def generate_api_key(cls):
        return uuid4().hex

    def save(self, *args, **kwargs):
        if not self.public_key:
            self.public_key = ProjectKey.generate_api_key()
        if not self.secret_key:
            self.secret_key = ProjectKey.generate_api_key()
        super(ProjectKey, self).save(*args, **kwargs)

    def get_dsn(self, domain=None, secure=True, public=False):
        # TODO: change the DSN to use project slug once clients are compatible
        if not public:
            key = '%s:%s' % (self.public_key, self.secret_key)
            url = settings.SENTRY_ENDPOINT
        else:
            key = self.public_key
            url = settings.SENTRY_PUBLIC_ENDPOINT

        urlparts = urlparse(url or settings.SENTRY_URL_PREFIX)

        return '%s://%s@%s/%s' % (
            urlparts.scheme,
            key,
            urlparts.netloc + urlparts.path,
            self.project_id,
        )

    @property
    def dsn_private(self):
        return self.get_dsn(public=False)

    @property
    def dsn_public(self):
        return self.get_dsn(public=True)
