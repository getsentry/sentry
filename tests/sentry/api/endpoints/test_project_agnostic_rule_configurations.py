from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectAgnosticRuleConfigurationsTest(APITestCase):
    def test_simple(self):

        with self.feature("organizations:new-project-issue-alert-options"):
            self.login_as(user=self.user)
            org = self.create_organization(owner=self.user, name="baz")
            url = reverse("sentry-api-0-project-agnostic-rule-conditions", args=[org.slug])
            response = self.client.get(url, format="json")

            assert response.status_code == 200, response.content
            assert len(response.data) == 9

    def test_no_access(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")
        url = reverse("sentry-api-0-project-agnostic-rule-conditions", args=[org.slug])
        response = self.client.get(url, format="json")

        assert response.status_code == 404
