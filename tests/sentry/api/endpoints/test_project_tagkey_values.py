from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import TagKey, TagValue
from sentry.testutils import APITestCase


class ProjectTagKeyValuesTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        tagkey = TagKey.objects.create(project=project, key='foo')
        TagValue.objects.create(project=project, key='foo', value='bar')

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-tagkey-values', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'key': tagkey.key,
        })

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['value'] == 'bar'

    def test_query(self):
        project = self.create_project()
        tagkey = TagKey.objects.create(project=project, key='foo')
        TagValue.objects.create(project=project, key='foo', value='bar')

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-tagkey-values', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'key': tagkey.key,
        })
        response = self.client.get(url + '?query=bar')

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['value'] == 'bar'

        response = self.client.get(url + '?query=foo')

        assert response.status_code == 200
        assert len(response.data) == 0
