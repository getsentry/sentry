import logging

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

logger = logging.getLogger(__name__)

BATCH_SIZE = 1000

_LEGACY_KEYS = (
    "sentry:github_pr_bot",
    "sentry:github_nudge_invite",
    "sentry:gitlab_pr_bot",
)


def purge_scm_legacy_org_options(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    OrganizationOption = apps.get_model("sentry", "OrganizationOption")

    queryset = OrganizationOption.objects.filter(key__in=_LEGACY_KEYS).values_list("id", flat=True)
    for chunk in chunked(
        RangeQuerySetWrapperWithProgressBar(queryset, result_value_getter=lambda x: x),
        BATCH_SIZE,
    ):
        OrganizationOption.objects.filter(id__in=list(chunk)).delete()


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

    is_post_deployment = True

    dependencies = [
        ("sentry", "1073_add_org_ci_scope"),
    ]

    operations = [
        migrations.RunPython(
            purge_scm_legacy_org_options,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_organizationoptions"]},
        ),
    ]
