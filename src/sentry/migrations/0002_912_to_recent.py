# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import sentry.db.models.fields.bounded
import sentry.db.models.fields.jsonfield
import sentry.db.models.fields.uuid
import sentry.db.models.fields.array
import django.utils.timezone
import sentry.db.models.fields.foreignkey
import django.db.models.deletion
from django.conf import settings
import sentry.db.models.fields.encrypted


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

    dependencies = [("sentry", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="AlertRule",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("name", models.TextField()),
                ("status", models.SmallIntegerField(default=0)),
                ("dataset", models.TextField()),
                ("query", models.TextField()),
                ("include_all_projects", models.BooleanField(default=False)),
                ("aggregation", models.IntegerField(default=0)),
                ("time_window", models.IntegerField()),
                ("resolution", models.IntegerField()),
                ("threshold_type", models.SmallIntegerField(null=True)),
                ("alert_threshold", models.IntegerField(null=True)),
                ("resolve_threshold", models.IntegerField(null=True)),
                ("threshold_period", models.IntegerField()),
                ("date_modified", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_alertrule"},
        ),
        migrations.CreateModel(
            name="AlertRuleExcludedProjects",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "alert_rule",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.AlertRule", db_index=False
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Project", db_constraint=False
                    ),
                ),
            ],
            options={"db_table": "sentry_alertruleexcludedprojects"},
        ),
        migrations.CreateModel(
            name="AlertRuleQuerySubscription",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "alert_rule",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.AlertRule"),
                ),
            ],
            options={"db_table": "sentry_alertrulequerysubscription"},
        ),
        migrations.CreateModel(
            name="AlertRuleTrigger",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("label", models.TextField()),
                ("threshold_type", models.SmallIntegerField()),
                ("alert_threshold", models.IntegerField()),
                ("resolve_threshold", models.IntegerField(null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "alert_rule",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.AlertRule"),
                ),
            ],
            options={"db_table": "sentry_alertruletrigger"},
        ),
        migrations.CreateModel(
            name="AlertRuleTriggerExclusion",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "alert_rule_trigger",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="exclusions", to="sentry.AlertRuleTrigger"
                    ),
                ),
            ],
            options={"db_table": "sentry_alertruletriggerexclusion"},
        ),
        migrations.CreateModel(
            name="Incident",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("identifier", models.IntegerField()),
                (
                    "detection_uuid",
                    sentry.db.models.fields.uuid.UUIDField(max_length=32, null=True, db_index=True),
                ),
                ("status", models.PositiveSmallIntegerField(default=1)),
                ("type", models.PositiveSmallIntegerField(default=1)),
                ("title", models.TextField()),
                ("query", models.TextField()),
                ("date_started", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_detected", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_closed", models.DateTimeField(null=True)),
                (
                    "alert_rule",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.AlertRule",
                        null=True,
                    ),
                ),
            ],
            options={"db_table": "sentry_incident"},
        ),
        migrations.CreateModel(
            name="IncidentActivity",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("type", models.IntegerField()),
                ("value", models.TextField(null=True)),
                ("previous_value", models.TextField(null=True)),
                ("comment", models.TextField(null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_incidentactivity"},
        ),
        migrations.CreateModel(
            name="IncidentGroup",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                )
            ],
            options={"db_table": "sentry_incidentgroup"},
        ),
        migrations.CreateModel(
            name="IncidentProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "incident",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Incident"),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        db_constraint=False, to="sentry.Project", db_index=False
                    ),
                ),
            ],
            options={"db_table": "sentry_incidentproject"},
        ),
        migrations.CreateModel(
            name="IncidentSeen",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("last_seen", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "incident",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Incident"),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL, db_index=False
                    ),
                ),
            ],
            options={"db_table": "sentry_incidentseen"},
        ),
        migrations.CreateModel(
            name="IncidentSnapshot",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("unique_users", models.IntegerField()),
                ("total_events", models.IntegerField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_incidentsnapshot"},
        ),
        migrations.CreateModel(
            name="IncidentSubscription",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "incident",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Incident", db_index=False
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_incidentsubscription"},
        ),
        migrations.CreateModel(
            name="IncidentSuspectCommit",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("order", models.SmallIntegerField()),
                (
                    "commit",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Commit", db_constraint=False
                    ),
                ),
                (
                    "incident",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Incident", db_index=False
                    ),
                ),
            ],
            options={"db_table": "sentry_incidentsuspectcommit"},
        ),
        migrations.CreateModel(
            name="IncidentTrigger",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("status", models.SmallIntegerField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "alert_rule_trigger",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.AlertRuleTrigger"
                    ),
                ),
                (
                    "incident",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Incident", db_index=False
                    ),
                ),
            ],
            options={"db_table": "sentry_incidenttrigger"},
        ),
        migrations.CreateModel(
            name="IntegrationFeature",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("user_description", models.TextField(null=True)),
                (
                    "feature",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "integrations-api"),
                            (1, "integrations-issue-link"),
                            (2, "integrations-stacktrace-link"),
                            (3, "integrations-event-hooks"),
                        ],
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_integrationfeature"},
        ),
        migrations.CreateModel(
            name="PagerDutyService",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("integration_key", models.CharField(max_length=255)),
                ("service_id", models.CharField(max_length=255)),
                ("service_name", models.CharField(max_length=255)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "organization_integration",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.OrganizationIntegration"
                    ),
                ),
            ],
            options={"db_table": "sentry_pagerdutyservice"},
        ),
        migrations.CreateModel(
            name="PagerDutyServiceProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("integration_key", models.CharField(max_length=255, null=True)),
                ("service_id", models.CharField(max_length=255, null=True)),
                ("service_name", models.CharField(max_length=255, null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                (
                    "organization_integration",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.OrganizationIntegration", null=True
                    ),
                ),
                (
                    "pagerduty_service",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.PagerDutyService"
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        db_constraint=False, to="sentry.Project", db_index=False
                    ),
                ),
            ],
            options={"db_table": "sentry_pagerdutyserviceproject"},
        ),
        migrations.CreateModel(
            name="QuerySubscription",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("type", models.TextField()),
                ("subscription_id", models.TextField(unique=True)),
                ("dataset", models.TextField()),
                ("query", models.TextField()),
                ("aggregation", models.IntegerField(default=0)),
                ("time_window", models.IntegerField()),
                ("resolution", models.IntegerField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Project", db_constraint=False
                    ),
                ),
            ],
            options={"db_table": "sentry_querysubscription"},
        ),
        migrations.CreateModel(
            name="SentryAppInstallationToken",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "api_token",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.ApiToken"),
                ),
            ],
            options={"db_table": "sentry_sentryappinstallationtoken"},
        ),
        migrations.CreateModel(
            name="SentryAppWebhookError",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "date_added",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                (
                    "request_body",
                    sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict),
                ),
                (
                    "request_headers",
                    sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict),
                ),
                ("event_type", models.CharField(max_length=64)),
                ("webhook_url", models.URLField()),
                ("response_body", models.TextField()),
                ("response_code", models.PositiveSmallIntegerField()),
            ],
            options={"db_table": "sentry_sentryappwebhookerror"},
        ),
        migrations.CreateModel(
            name="TimeSeriesSnapshot",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("start", models.DateTimeField()),
                ("end", models.DateTimeField()),
                ("values", sentry.db.models.fields.array.ArrayField(null=True)),
                ("period", models.IntegerField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_timeseriessnapshot"},
        ),
        migrations.DeleteModel(name="EventMapping"),
        migrations.DeleteModel(name="EventTag"),
        migrations.DeleteModel(name="GroupTagKey"),
        migrations.DeleteModel(name="GroupTagValue"),
        # migrations.AlterUniqueTogether(
        #     name='projectcficachefile',
        #     unique_together=set([]),
        # ),
        migrations.RemoveField(model_name="projectcficachefile", name="cache_file"),
        migrations.RemoveField(model_name="projectcficachefile", name="debug_file"),
        migrations.RemoveField(model_name="projectcficachefile", name="project"),
        migrations.AlterUniqueTogether(name="projectsymcachefile", unique_together=set([])),
        migrations.RemoveField(model_name="projectsymcachefile", name="cache_file"),
        migrations.RemoveField(model_name="projectsymcachefile", name="debug_file"),
        migrations.RemoveField(model_name="projectsymcachefile", name="project"),
        migrations.DeleteModel(name="TagKey"),
        migrations.DeleteModel(name="TagValue"),
        migrations.RemoveField(model_name="sentryappinstallation", name="authorization"),
        migrations.AddField(
            model_name="broadcast",
            name="cta",
            field=models.CharField(max_length=256, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="groupredirect",
            name="organization_id",
            field=sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="groupredirect",
            name="previous_project_slug",
            field=models.SlugField(null=True),
        ),
        migrations.AddField(
            model_name="groupredirect",
            name="previous_short_id",
            field=sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="organizationmember",
            name="invite_status",
            field=models.PositiveSmallIntegerField(
                default=0,
                null=True,
                choices=[
                    (0, "Approved"),
                    (1, "Organization member requested to invite user"),
                    (2, "User requested to join organization"),
                ],
            ),
        ),
        migrations.AddField(
            model_name="organizationmember",
            name="inviter",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="sentry_inviter_set",
                blank=True,
                to=settings.AUTH_USER_MODEL,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="projectownership",
            name="auto_assignment",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="sentryapp", name="verify_install", field=models.BooleanField(default=True)
        ),
        migrations.AddField(
            model_name="sentryappinstallation",
            name="api_token",
            field=models.OneToOneField(
                related_name="sentry_app_installation",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="sentry.ApiToken",
            ),
        ),
        migrations.AddField(
            model_name="sentryappinstallation",
            name="status",
            field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                default=0, db_index=True, choices=[(0, "pending"), (1, "installed")]
            ),
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
                ]
            ),
        ),
        migrations.AlterField(
            model_name="commitfilechange", name="filename", field=models.CharField(max_length=255)
        ),
        migrations.AlterField(
            model_name="discoversavedquery",
            name="query",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="externalissue",
            name="metadata",
            field=sentry.db.models.fields.jsonfield.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name="featureadoption",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="file",
            name="headers",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="group",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AlterField(
            model_name="grouplink",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="groupsnooze",
            name="state",
            field=sentry.db.models.fields.jsonfield.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name="organization",
            name="default_role",
            field=models.CharField(
                default="member",
                max_length=32,
                choices=[
                    ("member", "Member"),
                    ("admin", "Admin"),
                    ("manager", "Manager"),
                    ("owner", "Organization Owner"),
                ],
            ),
        ),
        migrations.AlterField(
            model_name="organizationmember",
            name="role",
            field=models.CharField(
                default="member",
                max_length=32,
                choices=[
                    ("member", "Member"),
                    ("admin", "Admin"),
                    ("manager", "Manager"),
                    ("owner", "Organization Owner"),
                ],
            ),
        ),
        migrations.AlterField(
            model_name="organizationonboardingtask",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="projectdebugfile",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name="projectkey",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="projectownership",
            name="schema",
            field=sentry.db.models.fields.jsonfield.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name="promptsactivity",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default={}),
        ),
        migrations.AlterField(
            model_name="release",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default={}),
        ),
        migrations.AlterField(
            model_name="release",
            name="project_id",
            field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
        ),
        migrations.AlterField(
            model_name="releasefile",
            name="project_id",
            field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
        ),
        migrations.AlterField(
            model_name="repository",
            name="config",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="scheduleddeletion",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default={}),
        ),
        migrations.AlterField(
            model_name="scheduledjob",
            name="payload",
            field=sentry.db.models.fields.jsonfield.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name="sentryapp",
            name="status",
            field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                default=0,
                db_index=True,
                choices=[(0, "unpublished"), (1, "published"), (2, "internal")],
            ),
        ),
        migrations.AlterField(
            model_name="sentryapp", name="webhook_url", field=models.URLField(null=True)
        ),
        migrations.AlterField(
            model_name="widget",
            name="display_options",
            field=sentry.db.models.fields.jsonfield.JSONField(default={}),
        ),
        migrations.AlterField(
            model_name="widgetdatasource",
            name="data",
            field=sentry.db.models.fields.jsonfield.JSONField(default={}),
        ),
        migrations.AlterUniqueTogether(
            name="groupassignee", unique_together=set([("project", "group")])
        ),
        migrations.AlterUniqueTogether(
            name="groupredirect",
            unique_together=set(
                [("organization_id", "previous_short_id", "previous_project_slug")]
            ),
        ),
        migrations.AlterIndexTogether(
            name="group", index_together=set([("project", "first_release"), ("project", "id")])
        ),
        migrations.DeleteModel(name="ProjectCfiCacheFile"),
        migrations.DeleteModel(name="ProjectSymCacheFile"),
        migrations.AddField(
            model_name="sentryappwebhookerror",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="sentry_app_webhook_errors", to="sentry.Organization"
            ),
        ),
        migrations.AddField(
            model_name="sentryappwebhookerror",
            name="sentry_app",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="webhook_errors", to="sentry.SentryApp"
            ),
        ),
        migrations.AddField(
            model_name="sentryappinstallationtoken",
            name="sentry_app_installation",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.SentryAppInstallation"
            ),
        ),
        migrations.AddField(
            model_name="integrationfeature",
            name="sentry_app",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.SentryApp"),
        ),
        migrations.AddField(
            model_name="incidentsnapshot",
            name="event_stats_snapshot",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.TimeSeriesSnapshot"
            ),
        ),
        migrations.AddField(
            model_name="incidentsnapshot",
            name="incident",
            field=models.OneToOneField(to="sentry.Incident"),
        ),
        migrations.AddField(
            model_name="incidentgroup",
            name="group",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                db_constraint=False, to="sentry.Group", db_index=False
            ),
        ),
        migrations.AddField(
            model_name="incidentgroup",
            name="incident",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Incident"),
        ),
        migrations.AddField(
            model_name="incidentactivity",
            name="event_stats_snapshot",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.TimeSeriesSnapshot", null=True
            ),
        ),
        migrations.AddField(
            model_name="incidentactivity",
            name="incident",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Incident"),
        ),
        migrations.AddField(
            model_name="incidentactivity",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to=settings.AUTH_USER_MODEL, null=True
            ),
        ),
        migrations.AddField(
            model_name="incident",
            name="groups",
            field=models.ManyToManyField(
                related_name="incidents", through="sentry.IncidentGroup", to="sentry.Group"
            ),
        ),
        migrations.AddField(
            model_name="incident",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
        ),
        migrations.AddField(
            model_name="incident",
            name="projects",
            field=models.ManyToManyField(
                related_name="incidents", through="sentry.IncidentProject", to="sentry.Project"
            ),
        ),
        migrations.AddField(
            model_name="alertruletriggerexclusion",
            name="query_subscription",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.QuerySubscription"
            ),
        ),
        migrations.AddField(
            model_name="alertruletrigger",
            name="triggered_incidents",
            field=models.ManyToManyField(
                related_name="triggers", through="sentry.IncidentTrigger", to="sentry.Incident"
            ),
        ),
        migrations.AddField(
            model_name="alertrulequerysubscription",
            name="query_subscription",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.QuerySubscription", unique=True
            ),
        ),
        migrations.AddField(
            model_name="alertrule",
            name="excluded_projects",
            field=models.ManyToManyField(
                related_name="alert_rule_exclusions",
                through="sentry.AlertRuleExcludedProjects",
                to="sentry.Project",
            ),
        ),
        migrations.AddField(
            model_name="alertrule",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Organization", null=True, db_index=False
            ),
        ),
        migrations.AddField(
            model_name="alertrule",
            name="query_subscriptions",
            field=models.ManyToManyField(
                related_name="alert_rules",
                through="sentry.AlertRuleQuerySubscription",
                to="sentry.QuerySubscription",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="sentryappinstallationtoken",
            unique_together=set([("sentry_app_installation", "api_token")]),
        ),
        migrations.AlterUniqueTogether(
            name="pagerdutyserviceproject", unique_together=set([("project", "pagerduty_service")])
        ),
        migrations.AlterUniqueTogether(
            name="pagerdutyservice",
            unique_together=set([("service_id", "organization_integration")]),
        ),
        migrations.AlterUniqueTogether(
            name="integrationfeature", unique_together=set([("sentry_app", "feature")])
        ),
        migrations.AlterUniqueTogether(
            name="incidenttrigger", unique_together=set([("incident", "alert_rule_trigger")])
        ),
        migrations.AlterUniqueTogether(
            name="incidentsuspectcommit", unique_together=set([("incident", "commit")])
        ),
        migrations.AlterUniqueTogether(
            name="incidentsubscription", unique_together=set([("incident", "user")])
        ),
        migrations.AlterUniqueTogether(
            name="incidentseen", unique_together=set([("user", "incident")])
        ),
        migrations.AlterUniqueTogether(
            name="incidentproject", unique_together=set([("project", "incident")])
        ),
        migrations.AlterUniqueTogether(
            name="incidentgroup", unique_together=set([("group", "incident")])
        ),
        migrations.AlterUniqueTogether(
            name="incident", unique_together=set([("organization", "identifier")])
        ),
        migrations.AlterIndexTogether(
            name="incident", index_together=set([("alert_rule", "type", "status")])
        ),
        migrations.AlterUniqueTogether(
            name="alertruletriggerexclusion",
            unique_together=set([("alert_rule_trigger", "query_subscription")]),
        ),
        migrations.AlterUniqueTogether(
            name="alertruletrigger", unique_together=set([("alert_rule", "label")])
        ),
        migrations.AlterUniqueTogether(
            name="alertruleexcludedprojects", unique_together=set([("alert_rule", "project")])
        ),
        migrations.AlterUniqueTogether(
            name="alertrule", unique_together=set([("organization", "name")])
        ),
    ]
