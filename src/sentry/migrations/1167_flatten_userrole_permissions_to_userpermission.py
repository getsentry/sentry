"""
Flatten UserRole permissions into UserPermission rows.

UserRole stored permissions as an ArrayField on the role, resolved at runtime
via a join through UserRoleUser. This migration copies every (user, permission)
pair into the UserPermission table so the UserRole path can be removed.
"""

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration


def flatten_role_permissions(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    UserPermission = apps.get_model("sentry", "UserPermission")
    UserRoleUser = apps.get_model("sentry", "UserRoleUser")

    for role_user in UserRoleUser.objects.select_related("role").iterator():
        for permission in role_user.role.permissions:
            UserPermission.objects.get_or_create(
                user_id=role_user.user_id,
                permission=permission,
            )


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1166_externalissue_provider_assignee_updated_at"),
    ]

    operations = [
        migrations.RunPython(
            flatten_role_permissions,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_userpermission", "sentry_userrole_users", "sentry_userrole"]},
        ),
    ]
