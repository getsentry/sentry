from __future__ import absolute_import, print_function

import petname

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from uuid import uuid4

from sentry.db.models import (
    Model, BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey,
    sane_repr
)


class ApiApplicationStatus(object):
    active = 0
    inactive = 1


class ApiGrantType(object):
    authorization_code = 1
    implicit = 2
    password = 3
    client_credentials = 4


class ApiApplication(Model):
    __core__ = True

    client_id = models.CharField(
        max_length=64, unique=True,
        default=lambda: ApiApplication.generate_token())
    client_secret = models.CharField(
        max_length=64, unique=True,
        default=lambda: ApiApplication.generate_token())
    owner = FlexibleForeignKey('sentry.User')
    name = models.CharField(
        max_length=64, blank=True,
        default=lambda: petname.Generate(2, ' ').title())
    status = BoundedPositiveIntegerField(default=0, choices=(
        (ApiApplicationStatus.active, _('Active')),
        (ApiApplicationStatus.inactive, _('Inactive')),
    ), db_index=True)
    allowed_origins = models.TextField(blank=True, null=True)
    grant_type = BoundedPositiveIntegerField(
        default=0,
        choices=[
            (ApiGrantType.authorization_code, _('Authorization code')),
            (ApiGrantType.implicit, _('Implicit')),
            # (ApiGrantType.password, _('Resource owner password-based')),
            # (ApiGrantType.client_credentials, _('Client credentials')),
        ],
    )
    redirect_uris = models.TextField()
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=(
        'client_id',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_apiapplication'

    __repr__ = sane_repr('name', 'owner_id')

    def __unicode__(self):
        return self.name

    @classmethod
    def generate_token(cls):
        return uuid4().hex + uuid4().hex

    @property
    def is_active(self):
        return self.status == ApiApplicationStatus.ACTIVE

    def is_allowed_response_type(self, value):
        if value == 'code':
            return self.grant_type == ApiGrantType.authorization_code
        elif value == 'token':
            return self.grant_type == ApiGrantType.implicit

    def is_valid_redirect_uri(self, value):
        for ruri in self.redirect_uris.split('\n'):
            if value.startswith(ruri):
                return True
        return False

    def get_default_redirect_uri(self):
        return self.redirect_uris.split('\n', 1)[0]

    def get_allowed_origins(self):
        if not self.allowed_origins:
            return []
        return [a for a in self.allowed_origins.split('\n') if a]

    def get_audit_log_data(self):
        return {
            'client_id': self.client_id,
            'name': self.name,
            'redirect_uris': int(self.redirect_uris),
            'allowed_origins': int(self.allowed_origins),
            'status': self.status,
        }
