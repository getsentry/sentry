from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.models import (
    GroupAssignee,
    Release,
    Environment,
    Deploy,
    ReleaseProjectEnvironment,
    OrganizationOnboardingTask,
    OnboardingTask,
    OnboardingTaskStatus,
)
from sentry.utils.samples import load_data
from datetime import datetime


class DashboardTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(DashboardTest, self).setUp()
        release = Release.objects.create(organization_id=self.organization.id, version="1")

        environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )

        deploy = Deploy.objects.create(
            environment_id=environment.id,
            organization_id=self.organization.id,
            release=release,
            date_finished="2018-05-23",
        )

        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=release.id,
            environment_id=environment.id,
            last_deploy_id=deploy.id,
        )

        self.login_as(self.user)
        self.path = u"/organizations/{}/projects/".format(self.organization.slug)

    def create_sample_event(self):
        self.init_snuba()

        event_data = load_data("python")
        event_data["event_id"] = "d964fdbd649a4cf8bfc35d18082b6b0e"
        event_data["timestamp"] = 1452683305
        event = self.store_event(
            project_id=self.project.id, data=event_data, assert_no_errors=False
        )
        event.group.update(
            first_seen=datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2018, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )
        GroupAssignee.objects.create(user=self.user, group=event.group, project=self.project)
        OrganizationOnboardingTask.objects.create_or_update(
            organization_id=self.project.organization_id,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        self.project.update(first_event=timezone.now())

    def test_project_with_no_first_event(self):
        self.project.update(first_event=None)
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_test_id("resources")
        self.browser.wait_until(".echarts-for-react path", timeout=10000)
        self.browser.snapshot("org dash no first event")

    def test_one_issue(self):
        self.create_sample_event()
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until(".echarts-for-react path", timeout=100000)
        self.browser.snapshot("org dash one issue")

    def test_rename_team_and_navigate_back(self):
        self.create_sample_event()
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.click('[data-test-id="badge-display-name"]')
        self.browser.wait_until_not(".loading-indicator")
        self.browser.click(".nav-tabs li:nth-child(3) a")
        self.browser.wait_until('input[name="slug"]')
        self.browser.element('input[name="slug"]').send_keys("-new-slug")
        self.browser.click('[aria-label="Save"]')
        self.browser.wait_until_not('[aria-label="Save"]')
        self.browser.wait_until('[data-test-id="toast-success"]')

        # Go to projects
        self.browser.click('[href="/organizations/{}/projects/"]'.format(self.organization.slug))
        self.browser.wait_until_not(".loading-indicator")

        assert self.browser.element('[data-test-id="badge-display-name"]').text == "#foo-new-slug"


class EmptyDashboardTest(AcceptanceTestCase):
    def setUp(self):
        super(EmptyDashboardTest, self).setUp()
        self.login_as(self.user)
        self.path = u"/organizations/{}/projects/".format(self.organization.slug)

    def test_new_dashboard_empty(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator")
        self.browser.snapshot("new dashboard empty")
