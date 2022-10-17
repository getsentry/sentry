from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils import SCIMTestCase


class SCIMMemberIndexDocs(APIDocsTestCase, SCIMTestCase):
    def setUp(self):
        super().setUp()
        self.member = self.create_member(user=self.create_user(), organization=self.organization)

        self.url = reverse(
            "sentry-api-0-organization-scim-member-index",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)

    def test_post(self):
        post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "userName": "test.user@okta.local",
            "name": {"givenName": "Test", "familyName": "User"},
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "displayName": "Test User",
            "locale": "en-US",
            "externalId": "00ujl29u0le5T6Aj10h7",
            "groups": [],
            "password": "1mz050nq",
            "active": True,
        }
        response = self.client.post(self.url, post_data)
        request = RequestFactory().post(self.url, post_data)
        self.validate_schema(request, response)

    def test_post_member_exists_but_not_accepted(self):
        self.create_member(
            user=self.create_user(),
            organization=self.organization,
            email="test.user@okta.local",
            role="member",
            invite_status=1,
        )
        post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "userName": "test.user@okta.local",
            "name": {"givenName": "Test", "familyName": "User"},
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "displayName": "Test User",
            "locale": "en-US",
            "externalId": "00ujl29u0le5T6Aj10h7",
            "groups": [],
            "password": "1mz050nq",
            "active": True,
        }

        response = self.client.post(self.url, post_data)
        request = RequestFactory().post(self.url, post_data)
        self.validate_schema(request, response)
