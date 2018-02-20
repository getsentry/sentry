from __future__ import absolute_import

from sentry.models import UserOption
from sentry.testutils import APITestCase

from django.core.urlresolvers import reverse


class UserNotificationFineTuningTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='a@example.com')
        self.org = self.create_organization(name='Org Name', owner=self.user)
        self.org2 = self.create_organization(name='Another Org', owner=self.user)
        self.team = self.create_team(name='Team Name', organization=self.org, members=[self.user])
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Project Name'
        )

        self.project2 = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Another Name'
        )

        self.login_as(user=self.user)

    def test_returns_correct_defaults(self):
        UserOption.objects.create(user=self.user, project=self.project, key="mail:alert", value=1)
        url = reverse(
            'sentry-api-0-user-notifications-fine-tuning', kwargs={
                'user_id': 'me',
                'notification_type': 'alerts',
            }
        )
        resp = self.client.get(url, format='json')

        assert resp.data.get(self.project.id) == 1

    def test_saves_and_returns_alerts(self):
        url = reverse(
            'sentry-api-0-user-notifications-fine-tuning', kwargs={
                'user_id': 'me',
                'notification_type': 'alerts',
            }
        )

        update = {}
        update[self.project.id] = 1
        update[self.project2.id] = 2

        resp = self.client.put(url, data=update)
        assert resp.status_code == 204

        assert UserOption.objects.get(
            user=self.user,
            project=self.project,
            key="mail:alert").value == 1

        assert UserOption.objects.get(
            user=self.user,
            project=self.project2,
            key="mail:alert").value == 2

        update = {}
        update[self.project.id] = -1
        # Can return to default
        resp = self.client.put(url, data=update)
        assert resp.status_code == 204

        assert not UserOption.objects.filter(
            user=self.user,
            project=self.project,
            key="mail:alert")

        assert UserOption.objects.get(
            user=self.user,
            project=self.project2,
            key="mail:alert").value == 2

    def test_saves_and_returns_workflow(self):
        url = reverse(
            'sentry-api-0-user-notifications-fine-tuning', kwargs={
                'user_id': 'me',
                'notification_type': 'workflow',
            }
        )

        update = {}
        update[self.project.id] = 1
        update[self.project2.id] = 2

        resp = self.client.put(url, data=update)
        assert resp.status_code == 204

        assert UserOption.objects.get(
            user=self.user,
            project=self.project,
            key="workflow:notifications").value == '1'

        assert UserOption.objects.get(
            user=self.user,
            project=self.project2,
            key="workflow:notifications").value == '2'

        update = {}
        update[self.project.id] = -1
        # Can return to default
        resp = self.client.put(url, data=update)
        assert resp.status_code == 204

        assert not UserOption.objects.filter(
            user=self.user,
            project=self.project,
            key="workflow:notifications")

        assert UserOption.objects.get(
            user=self.user,
            project=self.project2,
            key="workflow:notifications").value == '2'

    def test_saves_and_returns_weekly_reports(self):
        url = reverse(
            'sentry-api-0-user-notifications-fine-tuning', kwargs={
                'user_id': 'me',
                'notification_type': 'reports',
            }
        )

        update = {}
        update[self.org.id] = 0
        update[self.org2.id] = 0

        resp = self.client.put(url, data=update)
        assert resp.status_code == 204

        assert UserOption.objects.get(
            user=self.user,
            key="reports:disabled-organizations").value == [self.org.id, self.org2.id]

        update = {}
        update[self.org.id] = 1
        resp = self.client.put(url, data=update)
        assert UserOption.objects.get(
            user=self.user,
            key="reports:disabled-organizations").value == [self.org2.id]

        update = {}
        update[self.org.id] = 0
        resp = self.client.put(url, data=update)
        assert UserOption.objects.get(
            user=self.user,
            key="reports:disabled-organizations").value == [self.org.id, self.org2.id]

    def test_permissions(self):
        new_user = self.create_user(email='b@example.com')
        new_org = self.create_organization(name='New Org')
        new_team = self.create_team(name='New Team', organization=new_org, members=[new_user])
        new_project = self.create_project(
            organization=new_org,
            teams=[new_team],
            name='New Project'
        )

        url = reverse(
            'sentry-api-0-user-notifications-fine-tuning', kwargs={
                'user_id': 'me',
                'notification_type': 'reports',
            }
        )

        update = {}
        update[new_org.id] = 0

        resp = self.client.put(url, data=update)
        assert resp.status_code == 403

        assert not UserOption.objects.filter(
            user=self.user,
            organization=new_org,
            key="reports").exists()

        url = reverse(
            'sentry-api-0-user-notifications-fine-tuning', kwargs={
                'user_id': 'me',
                'notification_type': 'alerts',
            }
        )
        update = {}
        update[new_project.id] = 1
        resp = self.client.put(url, data=update)
        assert resp.status_code == 403

        assert not UserOption.objects.filter(
            user=self.user,
            project=new_project,
            key="mail:alert").exists()
