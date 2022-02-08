from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping

from django.conf import settings
from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.fields import EncryptedPickledObjectField
from sentry.db.models.manager import OptionManager, Value

if TYPE_CHECKING:
    from sentry.models import Organization, Project, User


option_scope_error = "this is not a supported use case, scope to project OR organization"


class UserOptionManager(OptionManager["User"]):
    def _make_key(
        self,
        user: User,
        project: Project | None = None,
        organization: Organization | None = None,
    ) -> str:
        if project:
            metakey = f"{user.pk}:{project.id}:project"
        elif organization:
            metakey = f"{user.pk}:{organization.id}:organization"
        else:
            metakey = f"{user.pk}:user"

        # Explicitly typing to satisfy mypy.
        key: str = super()._make_key(metakey)
        return key

    def get_value(self, user: User, key: str, default: Value | None = None, **kwargs: Any) -> Value:
        project = kwargs.get("project")
        organization = kwargs.get("organization")

        if organization and project:
            raise NotImplementedError(option_scope_error)
        if organization:
            result = self.get_all_values(user, None, organization)
        else:
            result = self.get_all_values(user, project)
        return result.get(key, default)

    def unset_value(self, user: User, project: Project, key: str) -> None:
        """
        This isn't implemented for user-organization scoped options yet, because it hasn't been needed.
        """
        self.filter(user=user, project=project, key=key).delete()

        if not hasattr(self, "_metadata"):
            return

        metakey = self._make_key(user, project=project)

        if metakey not in self._option_cache:
            return
        self._option_cache[metakey].pop(key, None)

    def set_value(self, user: User, key: str, value: Value, **kwargs: Any) -> None:
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

    def get_all_values(
        self,
        user: User,
        project: Project | None = None,
        organization: Organization | None = None,
        force_reload: bool = False,
    ) -> Mapping[str, Value]:
        if organization and project:
            raise NotImplementedError(option_scope_error)

        metakey = self._make_key(user, project=project, organization=organization)

        if metakey not in self._option_cache or force_reload:
            result = {
                i.key: i.value
                for i in self.filter(user=user, project=project, organization=organization)
            }
            self._option_cache[metakey] = result

        # Explicitly typing to satisfy mypy.
        values: Mapping[str, Value] = self._option_cache.get(metakey, {})
        return values

    def post_save(self, instance: UserOption, **kwargs: Any) -> None:
        self.get_all_values(
            instance.user, instance.project, instance.organization, force_reload=True
        )

    def post_delete(self, instance: UserOption, **kwargs: Any) -> None:
        self.get_all_values(
            instance.user, instance.project, instance.organization, force_reload=True
        )


# TODO(dcramer): the NULL UNIQUE constraint here isn't valid, and instead has to
# be manually replaced in the database. We should restructure this model.
class UserOption(Model):  # type: ignore
    """
    User options apply only to a user, and optionally a project OR an organization.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'

    Keeping user feature state
    key: "feature:assignment"
    value: { updated: datetime, state: bool }

    where key is one of:
     (please add to this list if adding new keys)
     - clock_24_hours
        - 12hr vs. 24hr
     - issue:defaults
        - only used in Jira, set default reporter field
     - issues:defaults:jira
        - unused
     - issues:defaults:jira_server
        - unused
     - language
        - which language to display the app in
     - mail:email
        - which email address to send an email to
     - reports:disabled-organizations
        - which orgs to not send weekly reports to
     - seen_release_broadcast
        - unused
     - self_assign_issue
        - "Claim Unassigned Issues I've Resolved"
     - self_notifications
        - "Notify Me About My Own Activity"
     - stacktrace_order
        - default, most recent first, most recent last
     - subscribe_by_default
        - "Only On Issues I Subscribe To", "Only On Deploys With My Commits"
     - subscribe_notes
        - unused
     - timezone
        - user's timezone to display timestamps
     - theme
        - dark, light, or default
     - twilio:alert
        - unused
     - workflow_notifications
        - unused
    """

    __include_in_export__ = True

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
