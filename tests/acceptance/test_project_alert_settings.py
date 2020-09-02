from __future__ import absolute_import

from sentry.models import Rule
from sentry.testutils import AcceptanceTestCase


class ProjectAlertSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectAlertSettingsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        action_data = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification (for all legacy integrations)",
            },
            {
                "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                "service": "mail",
                "name": "Send a notification via mail",
            },
        ]
        condition_data = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "The issue is first seen",
            },
            {
                "id": "sentry.rules.conditions.every_event.EveryEventCondition",
                "name": "An event occurs",
            },
        ]

        Rule.objects.filter(project=self.project).delete()

        Rule.objects.create(
            project=self.project, data={"conditions": condition_data, "actions": action_data}
        )

        self.login_as(self.user)
        self.path1 = u"/settings/{}/projects/{}/alerts/".format(self.org.slug, self.project.slug)

    def test_settings_load(self):
        self.browser.get(self.path1)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("project alert settings")
        self.browser.wait_until(".ref-plugin-enable-webhooks")
        self.browser.click(".ref-plugin-enable-webhooks")
        self.browser.wait_until(".ref-plugin-config-webhooks")
        self.browser.wait_until_not(".loading-indicator")

        # flakey Toast animation being snapshotted in CI
        # click it to clear it before snapshotting
        self.browser.click_when_visible('[data-test-id="toast-success"]')
        self.browser.wait_until_not('[data-test-id="toast-success"]')
        self.browser.snapshot("project alert settings webhooks enabled")
