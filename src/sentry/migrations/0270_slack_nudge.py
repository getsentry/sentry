from django.db import migrations

from sentry.notifications.notifications.integration_nudge import IntegrationNudgeNotification
from sentry.types.integrations import ExternalProviders
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

provider = ExternalProviders.SLACK


def send_notification_nudge(apps, schema_editor):
    Identity = apps.get_model("sentry", "Identity")
    NotificationSetting = apps.get_model("sentry", "NotificationSetting")
    Organization = apps.get_model("sentry", "Organization")
    User = apps.get_model("sentry", "User")

    for user in RangeQuerySetWrapperWithProgressBar(User.objects.all()):
        if Identity.objects.has_identity(
            user, provider
        ) and not NotificationSetting.objects.has_any_provider_settings(user, provider):
            # We only care about the organization for analytics so its ok to just grab any organization.
            organizations = Organization.objects.get_for_user(user)
            IntegrationNudgeNotification(organizations[0], user, provider).send()


class Migration(migrations.Migration):
    # This flag is used to mark that a migration shouldn't be automatically run in
    # production. We set this to True for operations that we think are risky and want
    # someone from ops to run manually and monitor.
    # General advice is that if in doubt, mark your migration as `is_dangerous`.
    # Some things you should always mark as dangerous:
    # - Large data migrations. Typically we want these to be run manually by ops so that
    #   they can be monitored. Since data migrations will now hold a transaction open
    #   this is even more important.
    # - Adding columns to highly active tables, even ones that are NULL.
    is_dangerous = False

    # This flag is used to decide whether to run this migration in a transaction or not.
    # By default we prefer to run in a transaction, but for migrations where you want
    # to `CREATE INDEX CONCURRENTLY` this needs to be set to False. Typically you'll
    # want to create an index concurrently when adding one to an existing table.
    # You'll also usually want to set this to `False` if you're writing a data
    # migration, since we don't want the entire migration to run in one long-running
    # transaction.
    atomic = False

    dependencies = [
        ("sentry", "0269_alertrule_remove_unique_name"),
    ]

    operations = [
        migrations.RunPython(
            send_notification_nudge,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_notificationsetting"]},
        )
    ]
