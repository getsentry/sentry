from django.db import ProgrammingError, migrations, router, transaction

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapper


def as_dict(pds):
    return dict(
        integration_id=pds.integration_id,
        integration_key=pds.integration_key,
        service_name=pds.service_name,
        id=pds.id,
    )


def backfill_pagerdutyservices(apps, schema_editor):
    PagerDutyService = apps.get_model("sentry", "PagerDutyService")
    OrganizationIntegration = apps.get_model("sentry", "OrganizationIntegration")
    try:
        PagerDutyService.objects.first()
    except ProgrammingError:
        # Table was not created as the pagerdutyservice model has been removed.
        return

    for pds in RangeQuerySetWrapper(PagerDutyService.objects.all()):
        try:
            with transaction.atomic(router.db_for_write(OrganizationIntegration)):
                org_integration = (
                    OrganizationIntegration.objects.filter(id=pds.organization_integration_id)
                    .select_for_update()
                    .get()
                )
                existing = org_integration.config.get("pagerduty_services", [])
                org_integration.config["pagerduty_services"] = [
                    row for row in existing if row["id"] != pds.id
                ] + [as_dict(pds)]
                org_integration.save()
        except OrganizationIntegration.DoesNotExist:
            pass


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production. For
    # the most part, this should only be used for operations where it's safe to run the migration
    # after your code has deployed. So this should not be used for most operations that alter the
    # schema of a table.
    # Here are some things that make sense to mark as dangerous:
    # - Large data migrations. Typically we want these to be run manually by ops so that they can
    #   be monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   have ops run this and not block the deploy. Note that while adding an index is a schema
    #   change, it's completely safe to run the operation after the code has deployed.
    is_dangerous = True

    dependencies = [
        ("sentry", "0516_switch_pagerduty_silo"),
    ]

    operations = [
        migrations.RunPython(
            backfill_pagerdutyservices,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["sentry_organizationintegration"]},
        ),
    ]
