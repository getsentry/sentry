import logging

from django.conf import settings
from django.db import IntegrityError

from sentry.conf.types.sentry_config import SentryMode
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import auth_control_tasks
from sentry.taskworker.retry import Retry
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)


def grant_privilege(user_id: int, team_slug: str) -> None:
    """Grant privilege to a user based on team slug. Caller must check _should_manage_privileges."""
    attrs: dict[str, bool] = {}
    permission_added = False

    if team_slug == settings.SENTRY_SCIM_STAFF_TEAM_SLUG:
        attrs["is_staff"] = True
    elif team_slug == settings.SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG:
        attrs["is_superuser"] = True
    elif team_slug == settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG:
        attrs["is_superuser"] = True
        permission_added = user_service.add_permission(
            user_id=user_id, permission="superuser.write"
        )

    if attrs:
        try:
            user_service.update_user(user_id=user_id, attrs=attrs)
            logger.info(
                "scim.privilege.grant_permission_success",
                extra={"user_id": user_id, "team_slug": team_slug},
            )
        except IntegrityError:
            logger.warning(
                "scim.privilege.grant_permission_failed_user_deleted",
                extra={"user_id": user_id, "team_slug": team_slug},
            )
            if permission_added:
                user_service.remove_permission(user_id=user_id, permission="superuser.write")
            return
        except Exception:
            if permission_added:
                user_service.remove_permission(user_id=user_id, permission="superuser.write")
            raise


def revoke_privilege(user_id: int, team_slug: str) -> None:
    """Revoke privilege from a user based on team slug. Caller must check _should_manage_privileges."""
    attrs: dict[str, bool] = {}

    if team_slug == settings.SENTRY_SCIM_STAFF_TEAM_SLUG:
        attrs["is_staff"] = False
    elif team_slug == settings.SENTRY_SCIM_SUPERUSER_READ_TEAM_SLUG:
        attrs["is_superuser"] = False
    elif team_slug == settings.SENTRY_SCIM_SUPERUSER_WRITE_TEAM_SLUG:
        attrs["is_superuser"] = False
        user_service.remove_permission(user_id=user_id, permission="superuser.write")

    if attrs:
        user_service.update_user(user_id=user_id, attrs=attrs)
        logger.info(
            "scim.privilege.revoke_permission_success",
            extra={"user_id": user_id, "team_slug": team_slug},
        )


@instrumented_task(
    name="sentry.tasks.scim.privilege_sync.sync_scim_team_privileges",
    namespace=auth_control_tasks,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.CONTROL,
)
def sync_scim_team_privileges(
    team_slug: str,
    organization_id: int,
    user_ids_to_grant: list[int],
    user_ids_to_revoke: list[int],
) -> None:
    # Safety-net: validate SaaS mode, organization id
    if settings.SENTRY_MODE != SentryMode.SAAS or organization_id != settings.SUPERUSER_ORG_ID:
        return

    # Revoke
    for user_id in user_ids_to_revoke:
        try:
            logger.info(
                "scim.task.revoking_privilege",
                extra={"user_id": user_id, "team_slug": team_slug},
            )
            revoke_privilege(user_id, team_slug)
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
    for user_id in user_ids_to_grant:
        try:
            logger.info(
                "scim.task.granting_privilege",
                extra={"user_id": user_id, "team_slug": team_slug},
            )
            grant_privilege(user_id, team_slug)
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
