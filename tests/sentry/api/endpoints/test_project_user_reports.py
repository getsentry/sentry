from __future__ import absolute_import

import six
from datetime import timedelta
from django.utils import timezone
from exam import fixture
from uuid import uuid4

from sentry.testutils import APITestCase, UserReportEnvironmentTestCase
from sentry.models import EventUser, Environment, GroupStatus, UserReport
from sentry.event_manager import EventManager


class ProjectUserReportListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project, status=GroupStatus.RESOLVED)
        report_1 = UserReport.objects.create(
            project=project,
            event_id='a' * 32,
            name='Foo',
            email='foo@example.com',
            comments='Hello world',
            group=group,
        )

        # should not be included due to missing link
        UserReport.objects.create(
            project=project,
            event_id='b' * 32,
            name='Bar',
            email='bar@example.com',
            comments='Hello world',
        )

        # should not be included due to resolution
        UserReport.objects.create(
            project=project,
            event_id='c' * 32,
            name='Baz',
            email='baz@example.com',
            comments='Hello world',
            group=group2,
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(report_1.id),
            ]
        )

    def test_cannot_access_with_dsn_auth(self):
        project = self.create_project()
        project_key = self.create_project_key(project=project)

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.get(
            url,
            HTTP_AUTHORIZATION=u'DSN {}'.format(project_key.dsn_public),
        )

        assert response.status_code == 401, response.content

    def test_all_reports(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project, status=GroupStatus.RESOLVED)
        report_1 = UserReport.objects.create(
            project=project,
            event_id='a' * 32,
            name='Foo',
            email='foo@example.com',
            comments='Hello world',
            group=group,
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.get(u'{}?status='.format(url), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(report_1.id),
            ]
        )


