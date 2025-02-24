from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, ClassVar

from django.conf import settings
from django.db import models

from sentry.backup.dependencies import ImportKind, PrimaryKeyMap, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, control_silo_model, sane_repr
from sentry.db.models.fields import PickledObjectField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.option import OptionManager

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser

option_scope_error = "this is not a supported use case, scope to project OR organization"


class UserOptionManager(OptionManager["UserOption"]):
    def _make_key(  # type: ignore[override]
        self,
        user: User | RpcUser | int,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
    ) -> str:
        uid = user.id if user and not isinstance(user, int) else user
        org_id: int | None = organization.id if isinstance(organization, Model) else organization
        proj_id: int | None = project.id if isinstance(project, Model) else project
        if project:
            metakey = f"{uid}:{proj_id}:project"
        elif organization:
            metakey = f"{uid}:{org_id}:organization"
        else:
            metakey = f"{uid}:user"

        return super()._make_key(metakey)

    def get_value(
        self, user: User | RpcUser, key: str, default: Any | None = None, **kwargs: Any
    ) -> Any:
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

    def set_value(self, user: User | int, key: str, value: Any, **kwargs: Any) -> None:
        project = kwargs.get("project")
        organization = kwargs.get("organization")
        project_id = kwargs.get("project_id", None)
        organization_id = kwargs.get("organization_id", None)
        if project is not None:
            project_id = project.id
        if organization is not None:
            organization_id = organization.id

        if organization and project:
            raise NotImplementedError(option_scope_error)

        inst, created = self.get_or_create(
            user_id=user.id if user and not isinstance(user, int) else user,
            project_id=project_id,
            organization_id=organization_id,
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
        user: User | RpcUser | int,
        project: Project | int | None = None,
        organization: Organization | int | None = None,
        force_reload: bool = False,
    ) -> Mapping[str, Any]:
        if organization and project:
            raise NotImplementedError(option_scope_error)

        uid = user.id if user and not isinstance(user, int) else user
        metakey = self._make_key(user, project=project, organization=organization)
        project_id: int | None = project.id if isinstance(project, Model) else project
        organization_id: int | None = (
            organization.id if isinstance(organization, Model) else organization
        )

        if metakey not in self._option_cache or force_reload:
            result = {
                i.key: i.value
                for i in self.filter(
                    user_id=uid, project_id=project_id, organization_id=organization_id
                )
            }
            self._option_cache[metakey] = result

        return self._option_cache.get(metakey, {})

    def post_save(self, *, instance: UserOption, created: bool, **kwargs: object) -> None:
        self.get_all_values(
            instance.user, instance.project_id, instance.organization_id, force_reload=True
        )

    def post_delete(self, instance: UserOption, **kwargs: Any) -> None:
        self.get_all_values(
            instance.user, instance.project_id, instance.organization_id, force_reload=True
        )


# TODO(dcramer): the NULL UNIQUE constraint here isn't valid, and instead has to
# be manually replaced in the database. We should restructure this model.
@control_silo_model
class UserOption(Model):
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
     - prefers_issue_details_streamlined_ui
        - Whether the user prefers the new issue details experience (boolean)
     - prefers_stacked_navigation
        - Whether the user prefers the new stacked navigation experience (boolean)
     - quick_start_display
        - Tracks whether the quick start guide was already automatically shown to the user during their second visit
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

    __relocation_scope__ = RelocationScope.User

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    project_id = HybridCloudForeignKey("sentry.Project", null=True, on_delete="CASCADE")
    organization_id = HybridCloudForeignKey("sentry.Organization", null=True, on_delete="CASCADE")
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    objects: ClassVar[UserOptionManager] = UserOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_useroption"
        unique_together = (("user", "project_id", "key"), ("user", "organization_id", "key"))

    __repr__ = sane_repr("user_id", "project_id", "organization_id", "key", "value")

    @classmethod
    def get_relocation_ordinal_fields(self, json_model: Any) -> list[str] | None:
        # "global" user options (those with no organization and/or project scope) get a custom
        # ordinal; non-global ones use the default ordering.
        org_id = json_model["fields"].get("organization_id", None)
        project_id = json_model["fields"].get("project_id", None)
        if org_id is None and project_id is None:
            return ["user", "key"]

        return None

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        from sentry.users.models.user import User

        old_user_id = self.user_id
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # If we are merging users, ignore the imported options and use the existing user's
        # options instead.
        if pk_map.get_kind(get_model_name(User), old_user_id) == ImportKind.Existing:
            return None

        return old_pk

    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> tuple[int, ImportKind] | None:
        # TODO(getsentry/team-ospo#190): This circular import is a bit gross. See if we can't find a
        # better place for this logic to live.
        from sentry.users.api.endpoints.user_details import UserOptionsSerializer

        serializer_options = UserOptionsSerializer(data={self.key: self.value}, partial=True)
        serializer_options.is_valid(raise_exception=True)

        # TODO(getsentry/team-ospo#190): Find a more general solution to one-off indices such as
        # this. We currently have this constraint on prod, but not in Django, probably from legacy
        # SQL manipulation.
        #
        # Ensure that global (ie: `organization_id` and `project_id` both `NULL`) constraints are
        # not duplicated on import.
        if self.organization_id is None and self.project_id is None:
            colliding_global_user_option = self.objects.filter(
                user=self.user, key=self.key, organization_id__isnull=True, project_id__isnull=True
            ).first()
            if colliding_global_user_option is not None:
                return None

        return super().write_relocation_import(scope, flags)
