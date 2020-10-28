from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ShortIdLookupEndpointTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org)
        group = self.create_group(project=project, short_id=project.next_short_id())

        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-short-id-lookup",
            kwargs={"organization_slug": org.slug, "short_id": group.qualified_short_id},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["organizationSlug"] == org.slug
        assert response.data["projectSlug"] == project.slug
        assert response.data["groupId"] == six.text_type(group.id)
        assert response.data["group"]["id"] == six.text_type(group.id)
