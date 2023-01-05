from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.rule import Rule
from sentry.testutils.cases import TestMigrations


class BackfillAlertRuleTypeTest(TestMigrations):
    migrate_from = "0347_add_project_has_minified_stack_trace_flag"
    migrate_to = "0348_issue_alert_fallback"

    def create_issue_alert(self, name, project):
        rule = Rule()
        rule.project = project
        rule.label = name
        rule.data["actions"] = [
            {
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetType": "IssueOwners",
                "targetIdentifier": "None",
            }
        ]

        rule.save()
        return rule

    def setup_before_migration(self, apps):
        project_no_fallback = Project.objects.create(
            organization_id=self.organization.id, name="p1"
        )
        project_with_fallback_on = Project.objects.create(
            organization_id=self.organization.id, name="p2"
        )
        project_with_fallback_off = Project.objects.create(
            organization_id=self.organization.id, name="p3"
        )
        ProjectOwnership.objects.create(project=project_with_fallback_on, fallthrough="True")
        ProjectOwnership.objects.create(project=project_with_fallback_off, fallthrough="False")

        self.alerts = [
            self.create_issue_alert("alert1", project)
            for project in [
                project_no_fallback,
                project_with_fallback_on,
                project_with_fallback_off,
            ]
        ]

        Rule.objects.filter(id__in=[alert.id for alert in self.alerts])

    def test(self):
        for alert, expected_type in zip(
            self.alerts,
            ["ActiveMembers", "AllMembers", "NoOne"],
        ):
            alert = Rule.objects.get(id=alert.id)
            action = alert.data["actions"][0]
            assert action["fallthroughType"] == expected_type
        assert True
