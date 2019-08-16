from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import ApiKey
from sentry.testutils import APITestCase

DEFAULT_SCOPES = ["project:read", "event:read", "team:read", "org:read", "member:read"]


class OrganizationApiKeyDetails(APITestCase):
    def test_api_key_no_exist(self):
        self.login_as(user=self.user)
        organization = self.create_organization(name="foo", owner=self.user)

        path = reverse("sentry-api-0-organization-api-key-details", args=[organization.slug, 2])

        resp = self.client.get(path)

        assert resp.status_code == 404

    def test_get_api_details(self):
        self.login_as(user=self.user)
        organization = self.create_organization(name="foo", owner=self.user)

        api_key = ApiKey.objects.create(organization=organization, scope_list=DEFAULT_SCOPES)

        path = reverse(
            "sentry-api-0-organization-api-key-details", args=[organization.slug, api_key.id]
        )

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert resp.data.get("id") == six.text_type(api_key.id)

    def test_update_api_key_details(self):
        self.login_as(user=self.user)
        organization = self.create_organization(name="foo", owner=self.user)

        api_key = ApiKey.objects.create(organization=organization, scope_list=DEFAULT_SCOPES)

        path = reverse(
            "sentry-api-0-organization-api-key-details", args=[organization.slug, api_key.id]
        )

        resp = self.client.put(path, data={"label": "New Label", "allowed_origins": "sentry.io"})

        assert resp.status_code == 200

        api_key = ApiKey.objects.get(id=api_key.id, organization_id=organization.id)

        assert api_key.label == "New Label"
        assert api_key.allowed_origins == "sentry.io"

    def test_can_delete_api_key(self):
        self.login_as(user=self.user)
        organization = self.create_organization(name="foo", owner=self.user)

        api_key = ApiKey.objects.create(organization=organization, scope_list=DEFAULT_SCOPES)

        path = reverse(
            "sentry-api-0-organization-api-key-details", args=[organization.slug, api_key.id]
        )

        resp = self.client.delete(path)

        assert resp.status_code == 204

        # check to make sure it's deleted
        resp = self.client.get(path)
        assert resp.status_code == 404
