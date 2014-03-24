"""
sentry.models.option
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import UnicodePickledObjectField
from sentry.manager import MetaManager


class Option(Model):
    """
    Global options which apply in most situations as defaults,
    and generally can be overwritten by per-project options.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    key = models.CharField(max_length=64, unique=True)
    value = UnicodePickledObjectField()

    objects = MetaManager(cache_fields=[
        'key',
    ])

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_option'

    __repr__ = sane_repr('key', 'value')
