from __future__ import absolute_import

from sentry.models import ProjectPlatform
from sentry.testutils import APITestCase
from django.core.urlresolvers import reverse
from rest_framework import status


class ProjectPlatformsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        pp1 = ProjectPlatform.objects.create(project_id=project.id, platform="javascript")
        url = '/api/0/projects/{}/{}/platforms/'.format(project.organization.slug, project.slug)
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert response.data[0]['platform'] == pp1.platform

    def test_set_platform(self):
        project = self.create_project()
        self.login_as(user=self.user)

        platform_name = "python"
        url = reverse(
            'sentry-api-0-project-platform-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.put(
            url,
            data={
                'platform': platform_name,
            },
            format='json'
        )
        assert response.status_code == status.HTTP_202_ACCEPTED, response.content
        assert response.data['platform'] == platform_name
        assert ProjectPlatform.objects.get(project_id=project.id).platform == platform_name

    def test_set_platform_invalid_data(self):
        project = self.create_project()
        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-platform-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        response = self.client.put(
            url,
            data={},
            format='json'
        )
        assert response.status_code == 400, response.content
