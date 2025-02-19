from __future__ import annotations

from collections.abc import Callable, Collection, Mapping, Sequence
from enum import IntEnum
from typing import TYPE_CHECKING, Any, ClassVar

from django.conf import settings
from django.db import models, router, transaction
from django.db.models import QuerySet
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
from django.utils.functional import cached_property

from bitfield import TypedClassBitField
from sentry import roles
from sentry.app import env
from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import (
    ALERTS_MEMBER_WRITE_DEFAULT,
    EVENTS_MEMBER_ADMIN_DEFAULT,
    RESERVED_ORGANIZATION_SLUGS,
)
from sentry.db.models import BoundedPositiveIntegerField, region_silo_model, sane_repr
from sentry.db.models.fields.slug import SentryOrgSlugField
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.utils import slugify_instance
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.hybridcloud.outbox.base import ReplicatedRegionModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.locks import locks
from sentry.notifications.services import notifications_service
from sentry.organizations.absolute_url import has_customer_domain, organization_absolute_url
from sentry.roles.manager import Role
from sentry.users.services.user import RpcUser, RpcUserProfile
from sentry.users.services.user.service import user_service
from sentry.utils.http import is_using_customer_domain
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.snowflake import generate_snowflake_id, save_with_snowflake_id, snowflake_id_model

if TYPE_CHECKING:
    from sentry.models.options.organization_option import OrganizationOptionManager

SENTRY_USE_SNOWFLAKE = getattr(settings, "SENTRY_USE_SNOWFLAKE", False)
NON_MEMBER_SCOPES = frozenset(["org:write", "project:write", "team:write"])


class OrganizationStatus(IntEnum):
    ACTIVE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2
    RELOCATION_PENDING_APPROVAL = 3

    # alias for OrganizationStatus.ACTIVE
    VISIBLE = 0

    def __str__(self):
        return self.name

    @property
    def label(self):
        return OrganizationStatus_labels[self]

    @classmethod
    def as_choices(cls):
        result = []
        for name, member in cls.__members__.items():
            # an alias
            if name != member.name:
                continue
            # realistically Enum shouldn't even creating these, but alas
            if name.startswith("_"):
                continue
            result.append((member.value, str(member.label)))
        return tuple(result)


OrganizationStatus_labels = {
    OrganizationStatus.ACTIVE: "active",
    OrganizationStatus.PENDING_DELETION: "pending deletion",
    OrganizationStatus.DELETION_IN_PROGRESS: "deletion in progress",
    OrganizationStatus.RELOCATION_PENDING_APPROVAL: "relocation pending approval",
}


class OrganizationManager(BaseManager["Organization"]):
    def get_for_user_ids(self, user_ids: Collection[int]) -> QuerySet:
        """Returns the QuerySet of all organizations that a set of Users have access to."""
        return self.filter(
            status=OrganizationStatus.ACTIVE,
            member_set__user_id__in=user_ids,
        )

    def get_for_team_ids(self, team_ids: Sequence[int]) -> QuerySet:
        """Returns the QuerySet of all organizations that a set of Teams have access to."""
        from sentry.models.team import Team

        return self.filter(
            status=OrganizationStatus.ACTIVE,
            id__in=Team.objects.filter(id__in=team_ids).values("organization"),
        )

    def get_for_user(self, user, scope=None, only_visible=True):
        """
        Returns a set of all organizations a user has access to.
        """
        from sentry.models.organizationmember import OrganizationMember

        if not user.is_authenticated:
            return []

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(self.filter(status=OrganizationStatus.ACTIVE))
            else:
                return list(self.filter())

        qs = OrganizationMember.objects.filter(user_id=user.id).select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]
        return [r.organization for r in results]

    def get_organizations_where_user_is_owner(self, user_id: int) -> QuerySet:
        """
        Returns a QuerySet of all organizations where a user has the top priority role.
        The default top priority role in Sentry is owner.
        """

        # get owners from orgs
        owner_role_orgs = Organization.objects.filter(
            member_set__user_id=user_id,
            status=OrganizationStatus.ACTIVE,
            member_set__role=roles.get_top_dog().id,
        )

        return owner_role_orgs


