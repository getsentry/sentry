from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectPluginsTest(APITestCase):
    def test_get(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-plugins',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url)
        assert response.status_code == 200, (response.status_code, response.content)
        assert len(response.data) >= 9

        auto_tag = response.data[0]
        assert auto_tag['name'] == 'Auto Tag: Browsers'
        assert auto_tag['enabled'] is True
        assert auto_tag['isHidden'] is False
        assert 'version' in auto_tag
        assert 'author' in auto_tag
        assert 'slug' in auto_tag
        assert 'shortName' in auto_tag
