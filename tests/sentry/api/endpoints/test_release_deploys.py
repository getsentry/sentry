from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Deploy, Environment, Release
from sentry.testutils import APITestCase


class ReleaseDeploysListTest(APITestCase):
    def test_simple(self):
        project = self.create_project(
            name='foo',
        )
        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        deploy = Deploy.objects.create(
            environment_id=Environment.objects.create(
                project_id=project.id,
                name='production'
            ).id,
            organization_id=project.organization_id,
            release=release,
        )
        deploy.resources.create(
            organization_id=project.organization_id,
            name='foo'
        )
        deploy.resources.create(
            organization_id=project.organization_id,
            name='bar'
        )
        Deploy.objects.create(
            environment_id=Environment.objects.create(
                project_id=project.id,
                name='staging'
            ).id,
            organization_id=project.organization_id,
            release=release,
        )

        url = reverse('sentry-api-0-organization-release-deploys', kwargs={
            'organization_slug': project.organization.slug,
            'version': release.version,
        })

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[0]['environment'] == 'staging'
        assert response.data[1]['environment'] == 'production'
        assert response.data[1]['resources'] == ['foo', 'bar']
