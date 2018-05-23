from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.models import GroupAssignee, Release, Environment, Deploy, ReleaseProjectEnvironment
from sentry.utils.samples import create_sample_event
from datetime import datetime


class DashboardTest(AcceptanceTestCase):
    def setUp(self):
        super(DashboardTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )

        release = Release.objects.create(
            organization_id=self.org.id,
            version='1',
        )

        environment = Environment.objects.create(
            organization_id=self.org.id,
            name='production',
        )

        deploy = Deploy.objects.create(
            environment_id=environment.id,
            organization_id=self.org.id,
            release=release,
            date_finished='2018-05-23'
        )

        ReleaseProjectEnvironment.objects.create(
            project_id=self.project.id,
            release_id=release.id,
            environment_id=environment.id,
            last_deploy_id=deploy.id
        )

        self.login_as(self.user)
        self.path = '/{}/'.format(self.org.slug)

    def test_no_issues(self):
        # I think no "activity" would be more accurate?
        self.project.update(first_event=None)
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.wait_until('[data-test-id] figure')
        self.browser.snapshot('org dash no issues')

    def test_one_issue(self):
        event = create_sample_event(
            project=self.project,
            platform='python',
            event_id='d964fdbd649a4cf8bfc35d18082b6b0e',
            timestamp=1452683305,
        )
        event.group.update(
            first_seen=datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2018, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )
        GroupAssignee.objects.create(
            user=self.user,
            group=event.group,
            project=self.project,
        )
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        self.browser.wait_until_not('.loading-indicator')
        self.browser.wait_until('[data-test-id] figure')
        self.browser.snapshot('org dash one issue')


class EmptyDashboardTest(AcceptanceTestCase):
    def setUp(self):
        super(EmptyDashboardTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        self.path = '/{}/'.format(self.org.slug)

    def test_new_dashboard_empty(self):
        with self.feature('organizations:dashboard'):
            self.browser.get(self.path)
            self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('new dashboard empty')
