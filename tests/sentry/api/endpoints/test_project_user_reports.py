from __future__ import absolute_import

import six

from sentry.testutils import APITestCase
from sentry.models import EventUser, GroupStatus, UserReport


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
