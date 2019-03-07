from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.testutils import (
    APITestCase,
    SnubaTestCase,
)


class ProjectTagsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(ProjectTagsTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    def test_simple(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)
        self.create_event(
            'a' * 32,
            group=group,
            datetime=self.min_ago,
            tags={'foo': 'oof', 'bar': 'rab'},
        )
        self.create_event(
            'b' * 32,
            group=group,
            datetime=self.min_ago,
            tags={'bar': 'rab2'},
        )

        self.login_as(user=user)

        url = reverse(
            'sentry-api-0-project-tags',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        data = {v['key']: v for v in response.data}
        assert len(data) == 2

        assert data['foo']['canDelete']
        assert data['foo']['uniqueValues'] == 1
        assert data['bar']['canDelete']
        assert data['bar']['uniqueValues'] == 2