class CreateProjectUserReportTest(APITestCase):
    def make_environment(self, project, name='production'):
        environment = Environment.objects.create(
            project_id=project.id,
            organization_id=project.organization_id,
            name=name,
        )
        environment.add_project(project)
        return environment

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        environment = self.make_environment(project)
        event = self.store_event(
            data={
                'tags': {'environment': environment.name}
            },
            project_id=project.id
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.post(
            url,
            data={
                'event_id': event.event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 200, response.content

        report = UserReport.objects.get(
            id=response.data['id'],
        )
        assert report.project == project
        assert report.group == event.group
        assert report.email == 'foo@example.com'
        assert report.name == 'Foo Bar'
        assert report.comments == 'It broke!'

    def test_with_dsn_auth(self):
        project = self.create_project()
        project_key = self.create_project_key(project=project)
        environment = self.make_environment(project)
        event = self.store_event(
            data={
                'environment': environment.name
            },
            project_id=project.id
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.post(
            url,
            HTTP_AUTHORIZATION=u'DSN {}'.format(project_key.dsn_public),
            data={
                'event_id': event.event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 200, response.content

    def test_with_dsn_auth_invalid_project(self):
        project = self.create_project()
        project2 = self.create_project()
        project_key = self.create_project_key(project=project)

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project2.organization.slug,
            project2.slug,
        )

        response = self.client.post(
            url,
            HTTP_AUTHORIZATION=u'DSN {}'.format(project_key.dsn_public),
            data={
                'event_id': uuid4().hex,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 400, response.content

    def test_already_present(self):
        self.login_as(user=self.user)
        project = self.create_project()
        environment = self.make_environment(project)
        event = self.store_event(
            data={
                'environment': environment.name
            },
            project_id=project.id
        )

        UserReport.objects.create(
            group=event.group,
            project=project,
            event_id=event.event_id,
            name='foo',
            email='bar@example.com',
            comments='',
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.post(
            url,
            data={
                'event_id': event.event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 200, response.content

        report = UserReport.objects.get(
            id=response.data['id'],
        )
        assert report.project == project
        assert report.group == event.group
        assert report.email == 'foo@example.com'
        assert report.name == 'Foo Bar'
        assert report.comments == 'It broke!'

    def test_already_present_with_matching_user(self):
        self.login_as(user=self.user)

        project = self.create_project()
        environment = self.make_environment(project)
        event = self.create_event(
            data={
                'tags': {
                    'sentry:user': 'email:foo@example.com',
                    'environment': environment.name,
                }
            },
            project_id=project.id
        )

        euser = EventUser.objects.create(
            project_id=project.id,
            name='',
            email='foo@example.com',
        )
        UserReport.objects.create(
            group=event.group,
            project=project,
            event_id=event.event_id,
            name='foo',
            email='bar@example.com',
            comments='',
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.post(
            url,
            data={
                'event_id': event.event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 200, response.content

        report = UserReport.objects.get(
            id=response.data['id'],
        )
        assert report.project == project
        assert report.group == event.group
        assert report.email == 'foo@example.com'
        assert report.name == 'Foo Bar'
        assert report.comments == 'It broke!'
        assert report.event_user_id == euser.id

        euser = EventUser.objects.get(id=euser.id)
        assert euser.name == 'Foo Bar'

    def test_already_present_after_deadline(self):
        self.login_as(user=self.user)

        project = self.create_project()
        environment = self.make_environment(project)
        event = self.create_event(
            data={
                'tags': {
                    'environment': environment.name
                }
            },
            project_id=project.id
        )

        UserReport.objects.create(
            group=event.group,
            project=project,
            event_id=event.event_id,
            name='foo',
            email='bar@example.com',
            comments='',
            date_added=timezone.now() - timedelta(minutes=10),
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.post(
            url,
            data={
                'event_id': event.event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 409, response.content

    def test_after_event_deadline(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        environment = self.make_environment(project)
        event = self.create_event(
            group=group,
            tags={'environment': environment.name},
            datetime=timezone.now() - timedelta(minutes=60),
        )

        url = u'/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.post(
            url,
            data={
                'event_id': event.event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 409, response.content


class ProjectUserReportByEnvironmentsTest(UserReportEnvironmentTestCase):

    def setUp(self):
        super(ProjectUserReportByEnvironmentsTest, self).setUp()
        group_2 = self.create_group()
        env1_events = self.create_events_for_environment(group_2, self.env1, 5)
        env2_events = self.create_events_for_environment(group_2, self.env2, 5)

        self.env1_userreports += self.create_user_report_for_events(
            self.project, group_2, env1_events, self.env1)
        self.env2_userreports += self.create_user_report_for_events(
            self.project, group_2, env2_events, self.env2)

        self.env1_events += env1_events
        self.env2_events += env2_events

    @fixture
    def path(self):
        return u'/api/0/projects/{}/{}/user-feedback/'.format(
            self.project.organization.slug,
            self.project.slug,
        )

    def test_environment_gets_user_report(self):
        event_id = 'a' * 32
        manager = EventManager(
            self.make_event(
                environment=self.env1.name,
                event_id=event_id))
        manager.normalize()
        manager.save(self.project.id)

        self.login_as(user=self.user)
        response = self.client.post(
            self.path,
            data={
                'event_id': event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        assert response.status_code == 200, response.content
        assert UserReport.objects.get(event_id=event_id).environment == self.env1

    def test_user_report_gets_environment(self):
        event_id = 'a' * 32
        self.login_as(user=self.user)
        response = self.client.post(
            self.path,
            data={
                'event_id': event_id,
                'email': 'foo@example.com',
                'name': 'Foo Bar',
                'comments': 'It broke!',
            }
        )

        manager = EventManager(
            self.make_event(
                environment=self.env1.name,
                event_id=event_id))
        manager.normalize()
        manager.save(self.project.id)
        assert response.status_code == 200, response.content
        assert UserReport.objects.get(event_id=event_id).environment == self.env1

    def test_specified_enviroment(self):
        self.login_as(user=self.user)

        response = self.client.get(self.path + '?environment=' + self.env1.name)
        assert response.status_code == 200, response.content
        assert len(response.data) == len(self.env1_events)
        self.assert_same_userreports(response.data, self.env1_userreports)

        response = self.client.get(self.path + '?environment=' + self.env2.name)
        assert response.status_code == 200, response.content
        assert len(response.data) == len(self.env2_events)
        self.assert_same_userreports(response.data, self.env2_userreports)

    def test_no_environment_does_not_exists(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path + '?environment=')
        assert response.status_code == 200
        assert response.data == []

    def test_no_environment(self):
        self.login_as(user=self.user)

        empty_env = self.create_environment(self.project, u'')
        empty_env_events = self.create_events_for_environment(self.group, empty_env, 5)
        userreports = self.create_user_report_for_events(
            self.project, self.group, empty_env_events, empty_env)
        response = self.client.get(self.path + '?environment=')

        assert response.status_code == 200, response.content
        assert len(response.data) == len(userreports)
        self.assert_same_userreports(response.data, userreports)

    def test_all_environments(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path)
        userreports = self.env1_userreports + self.env2_userreports

        assert response.status_code == 200, response.content
        assert len(response.data) == len(userreports)
        self.assert_same_userreports(response.data, userreports)

    def test_invalid_environment(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path + '?environment=invalid_env')
        assert response.status_code == 200
        assert response.data == []
