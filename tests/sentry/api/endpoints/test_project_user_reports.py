from __future__ import absolute_import

import six
import logging

from sentry.testutils import APITestCase
from sentry.models import Environment, EventUser, GroupStatus, UserReport
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

        url = '/api/0/projects/{}/{}/user-feedback/'.format(
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

        url = '/api/0/projects/{}/{}/user-feedback/'.format(
            project.organization.slug,
            project.slug,
        )

        response = self.client.get('{}?status='.format(url), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['id'], response.data)) == sorted(
            [
                six.text_type(report_1.id),
            ]
        )


class CreateProjectUserReportTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event = self.create_event(group=group)

        url = '/api/0/projects/{}/{}/user-feedback/'.format(
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
        assert report.group == group
        assert report.email == 'foo@example.com'
        assert report.name == 'Foo Bar'
        assert report.comments == 'It broke!'

    def test_already_present(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event = self.create_event(group=group)
        UserReport.objects.create(
            group=group,
            project=project,
            event_id=event.event_id,
            name='foo',
            email='bar@example.com',
            comments='',
        )

        url = '/api/0/projects/{}/{}/user-feedback/'.format(
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
        assert report.group == group
        assert report.email == 'foo@example.com'
        assert report.name == 'Foo Bar'
        assert report.comments == 'It broke!'

    def test_already_present_with_matching_user(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event = self.create_event(
            group=group, tags={
                'sentry:user': 'email:foo@example.com',
            }
        )
        euser = EventUser.objects.create(
            project_id=project.id,
            name='',
            email='foo@example.com',
        )
        UserReport.objects.create(
            group=group,
            project=project,
            event_id=event.event_id,
            name='foo',
            email='bar@example.com',
            comments='',
        )

        url = '/api/0/projects/{}/{}/user-feedback/'.format(
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
        assert report.group == group
        assert report.email == 'foo@example.com'
        assert report.name == 'Foo Bar'
        assert report.comments == 'It broke!'
        assert report.event_user_id == euser.id

        euser = EventUser.objects.get(id=euser.id)
        assert euser.name == 'Foo Bar'


class ProjectUserReportByEnvironmentsTest(APITestCase):
    def setUp(self):

        self.project = self.create_project()
        self.env1 = self.create_environment(self.project, 'production')
        self.env2 = self.create_environment(self.project, 'staging')

        self.group = self.create_group(project=self.project)

        self.env1_events = self.create_events_for_environment(self.group, self.env1, 5)
        self.env2_events = self.create_events_for_environment(self.group, self.env2, 5)

        self.env1_userreports = self.create_user_report_for_events(
            self.project, self.group, self.env1_events, self.env1)
        self.env2_userreports = self.create_user_report_for_events(
            self.project, self.group, self.env2_events, self.env2)

        self.path = '/api/0/projects/{}/{}/user-feedback/'.format(
            self.project.organization.slug,
            self.project.slug,
        )

    def make_event(self, **kwargs):
        result = {
            'event_id': 'a' * 32,
            'message': 'foo',
            'timestamp': 1403007314.570599,
            'level': logging.ERROR,
            'logger': 'default',
            'tags': [],
        }
        result.update(kwargs)
        return result

    def create_environment(self, project, name):
        env = Environment.objects.create(
            project_id=project.id,
            organization_id=project.organization_id,
            name=name,
        )
        env.add_project(project)
        return env

    def create_events_for_environment(self, group, environment, num_events):
        return [self.create_event(group=group, tags={
            'environment': environment.name}) for __i in range(num_events)]

    def create_user_report_for_events(self, project, group, events, environment):
        reports = []
        for i, event in enumerate(events):
            reports.append(UserReport.objects.create(
                group=group,
                project=project,
                event_id=event.event_id,
                name='foo%d' % i,
                email='bar%d@example.com' % i,
                comments='It Broke!!!',
                environment=environment,
            ))
        return reports

    def test_environment_gets_user_report(self):
        event_id = 'a' * 32
        manager = EventManager(
            self.make_event(
                environment=self.env1.name,
                event_id=event_id,
                group=self.group))
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
                event_id=event_id,
                group=self.group))
        manager.normalize()
        manager.save(self.project.id)
        assert response.status_code == 200, response.content
        assert UserReport.objects.get(event_id=event_id).environment == self.env1

    def assert_same_userreports(self, response_data, userreports):
        assert sorted(int(r.get('id')) for r in response_data) == sorted(
            r.id for r in userreports)
        assert sorted(r.get('eventID') for r in response_data) == sorted(
            r.event_id for r in userreports)

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
        assert response.status_code == 400
        assert response.data == {'environment': 'Invalid environment'}

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
        assert response.status_code == 400
        assert response.data == {'environment': 'Invalid environment'}
