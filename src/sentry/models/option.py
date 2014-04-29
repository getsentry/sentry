"""
sentry.models.option
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.signals import task_postrun
from django.core.signals import request_finished
from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import UnicodePickledObjectField
from sentry.db.models.manager import BaseManager


class OptionManager(BaseManager):
    NOTSET = object()

    def __init__(self, *args, **kwargs):
        super(OptionManager, self).__init__(*args, **kwargs)
        task_postrun.connect(self.clear_local_cache)
        request_finished.connect(self.clear_local_cache)
        self.__cache = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_OptionManager__cache', None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__cache = {}

    def get_value(self, key, default=None):
        result = self.get_all_values()
        return result.get(key, default)

    def unset_value(self, key):
        self.filter(key=key).delete()
        self.__cache.pop(key, None)

    def set_value(self, key, value):
        inst, _ = self.get_or_create(
            key=key,
            defaults={
                'value': value,
            }
        )
        if inst.value != value:
            inst.update(value=value)

        self.__cache[key] = value

    def get_all_values(self):
        if not hasattr(self, '_OptionManager__cache'):
            self.__cache = dict(self.values_list('key', 'value'))
        return self.__cache

    def clear_local_cache(self, **kwargs):
        self.__cache = {}


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
