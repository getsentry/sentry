from __future__ import absolute_import, print_function

from django.conf import settings
from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.fields import EncryptedPickledObjectField
from sentry.db.models.manager import OptionManager


class UserOptionValue(object):
    # 'workflow:notifications'
    all_conversations = "0"
    participating_only = "1"
    no_conversations = "2"
    # 'deploy-emails
    all_deploys = "2"
    committed_deploys_only = "3"
    no_deploys = "4"


option_scope_error = "this is not a supported use case, scope to project OR organization"


class UserOptionManager(OptionManager):
    def _make_key(self, user, project=None, organization=None):
        if project:
            metakey = u"%s:%s:project" % (user.pk, project.id)
        elif organization:
            metakey = u"%s:%s:organization" % (user.pk, organization.id)
        else:
            metakey = u"%s:user" % (user.pk)

        return super(UserOptionManager, self)._make_key(metakey)

    def get_value(self, user, key, default=None, **kwargs):
        project = kwargs.get("project")
        organization = kwargs.get("organization")

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
        if not hasattr(self, "_metadata"):
            return

        metakey = self._make_key(user, project=project)

        if metakey not in self._option_cache:
            return
        self._option_cache[metakey].pop(key, None)

    def set_value(self, user, key, value, **kwargs):
        project = kwargs.get("project")
        organization = kwargs.get("organization")

        if organization and project:
            raise NotImplementedError(option_scope_error)

        inst, created = self.get_or_create(
            user=user,
            project=project,
            organization=organization,
            key=key,
            defaults={"value": value},
        )
        if not created and inst.value != value:
            inst.update(value=value)

        metakey = self._make_key(user, project=project, organization=organization)

        if metakey not in self._option_cache:
            return
        self._option_cache[metakey][key] = value

    def get_all_values(self, user, project=None, organization=None, force_reload=False):
        if organization and project:
            raise NotImplementedError(option_scope_error)

        metakey = self._make_key(user, project=project, organization=organization)

        if metakey not in self._option_cache or force_reload:
            result = dict(
                (i.key, i.value)
                for i in self.filter(user=user, project=project, organization=organization)
            )
            self._option_cache[metakey] = result
        return self._option_cache.get(metakey, {})

    def post_save(self, instance, **kwargs):
        self.get_all_values(
            instance.user, instance.project, instance.organization, force_reload=True
        )

    def post_delete(self, instance, **kwargs):
        self.get_all_values(
            instance.user, instance.project, instance.organization, force_reload=True
        )


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
    project = FlexibleForeignKey("sentry.Project", null=True)
    organization = FlexibleForeignKey("sentry.Organization", null=True)
    key = models.CharField(max_length=64)
    value = EncryptedPickledObjectField()

    objects = UserOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_useroption"
        unique_together = (("user", "project", "key"), ("user", "organization", "key"))

    __repr__ = sane_repr("user_id", "project_id", "organization_id", "key", "value")
