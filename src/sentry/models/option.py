"""
sentry.models.option
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import UnicodePickledObjectField
from sentry.db.models.manager import BaseManager


class OptionManager(BaseManager):
    def get_value(self, key, default=None):
        try:
            return self.get_from_cache(key=key).value
        except self.model.DoesNotExist:
            return default

    def unset_value(self, key):
        self.filter(key=key).delete()

    def set_value(self, key, value):
        instance, created = self.get_or_create(
            key=key,
            defaults={
                'value': value,
            }
        )
        if not created and value != instance.value:
            instance.update(value=value)


class Option(Model):
    """
    Global options which apply in most situations as defaults,
    and generally can be overwritten by per-project options.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    key = models.CharField(max_length=64, unique=True)
    value = UnicodePickledObjectField()

    objects = OptionManager(cache_fields=[
        'key',
    ])

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_option'

    __repr__ = sane_repr('key', 'value')
