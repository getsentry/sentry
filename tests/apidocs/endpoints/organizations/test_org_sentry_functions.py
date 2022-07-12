from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class OrganizationSentryFunctions(APIDocsTestCase):
    def setUp(self):
        organization = self.create_organization(owner=self.user, name="RowdyTiger")

        self.url = reverse(
            "sentry-api-0-organization-sentry-functions",
            kwargs={"organization_slug": organization.slug},
        )
        project = self.create_project(name="foo", organization=organization, teams=[])
        self.create_repo(project=project, name="getsentry/sentry")

        self.login_as(user=self.user)

    def test_post(self):
        data = {"name": "foo", "author": "bar"}
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)
        print(response.data)
        print(response)
        print(request)

        self.validate_schema(request, response)
