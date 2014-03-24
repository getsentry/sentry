"""
sentry.models.useroption
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


from django.conf import settings
from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import UnicodePickledObjectField
from sentry.manager import UserOptionManager


class UserOption(Model):
    """
    User options apply only to a user, and optionally a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL)
    project = models.ForeignKey('sentry.Project', null=True)
    key = models.CharField(max_length=64)
    value = UnicodePickledObjectField()

    objects = UserOptionManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_useroption'
        unique_together = (('user', 'project', 'key',),)

    __repr__ = sane_repr('user_id', 'project_id', 'key', 'value')
