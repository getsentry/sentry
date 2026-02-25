"""
Convert CodeReviewEvent to use DefaultFieldsModel base class, FlexibleForeignKey
fields for organization and repository, and Organization relocation scope.

The underlying database columns (organization_id, repository_id) don't change,
only Django's field representation and the addition of FK constraints. The table
has no data yet, so all operations are safe to run as a deploy migration.
"""

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models

import sentry.db.models.fields.foreignkey
from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = False

    dependencies = [
        ("sentry", "1033_remove_grouprelease_group_id_last_seen_idx"),
    ]

    operations = [
        # Convert organization_id and repository_id from plain integer fields to
        # FlexibleForeignKey fields. The underlying column names are unchanged
        # (organization_id, repository_id), so the composite indexes and unique
        # constraint remain valid at the database level. We use SeparateDatabaseAndState
        # to update Django's state representation while only adding FK constraints
        # and a repository_id index in the database.
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Remove old composite indexes from Django state
                migrations.RemoveIndex(
                    model_name="codereviewevent",
                    name="sentry_code_organiz_4f4b09_idx",
                ),
                migrations.RemoveIndex(
                    model_name="codereviewevent",
                    name="sentry_code_organiz_7ba32c_idx",
                ),
                migrations.RemoveIndex(
                    model_name="codereviewevent",
                    name="sentry_code_organiz_76bbd1_idx",
                ),
                migrations.RemoveConstraint(
                    model_name="codereviewevent",
                    name="unique_org_repo_trigger_id",
                ),
                # Convert organization_id (BoundedBigIntegerField) to organization (FK)
                migrations.RemoveField(
                    model_name="codereviewevent",
                    name="organization_id",
                ),
                migrations.AddField(
                    model_name="codereviewevent",
                    name="organization",
                    field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="sentry.organization",
                    ),
                    preserve_default=False,
                ),
                # Convert repository_id (BoundedPositiveIntegerField) to repository (FK)
                migrations.RemoveField(
                    model_name="codereviewevent",
                    name="repository_id",
                ),
                migrations.AddField(
                    model_name="codereviewevent",
                    name="repository",
                    field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="sentry.repository",
                    ),
                    preserve_default=False,
                ),
                # Re-add indexes and constraint with FK field references.
                # Auto-generated names are identical because they're based on
                # column names which haven't changed.
                migrations.AddIndex(
                    model_name="codereviewevent",
                    index=models.Index(
                        fields=["organization", "trigger_at"],
                        name="sentry_code_organiz_4f4b09_idx",
                    ),
                ),
                migrations.AddIndex(
                    model_name="codereviewevent",
                    index=models.Index(
                        fields=["organization", "repository", "trigger_at"],
                        name="sentry_code_organiz_7ba32c_idx",
                    ),
                ),
                migrations.AddIndex(
                    model_name="codereviewevent",
                    index=models.Index(
                        fields=["organization", "repository", "pr_number"],
                        name="sentry_code_organiz_76bbd1_idx",
                    ),
                ),
                migrations.AddConstraint(
                    model_name="codereviewevent",
                    constraint=models.UniqueConstraint(
                        condition=models.Q(("trigger_id__isnull", False)),
                        fields=("organization", "repository", "trigger_id"),
                        name="unique_org_repo_trigger_id",
                    ),
                ),
            ],
            database_operations=[
                # Add FK constraint: organization_id -> sentry_organization.id
                SafeRunSQL(
                    sql=(
                        'ALTER TABLE "sentry_code_review_event" '
                        'ADD CONSTRAINT "sentry_code_review_ev_organization_id_fk" '
                        'FOREIGN KEY ("organization_id") '
                        'REFERENCES "sentry_organization" ("id") '
                        "DEFERRABLE INITIALLY DEFERRED"
                    ),
                    reverse_sql=(
                        'ALTER TABLE "sentry_code_review_event" '
                        'DROP CONSTRAINT IF EXISTS "sentry_code_review_ev_organization_id_fk"'
                    ),
                    hints={"tables": ["sentry_code_review_event"]},
                ),
                # Add FK constraint: repository_id -> sentry_repository.id
                SafeRunSQL(
                    sql=(
                        'ALTER TABLE "sentry_code_review_event" '
                        'ADD CONSTRAINT "sentry_code_review_ev_repository_id_fk" '
                        'FOREIGN KEY ("repository_id") '
                        'REFERENCES "sentry_repository" ("id") '
                        "DEFERRABLE INITIALLY DEFERRED"
                    ),
                    reverse_sql=(
                        'ALTER TABLE "sentry_code_review_event" '
                        'DROP CONSTRAINT IF EXISTS "sentry_code_review_ev_repository_id_fk"'
                    ),
                    hints={"tables": ["sentry_code_review_event"]},
                ),
                # repository_id had no index before; FK fields need one
                SafeRunSQL(
                    sql=(
                        "CREATE INDEX "
                        '"sentry_code_review_ev_repository_id_fk_idx" '
                        'ON "sentry_code_review_event" ("repository_id")'
                    ),
                    reverse_sql=(
                        'DROP INDEX IF EXISTS "sentry_code_review_ev_repository_id_fk_idx"'
                    ),
                    hints={"tables": ["sentry_code_review_event"]},
                ),
            ],
        ),
        # Add date_updated column (from DefaultFieldsModel).
        # Use SeparateDatabaseAndState: the DB gets a server-side default for
        # safe NOT NULL addition, while the Django state reflects auto_now=True.
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.AddField(
                    model_name="codereviewevent",
                    name="date_updated",
                    field=models.DateTimeField(db_default=models.functions.Now()),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="codereviewevent",
                    name="date_updated",
                    field=models.DateTimeField(auto_now=True),
                ),
            ],
        ),
        # Change date_added from default=timezone.now with db_index to auto_now_add
        migrations.AlterField(
            model_name="codereviewevent",
            name="date_added",
            field=models.DateTimeField(auto_now_add=True),
        ),
        # Add explicit named index on date_added (replaces the old db_index=True)
        migrations.AddIndex(
            model_name="codereviewevent",
            index=models.Index(fields=["date_added"], name="sentry_code_date_ad_a2451c_idx"),
        ),
    ]
