from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.rule import Rule
from sentry.testutils.cases import TestMigrations


class MigrateAlertFallbackTest(TestMigrations):
    migrate_from = "0348_add_outbox_and_tombstone_tables"
    migrate_to = "0349_issue_alert_fallback"

    def create_issue_alert(self, name, project, set_fallthrough=False):
        rule = Rule()
        rule.project = project
        rule.label = name
        action = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "IssueOwners",
            "targetIdentifier": "None",
        }
        if set_fallthrough:
            action["fallthroughType"] = "AllMembers"

        rule.data["actions"] = [action]
        rule.save()
        return rule

    def setup_before_migration(self, apps):
        self.project_no_alerts = Project.objects.create(
            organization_id=self.organization.id, name="p0"
        )
        project_no_fallback = Project.objects.create(
            organization_id=self.organization.id, name="p1"
        )
        project_with_fallback_on = Project.objects.create(
            organization_id=self.organization.id, name="p2"
        )
        project_with_fallback_off = Project.objects.create(
            organization_id=self.organization.id, name="p3"
        )
        project_with_fallback_set = Project.objects.create(
            organization_id=self.organization.id, name="p4"
        )
        ProjectOwnership.objects.create(project=project_with_fallback_on, fallthrough="True")
        ProjectOwnership.objects.create(project=project_with_fallback_off, fallthrough="False")
        ProjectOwnership.objects.create(project=project_with_fallback_set, fallthrough="False")

        self.alerts = [
            self.create_issue_alert("alert1", project)
            for project in [
                project_no_fallback,
                project_with_fallback_on,
                project_with_fallback_off,
            ]
        ]

        self.alerts.append(
            self.create_issue_alert("alert1", project_with_fallback_set, set_fallthrough=True)
        )

    def test(self):
        assert not Rule.objects.filter(project_id=self.project_no_alerts.id).exists()
        for alert, expected_type in zip(
            self.alerts,
            ["ActiveMembers", "AllMembers", "NoOne", "AllMembers"],
        ):
            alert = Rule.objects.get(id=alert.id)
            action = alert.data["actions"][0]
            assert action["fallthroughType"] == expected_type
