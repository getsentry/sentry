# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.utils.timezone
import sentry.db.models.fields.bounded
import sentry.db.models.fields.foreignkey


class Migration(migrations.Migration):
    # This flag is used to mark that a migration shouldn't be automatically run in
    # production. We set this to True for operations that we think are risky and want
    # someone from ops to run manually and monitor.
    # General advice is that if in doubt, mark your migration as `is_dangerous`.
    # Some things you should always mark as dangerous:
    # - Adding indexes to large tables. These indexes should be created concurrently,
    #   unfortunately we can't run migrations outside of a transaction until Django
    #   1.10. So until then these should be run manually.
    # - Large data migrations. Typically we want these to be run manually by ops so that
    #   they can be monitored. Since data migrations will now hold a transaction open
    #   this is even more important.
    # - Adding columns to highly active tables, even ones that are NULL.
    is_dangerous = False

    dependencies = [("sentry", "0002_912_to_recent")]

    operations = [
        migrations.CreateModel(
            name="AlertRuleTriggerAction",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("type", models.SmallIntegerField()),
                ("target_type", models.SmallIntegerField()),
                ("target_identifier", models.TextField(null=True)),
                ("target_display", models.TextField(null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "alert_rule_trigger",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.AlertRuleTrigger"
                    ),
                ),
                (
                    "integration",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Integration", null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_alertruletriggeraction"},
        ),
        migrations.AlterField(
            model_name="auditlogentry",
            name="event",
            field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                choices=[
                    (1, b"member.invite"),
                    (2, b"member.add"),
                    (3, b"member.accept-invite"),
                    (5, b"member.remove"),
                    (4, b"member.edit"),
                    (6, b"member.join-team"),
                    (7, b"member.leave-team"),
                    (8, b"member.pending"),
                    (20, b"team.create"),
                    (21, b"team.edit"),
                    (22, b"team.remove"),
                    (30, b"project.create"),
                    (31, b"project.edit"),
                    (32, b"project.remove"),
                    (33, b"project.set-public"),
                    (34, b"project.set-private"),
                    (35, b"project.request-transfer"),
                    (36, b"project.accept-transfer"),
                    (37, b"project.enable"),
                    (38, b"project.disable"),
                    (10, b"org.create"),
                    (11, b"org.edit"),
                    (12, b"org.remove"),
                    (13, b"org.restore"),
                    (40, b"tagkey.remove"),
                    (50, b"projectkey.create"),
                    (51, b"projectkey.edit"),
                    (52, b"projectkey.remove"),
                    (53, b"projectkey.enable"),
                    (53, b"projectkey.disable"),
                    (60, b"sso.enable"),
                    (61, b"sso.disable"),
                    (62, b"sso.edit"),
                    (63, b"sso-identity.link"),
                    (70, b"api-key.create"),
                    (71, b"api-key.edit"),
                    (72, b"api-key.remove"),
                    (80, b"rule.create"),
                    (81, b"rule.edit"),
                    (82, b"rule.remove"),
                    (100, b"servicehook.create"),
                    (101, b"servicehook.edit"),
                    (102, b"servicehook.remove"),
                    (103, b"servicehook.enable"),
                    (104, b"servicehook.disable"),
                    (110, b"integration.add"),
                    (111, b"integration.edit"),
                    (112, b"integration.remove"),
                    (113, b"sentry-app.add"),
                    (115, b"sentry-app.remove"),
                    (116, b"sentry-app.install"),
                    (117, b"sentry-app.uninstall"),
                    (130, b"internal-integration.create"),
                    (135, b"internal-integration.add-token"),
                    (136, b"internal-integration.remove-token"),
                    (90, b"ondemand.edit"),
                    (91, b"trial.started"),
                    (92, b"plan.changed"),
                    (93, b"plan.cancelled"),
                    (140, b"invite-request.create"),
                    (141, b"invite-request.remove"),
                ]
            ),
        ),
        migrations.AlterField(
            model_name="sentryappwebhookerror",
            name="response_code",
            field=models.PositiveSmallIntegerField(null=True),
        ),
    ]
