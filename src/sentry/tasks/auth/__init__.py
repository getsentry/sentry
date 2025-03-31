from sentry.taskworker.registry import taskregistry

auth_tasks = taskregistry.create_namespace("auth")
auth_control_tasks = taskregistry.create_namespace("auth.control")


__all__ = (
    "email_missing_links",
    "email_missing_links_control",
    "email_unlink_notifications",
    "remove_2fa_non_compliant_members",
    "check_auth",
    "check_auth_identities",
    "check_auth_identity",
)

from .auth import (
    email_missing_links,
    email_missing_links_control,
    email_unlink_notifications,
    remove_2fa_non_compliant_members,
)
from .check_auth import check_auth, check_auth_identities, check_auth_identity
