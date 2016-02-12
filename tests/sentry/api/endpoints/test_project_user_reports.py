from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import UserReport


class ProjectUserReportsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
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

        url = reverse('sentry-api-0-project-user-reports', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x['id'], response.data)) == sorted([
            str(report_1.id),
        ])