@snowflake_id_model
@region_silo_model
class Organization(ReplicatedRegionModel):
    """
    An organization represents a group of individuals which maintain ownership of projects.
    """

    category = OutboxCategory.ORGANIZATION_UPDATE
    replication_version = 4

    __relocation_scope__ = RelocationScope.Organization
    name = models.CharField(max_length=64)
    slug: models.Field[str, str] = SentryOrgSlugField(unique=True)
    status = BoundedPositiveIntegerField(
        choices=OrganizationStatus.as_choices(), default=OrganizationStatus.ACTIVE.value
    )
    date_added = models.DateTimeField(default=timezone.now)
    default_role = models.CharField(max_length=32, default=str(roles.get_default().id))
    is_test = models.BooleanField(default=False)

    class flags(TypedClassBitField):
        # WARNING: Only add flags to the bottom of this list
        # bitfield flags are dependent on their order and inserting/removing
        # flags from the middle of the list will cause bits to shift corrupting
        # existing data.

        # Allow members to join and leave teams without requiring approval
        allow_joinleave: bool

        # Enable enhanced privacy controls to limit personally identifiable
        # information (PII) as well as source code in things like
        # notifications.
        enhanced_privacy: bool

        # Disable sharing of limited details on issues to anonymous users.
        disable_shared_issues: bool

        # Enable early adopter status, gaining access to features prior to public release.
        early_adopter: bool

        # Require and enforce two-factor authentication for all members.
        require_2fa: bool

        # Temporarily opt out of new visibility features and ui
        disable_new_visibility_features: bool

        # Require and enforce email verification for all members. (deprecated, not in use)
        require_email_verification: bool

        # Enable codecov integration.
        codecov_access: bool

        # Disable org-members from creating new projects
        disable_member_project_creation: bool

        # Prevent superuser access to an organization
        prevent_superuser_access: bool

        # Disable org-members from inviting members
        disable_member_invite: bool

        bitfield_default = 1

    objects: ClassVar[OrganizationManager] = OrganizationManager(cache_fields=("pk", "slug"))

    # Not persisted. Getsentry fills this in in post-save hooks and we use it for synchronizing data across silos.
    customer_id: str | None = None

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organization"
        # TODO: Once we're on a version of Django that supports functional indexes,
        # include index on `upper((slug::text))` here.

    __repr__ = sane_repr("owner_id", "name", "slug")

    @classmethod
    def get_default(cls):
        """
        Return the organization used in single organization mode.
        """

        if settings.SENTRY_ORGANIZATION is not None:
            return cls.objects.get(id=settings.SENTRY_ORGANIZATION)

        return cls.objects.filter(status=OrganizationStatus.ACTIVE)[0]

    def __str__(self):
        return f"{self.name} ({self.slug})"

    snowflake_redis_key = "organization_snowflake_key"

    def save(self, *args, **kwargs):
        slugify_target = None
        if not self.slug:
            slugify_target = self.name
        elif not self.id:
            slugify_target = self.slug
        if slugify_target is not None:
            lock = locks.get("slug:organization", duration=5, name="organization_slug")
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_target = slugify_target.lower().replace("_", "-").strip("-")
                slugify_instance(self, slugify_target, reserved=RESERVED_ORGANIZATION_SLUGS)

        if SENTRY_USE_SNOWFLAKE:
            save_with_snowflake_id(
                instance=self,
                snowflake_redis_key=self.snowflake_redis_key,
                save_callback=lambda: super(Organization, self).save(*args, **kwargs),
            )
        else:
            super().save(*args, **kwargs)

    @classmethod
    def reserve_snowflake_id(cls):
        return generate_snowflake_id(cls.snowflake_redis_key)

    def delete(self, *args, **kwargs):
        if self.is_default:
            raise Exception("You cannot delete the default organization.")
        return super().delete(*args, **kwargs)

    def handle_async_replication(self, shard_identifier: int) -> None:
        from sentry.hybridcloud.services.organization_mapping.serial import (
            update_organization_mapping_from_instance,
        )
        from sentry.hybridcloud.services.organization_mapping.service import (
            organization_mapping_service,
        )
        from sentry.types.region import get_local_region

        update = update_organization_mapping_from_instance(self, get_local_region())
        organization_mapping_service.upsert(organization_id=self.id, update=update)

    @classmethod
    def handle_async_deletion(
        cls, identifier: int, shard_identifier: int, payload: Mapping[str, Any] | None
    ) -> None:
        organization_mapping_service.delete(organization_id=identifier)
        notifications_service.remove_notification_settings_for_organization(
            organization_id=identifier
        )

    @cached_property
    def is_default(self):
        if not settings.SENTRY_SINGLE_ORGANIZATION:
            return False

        return self == type(self).get_default()

    def has_access(self, user: RpcUser, access=None):
        queryset = self.member_set.filter(user_id=user.id)
        if access is not None:
            queryset = queryset.filter(type__lte=access)

        return queryset.exists()

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": int(self.status),
            "flags": int(self.flags),
            "default_role": self.default_role,
        }

    def get_owners(self) -> Sequence[RpcUser]:
        owners = self.get_members_with_org_roles(roles=[roles.get_top_dog().id]).values_list(
            "user_id", flat=True
        )

        with in_test_hide_transaction_boundary():
            return user_service.get_many_by_id(ids=list(owners))

    def get_default_owner(self) -> RpcUser:
        if not hasattr(self, "_default_owner"):
            self._default_owner = self.get_owners()[0]
        return self._default_owner

    @property
    def default_owner_id(self):
        """
        Similar to get_default_owner but won't raise a key error
        if there is no owner. Used for analytics primarily.
        """
        if not hasattr(self, "_default_owner_id"):
            owner_ids = self.get_members_with_org_roles(roles=[roles.get_top_dog().id]).values_list(
                "user_id", flat=True
            )
            if len(owner_ids) == 0:
                return None
            self._default_owner_id = owner_ids[0]
        return self._default_owner_id

    @classmethod
    def _get_bulk_owner_ids(cls, organizations: Collection[Organization]) -> dict[int, int]:
        """Find user IDs of the default owners of multiple organization.

        The returned table maps organization ID to user ID.
        """
        from sentry.models.organizationmember import OrganizationMember

        owner_id_table: dict[int, int] = {}
        org_ids_to_query: list[int] = []
        for org in organizations:
            default_owner = getattr(org, "_default_owner", None)
            if default_owner and default_owner.id is not None:
                owner_id_table[org.id] = default_owner.id
            else:
                org_ids_to_query.append(org.id)

        if org_ids_to_query:
            queried_owner_ids = OrganizationMember.objects.filter(
                organization_id__in=org_ids_to_query, role=roles.get_top_dog().id
            ).values_list("organization_id", "user_id")

            for org_id, user_id in queried_owner_ids:
                # An org may have multiple owners. Here we mimic the behavior of
                # `get_default_owner`, which is to use the first one in the query
                # result's iteration order.
                if (user_id is not None) and (org_id not in owner_id_table):
                    owner_id_table[org_id] = user_id

        return owner_id_table

    @classmethod
    def get_bulk_owner_profiles(
        cls, organizations: Collection[Organization]
    ) -> dict[int, RpcUserProfile]:
        """Query for profile data of owners of multiple organizations.

        The returned table is keyed by organization ID and shows the default owner.
        An organization may have multiple owners, in which case only the default
        owner is shown. Organization IDs may be absent from the returned table if no
        owner was found.
        """

        owner_id_table = cls._get_bulk_owner_ids(organizations)
        owner_ids = list(owner_id_table.values())

        profiles = user_service.get_many_profiles(filter=dict(user_ids=owner_ids))
        profile_table = {c.id: c for c in profiles}

        return {
            org_id: profile_table[user_id]
            for (org_id, user_id) in owner_id_table.items()
            if user_id in profile_table
        }

    def has_single_owner(self):
        owners = list(
            self.get_members_with_org_roles([roles.get_top_dog().id])[:2].values_list(
                "id", flat=True
            )
        )
        return len(owners) == 1

    def get_members_with_org_roles(
        self,
        roles: Collection[str],
        include_null_users: bool = False,
    ):
        members_with_role = self.member_set.filter(role__in=roles)
        if not include_null_users:
            members_with_role = members_with_role.filter(user_id__isnull=False, user_is_active=True)

        # use union of sets because a subset may be empty
        return members_with_role

    @property
    def option_manager(self) -> OrganizationOptionManager:
        from sentry.models.options.organization_option import OrganizationOption

        return OrganizationOption.objects

    def _handle_requirement_change(self, request, task):
        actor_id = request.user.id if request.user.is_authenticated else None
        api_key_id = (
            request.auth.entity_id
            if request.auth is not None and request.auth.kind == "api_key"
            else None
        )
        ip_address = request.META["REMOTE_ADDR"]

        # Since we cannot guarantee that a task runs after the transaction completes,
        #  trigger the task queueing on transaction commit
        transaction.on_commit(
            lambda: task.delay(
                self.id, actor_id=actor_id, actor_key_id=api_key_id, ip_address=ip_address
            ),
            using=router.db_for_write(Organization),
        )

    def handle_2fa_required(self, request):
        from sentry.tasks.auth import remove_2fa_non_compliant_members

        self._handle_requirement_change(request, remove_2fa_non_compliant_members)

    @staticmethod
    def get_url_viewname() -> str:
        """
        Get the default view name for an organization taking customer-domains into account.
        """
        request = env.request
        if request and is_using_customer_domain(request):
            return "issues"
        return "sentry-organization-issue-list"

    @staticmethod
    def get_url(slug: str) -> str:
        """
        Get a relative URL to the organization's issue list with `slug`
        """
        try:
            return reverse(Organization.get_url_viewname(), args=[slug])
        except NoReverseMatch:
            return reverse(Organization.get_url_viewname())

    @cached_property
    def __has_customer_domain(self) -> bool:
        """
        Check if the current organization is using or has access to customer domains.
        """
        return has_customer_domain()

    def absolute_url(self, path: str, query: str | None = None, fragment: str | None = None) -> str:
        """
        Get an absolute URL to `path` for this organization.

        This method takes customer-domains into account and will update the path when
        customer-domains are active.
        """
        return organization_absolute_url(
            has_customer_domain=self.__has_customer_domain,
            slug=self.slug,
            path=path,
            query=query,
            fragment=fragment,
        )

    def get_scopes(self, role: Role) -> frozenset[str]:
        """
        Note that scopes for team-roles are filtered through this method too.
        """
        if bool(NON_MEMBER_SCOPES & role.scopes):
            return role.scopes

        scopes = set(role.scopes)
        if not self.get_option("sentry:events_member_admin", EVENTS_MEMBER_ADMIN_DEFAULT):
            scopes.discard("event:admin")
        if not self.get_option("sentry:alerts_member_write", ALERTS_MEMBER_WRITE_DEFAULT):
            scopes.discard("alerts:write")
        return frozenset(scopes)

    def get_option(
        self, key: str, default: Any | None = None, validate: Callable[[object], bool] | None = None
    ) -> Any:
        return self.option_manager.get_value(self, key, default, validate)

    def update_option(self, key: str, value: Any) -> bool:
        return self.option_manager.set_value(self, key, value)

    def delete_option(self, key: str) -> None:
        self.option_manager.unset_value(self, key)

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None
        if flags.hide_organizations:
            self.status = OrganizationStatus.RELOCATION_PENDING_APPROVAL
        return old_pk


@receiver(pre_delete, sender=Organization)
def delete_workflow_actions(sender, instance: Organization, **kwargs):
    from sentry.workflow_engine.models import Action, DataConditionGroupAction

    dcg_actions = DataConditionGroupAction.objects.filter(condition_group__organization=instance)
    action_ids = dcg_actions.values_list("action_id", flat=True)
    Action.objects.filter(id__in=action_ids).delete()
