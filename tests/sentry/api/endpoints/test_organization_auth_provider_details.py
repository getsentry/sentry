from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import PermissionTestCase


class OrganizationAuthProviderPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationAuthProviderPermissionTest, self).setUp()
        self.path = reverse(
            "sentry-api-0-organization-auth-provider", args=[self.organization.slug]
        )

    def test_member_can_get(self):
        with self.feature("organizations:sso-basic"):
            self.assert_member_can_access(self.path)
