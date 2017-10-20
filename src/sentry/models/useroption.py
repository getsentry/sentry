"""
sentry.models.useroption
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from celery.signals import task_postrun
from django.conf import settings
from django.core.signals import request_finished
from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.fields import EncryptedPickledObjectField
from sentry.db.models.manager import BaseManager


class UserOptionValue(object):
    # 'workflow:notifications'
    all_conversations = '0'
    participating_only = '1'
    no_conversations = '2'
    # 'deploy-emails
    all_deploys = '2'
    committed_deploys_only = '3'
    no_deploys = '4'


option_scope_error = 'this is not a supported use case, scope to project OR organization'


def user_metakey(user):
    return (user.pk)


def project_metakey(user, project):
    return (user.pk, project.pk, 'project')


def organization_metakey(user, organization):
    return (user.pk, organization.pk, 'organization')


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

    def get_value(self, user, key, default=None, **kwargs):
        project = kwargs.get('project')
        organization = kwargs.get('organization')

        if organization and project:
            raise NotImplementedError(option_scope_error)
        if organization:
            result = self.get_all_values(user, None, organization)
        else:
            result = self.get_all_values(user, project)
        return result.get(key, default)

    def unset_value(self, user, project, key):
        # this isn't implemented for user-organization scoped options yet, because
        # it hasn't been needed
        self.filter(user=user, project=project, key=key).delete()
        if not hasattr(self, '_metadata'):
            return
        if project:
            metakey = project_metakey(user, project)
        else:
            metakey = user_metakey(user)
        if metakey not in self.__metadata:
            return
        self.__metadata[metakey].pop(key, None)

    def set_value(self, user, key, value, **kwargs):
        project = kwargs.get('project')
        organization = kwargs.get('organization')

        if organization and project:
            raise NotImplementedError(option_scope_error)

        inst, created = self.get_or_create(
            user=user,
            project=project,
            organization=organization,
            key=key,
            defaults={
                'value': value,
            },
        )
        if not created and inst.value != value:
            inst.update(value=value)

        if project:
            metakey = project_metakey(user, project)
        elif organization:
            metakey = organization_metakey(user, organization)
        else:
            metakey = user_metakey(user)
        if metakey not in self.__metadata:
            return
        self.__metadata[metakey][key] = value

    def get_all_values(self, user, project=None, organization=None):
        if organization and project:
            raise NotImplementedError(option_scope_error)

        if project:
            metakey = project_metakey(user, project)
        elif organization:
            metakey = organization_metakey(user, organization)
        else:
            metakey = user_metakey(user)
        if metakey not in self.__metadata:
            result = dict(
                (i.key, i.value)
                for i in self.filter(
                    user=user,
                    project=project,
                    organization=organization,
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
    User options apply only to a user, and optionally a project OR an organization.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'

    Keeping user feature state
    key: "feature:assignment"
    value: { updated: datetime, state: bool }
    """
    __core__ = True

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    project = FlexibleForeignKey('sentry.Project', null=True)
    organization = FlexibleForeignKey('sentry.Organization', null=True)
    key = models.CharField(max_length=64)
    value = EncryptedPickledObjectField()

    objects = UserOptionManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_useroption'
        unique_together = (('user', 'project', 'key', ), ('user', 'organization', 'key', ))

    __repr__ = sane_repr('user_id', 'project_id', 'organization_id', 'key', 'value')
