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
                    (1, "member.invite"),
                    (2, "member.add"),
                    (3, "member.accept-invite"),
                    (5, "member.remove"),
                    (4, "member.edit"),
                    (6, "member.join-team"),
                    (7, "member.leave-team"),
                    (8, "member.pending"),
                    (20, "team.create"),
                    (21, "team.edit"),
                    (22, "team.remove"),
                    (30, "project.create"),
                    (31, "project.edit"),
                    (32, "project.remove"),
                    (33, "project.set-public"),
                    (34, "project.set-private"),
                    (35, "project.request-transfer"),
                    (36, "project.accept-transfer"),
                    (37, "project.enable"),
                    (38, "project.disable"),
                    (10, "org.create"),
                    (11, "org.edit"),
                    (12, "org.remove"),
                    (13, "org.restore"),
                    (40, "tagkey.remove"),
                    (50, "projectkey.create"),
                    (51, "projectkey.edit"),
                    (52, "projectkey.remove"),
                    (53, "projectkey.enable"),
                    (53, "projectkey.disable"),
                    (60, "sso.enable"),
                    (61, "sso.disable"),
                    (62, "sso.edit"),
                    (63, "sso-identity.link"),
                    (70, "api-key.create"),
                    (71, "api-key.edit"),
                    (72, "api-key.remove"),
                    (80, "rule.create"),
                    (81, "rule.edit"),
                    (82, "rule.remove"),
                    (100, "servicehook.create"),
                    (101, "servicehook.edit"),
                    (102, "servicehook.remove"),
                    (103, "servicehook.enable"),
                    (104, "servicehook.disable"),
                    (110, "integration.add"),
                    (111, "integration.edit"),
                    (112, "integration.remove"),
                    (113, "sentry-app.add"),
                    (115, "sentry-app.remove"),
                    (116, "sentry-app.install"),
                    (117, "sentry-app.uninstall"),
                    (130, "internal-integration.create"),
                    (135, "internal-integration.add-token"),
                    (136, "internal-integration.remove-token"),
                    (90, "ondemand.edit"),
                    (91, "trial.started"),
                    (92, "plan.changed"),
                    (93, "plan.cancelled"),
                    (140, "invite-request.create"),
                    (141, "invite-request.remove"),
                ]
            ),
        ),
        migrations.AlterField(
            model_name="sentryappwebhookerror",
            name="response_code",
            field=models.PositiveSmallIntegerField(null=True),
        ),
    ]
