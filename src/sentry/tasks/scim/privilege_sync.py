import logging
from collections import defaultdict
from collections.abc import Sequence

from django.conf import settings
from django.db import IntegrityError
from taskbroker_client.retry import Retry

from sentry.conf.types.sentry_config import SentryMode
from sentry.locks import locks
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import TeamStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import auth_tasks
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("sentry.audit.user")

SUPERUSER_WRITE_PERMISSION = "superuser.write"


def _resolve_privilege_attrs(team_slug: str, member_team_slugs: set[str]) -> dict[str, bool]:
    """Map a privileged team slug to the user attrs implied by the user's current teams."""
    if team_slug == settings.SENTRY_SCIM_STAFF_TEAM_SLUG:
        return {"is_staff": team_slug in member_team_slugs}
    superuser_slugs = {
        settings.SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG,
        settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG,
    }
    if team_slug in superuser_slugs:
        return {"is_superuser": bool(superuser_slugs & member_team_slugs)}
    return {}


def _get_member_team_slugs(organization_id: int, user_ids: Sequence[int]) -> dict[int, set[str]]:
    """Return the active team slugs each user currently belongs to in the organization."""
    member_team_slugs: dict[int, set[str]] = defaultdict(set)
    for user_id, team_slug in OrganizationMemberTeam.objects.filter(
        organizationmember__organization_id=organization_id,
        organizationmember__user_id__in=user_ids,
        team__status=TeamStatus.ACTIVE,
    ).values_list("organizationmember__user_id", "team__slug"):
        if user_id is not None:
            member_team_slugs[user_id].add(team_slug)
    return member_team_slugs


def _slug_to_permission() -> dict[str, str]:
    """Build a reverse map from team slug to permission string."""
    return {slug: perm for perm, slug in settings.SENTRY_SCIM_PERMISSION_TEAM_SLUGS.items()}


def _resolve_managed_permission(team_slug: str) -> str | None:
    """Return the UserPermission string managed by this team slug, if any."""
    if team_slug == settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG:
        return SUPERUSER_WRITE_PERMISSION
    return _slug_to_permission().get(team_slug)


def _is_privileged_slug(team_slug: str) -> bool:
    return (
        team_slug
        in (
            settings.SENTRY_SCIM_STAFF_TEAM_SLUG,
            settings.SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG,
            settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG,
        )
        or team_slug in settings.SENTRY_SCIM_PERMISSION_TEAM_SLUGS.values()
    )


def _audit_permission_change(user_id: int, permission: str | None, *, grant: bool) -> None:
    audit_logger.info(
        "user.add-permission" if grant else "user.delete-permission",
        extra={
            "actor": "scim",
            "user_id": user_id,
            "permission_name": permission,
        },
    )


def update_privilege(
    user_id: int,
    attrs: dict[str, bool],
    *,
    grant: bool,
    managed_permission: str | None,
) -> None:
    """
    Update a single user's privilege flags and optionally manage a UserPermission.

    For grants with a permission: adds permission first, rolls back on failure.
    For revokes with a permission: removes permission first (fail-secure).
    """
    permission_added = False

    if managed_permission:
        if grant:
            permission_added = user_service.add_permission(
                user_id=user_id, permission=managed_permission
            )
        else:
            removed = user_service.remove_permission(user_id=user_id, permission=managed_permission)
            if removed:
                _audit_permission_change(user_id, managed_permission, grant=False)

    if not attrs:
        if permission_added:
            _audit_permission_change(user_id, managed_permission, grant=True)
        return

    try:
        user_service.update_user(user_id=user_id, attrs=attrs)
    except IntegrityError:
        logger.warning(
            "scim.privilege.update_failed_user_deleted",
            extra={"user_id": user_id},
        )
        if permission_added:
            user_service.remove_permission(user_id=user_id, permission=managed_permission)
        return
    except Exception:
        if permission_added:
            user_service.remove_permission(user_id=user_id, permission=managed_permission)
        raise

    if permission_added:
        _audit_permission_change(user_id, managed_permission, grant=True)


@instrumented_task(
    name="sentry.tasks.scim.privilege_sync.sync_scim_team_privileges",
    namespace=auth_tasks,
    retry=Retry(times=3, on=(Exception,)),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=600,  # 10 minutes
)
def sync_scim_team_privileges(
    team_slug: str,
    organization_id: int,
    user_ids_to_grant: list[int],
    user_ids_to_revoke: list[int],
) -> None:
    if settings.SENTRY_MODE != SentryMode.SAAS or organization_id != settings.SUPERUSER_ORG_ID:
        return

    if not _is_privileged_slug(team_slug):
        return

    user_ids = sorted(set(user_ids_to_grant) | set(user_ids_to_revoke))
    if not user_ids:
        return

    managed_permission = _resolve_managed_permission(team_slug)

    # A single Okta group push sends several PATCH requests, each dispatching its own
    # task. Apply the current team membership under a lock instead of the per-request
    # grant/revoke lists, so the outcome doesn't depend on the order the tasks run in.
    lock = locks.get(
        f"scim:privilege-sync:{organization_id}", duration=600, name="scim_privilege_sync"
    )
    with lock.blocking_acquire(initial_delay=0.1, timeout=300):
        member_team_slugs = _get_member_team_slugs(organization_id, user_ids)
        for user_id in user_ids:
            is_member = team_slug in member_team_slugs[user_id]
            attrs = _resolve_privilege_attrs(team_slug, member_team_slugs[user_id])
            try:
                update_privilege(
                    user_id, attrs, grant=is_member, managed_permission=managed_permission
                )
            except Exception:
                logger.exception(
                    "scim.task.privilege_grant_failed"
                    if is_member
                    else "scim.task.privilege_revocation_failed",
                    extra={
                        "organization_id": organization_id,
                        "team_slug": team_slug,
                        "user_id": user_id,
                    },
                )
                raise
            logger.info(
                "scim.privilege.granted" if is_member else "scim.privilege.revoked",
                extra={"user_id": user_id, "team_slug": team_slug},
            )
