import logging

from django.conf import settings
from django.db import IntegrityError

from sentry.conf.types.sentry_config import SentryMode
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import auth_tasks
from sentry.taskworker.retry import Retry
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)

SUPERUSER_WRITE_PERMISSION = "superuser.write"


def _resolve_privilege_attrs(team_slug: str, *, grant: bool) -> dict[str, bool]:
    """Map a privileged team slug to the user attrs that should be set."""
    if team_slug == settings.SENTRY_SCIM_STAFF_TEAM_SLUG:
        return {"is_staff": grant}
    if team_slug in (
        settings.SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG,
        settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG,
    ):
        return {"is_superuser": grant}
    return {}


def update_privilege(
    user_id: int,
    attrs: dict[str, bool],
    *,
    grant: bool,
    manage_write_permission: bool,
) -> None:
    """
    Update a single user's privilege flags and optionally manage the superuser.write permission.

    For grants with write permission: adds permission first, rolls back on failure.
    For revokes with write permission: removes permission first (fail-secure).
    """
    permission_added = False

    if manage_write_permission:
        if grant:
            permission_added = user_service.add_permission(
                user_id=user_id, permission=SUPERUSER_WRITE_PERMISSION
            )
        else:
            user_service.remove_permission(user_id=user_id, permission=SUPERUSER_WRITE_PERMISSION)

    try:
        user_service.update_user(user_id=user_id, attrs=attrs)
    except IntegrityError:
        logger.warning(
            "scim.privilege.update_failed_user_deleted",
            extra={"user_id": user_id},
        )
        if permission_added:
            user_service.remove_permission(user_id=user_id, permission=SUPERUSER_WRITE_PERMISSION)
        return
    except Exception:
        if permission_added:
            user_service.remove_permission(user_id=user_id, permission=SUPERUSER_WRITE_PERMISSION)
        raise


@instrumented_task(
    name="sentry.tasks.scim.privilege_sync.sync_scim_team_privileges",
    namespace=auth_tasks,
    retry=Retry(times=3, on=(Exception,)),
    silo_mode=SiloMode.REGION,
)
def sync_scim_team_privileges(
    team_slug: str,
    organization_id: int,
    user_ids_to_grant: list[int],
    user_ids_to_revoke: list[int],
) -> None:
    if settings.SENTRY_MODE != SentryMode.SAAS or organization_id != settings.SUPERUSER_ORG_ID:
        return

    if team_slug not in (
        settings.SENTRY_SCIM_STAFF_TEAM_SLUG,
        settings.SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG,
        settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG,
    ):
        return

    manage_write_permission = team_slug == settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG

    # Revoke
    revoke_attrs = _resolve_privilege_attrs(team_slug, grant=False)
    for user_id in user_ids_to_revoke:
        try:
            update_privilege(
                user_id, revoke_attrs, grant=False, manage_write_permission=manage_write_permission
            )
            logger.info(
                "scim.privilege.revoked",
                extra={"user_id": user_id, "team_slug": team_slug},
            )
        except Exception:
            logger.exception(
                "scim.task.privilege_revocation_failed",
                extra={
                    "organization_id": organization_id,
                    "team_slug": team_slug,
                    "user_id": user_id,
                },
            )
            raise

    # Grant
    grant_attrs = _resolve_privilege_attrs(team_slug, grant=True)
    for user_id in user_ids_to_grant:
        try:
            update_privilege(
                user_id, grant_attrs, grant=True, manage_write_permission=manage_write_permission
            )
            logger.info(
                "scim.privilege.granted",
                extra={"user_id": user_id, "team_slug": team_slug},
            )
        except Exception:
            logger.exception(
                "scim.task.privilege_grant_failed",
                extra={
                    "organization_id": organization_id,
                    "team_slug": team_slug,
                    "user_id": user_id,
                },
            )
            raise
