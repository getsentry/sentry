"""
sentry.models.projectoption
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from picklefield.fields import PickledObjectField

from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.manager import InstanceMetaManager


class ProjectOption(Model):
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    project = models.ForeignKey('sentry.Project')
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    objects = InstanceMetaManager('project')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectoptions'
        unique_together = (('project', 'key',),)

    __repr__ = sane_repr('project_id', 'key', 'value')
