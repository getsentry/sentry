"""
sentry.models.useroption
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from celery.signals import task_postrun
from django.core.signals import request_finished
from django.conf import settings
from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.fields import UnicodePickledObjectField
from sentry.db.models.manager import BaseManager


class UserOptionValue(object):
    # 'workflow:notifications'
    all_conversations = '0'
    participating_only = '1'


class UserOptionManager(BaseManager):
    def __init__(self, *args, **kwargs):
        super(UserOptionManager, self).__init__(*args, **kwargs)
        self.__metadata = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_UserOptionManager__metadata', None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__metadata = {}

    def get_value(self, user, project, key, default=None):
        result = self.get_all_values(user, project)
        return result.get(key, default)

    def unset_value(self, user, project, key):
        self.filter(user=user, project=project, key=key).delete()
        if not hasattr(self, '_metadata'):
            return
        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self.__metadata:
            return
        self.__metadata[metakey].pop(key, None)

    def set_value(self, user, project, key, value):
        inst, created = self.get_or_create(
            user=user,
            project=project,
            key=key,
            defaults={
                'value': value,
            },
        )
        if not created and inst.value != value:
            inst.update(value=value)

        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self.__metadata:
            return
        self.__metadata[metakey][key] = value

    def get_all_values(self, user, project):
        if project:
            metakey = (user.pk, project.pk)
        else:
            metakey = (user.pk, None)
        if metakey not in self.__metadata:
            result = dict(
                (i.key, i.value) for i in
                self.filter(
                    user=user,
                    project=project,
                )
            )
            self.__metadata[metakey] = result
        return self.__metadata.get(metakey, {})

    def clear_cache(self, **kwargs):
        self.__metadata = {}

    def contribute_to_class(self, model, name):
        super(UserOptionManager, self).contribute_to_class(model, name)
        task_postrun.connect(self.clear_cache)
        request_finished.connect(self.clear_cache)


# TODO(dcramer): the NULL UNIQUE constraint here isnt valid, and instead has to
# be manually replaced in the database. We should restructure this model.
class UserOption(Model):
    """
    User options apply only to a user, and optionally a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'

    Keeping user feature state
    key: "feature:assignment"
    value: { updated: datetime, state: bool }
    """
    __core__ = True

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    project = FlexibleForeignKey('sentry.Project', null=True)
    key = models.CharField(max_length=64)
    value = UnicodePickledObjectField()

    objects = UserOptionManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_useroption'
        unique_together = (('user', 'project', 'key',),)

    __repr__ = sane_repr('user_id', 'project_id', 'key', 'value')
