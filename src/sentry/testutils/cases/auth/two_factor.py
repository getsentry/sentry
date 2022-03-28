from __future__ import annotations

from django.urls import reverse
from exam import fixture

from sentry.auth.authenticators import TotpInterface
from sentry.models import Organization

from ..api import APITestCase


class TwoFactorAPITestCase(APITestCase):
    @fixture
    def path_2fa(self):
        return reverse("sentry-account-settings-security")

    def enable_org_2fa(self, organization):
        organization.flags.require_2fa = True
        organization.save()

    def api_enable_org_2fa(self, organization, user):
        self.login_as(user)
        url = reverse(
            "sentry-api-0-organization-details", kwargs={"organization_slug": organization.slug}
        )
        return self.client.put(url, data={"require2FA": True})

    def api_disable_org_2fa(self, organization, user):
        url = reverse(
            "sentry-api-0-organization-details", kwargs={"organization_slug": organization.slug}
        )
        return self.client.put(url, data={"require2FA": False})

    def assert_can_enable_org_2fa(self, organization, user, status_code=200):
        self.__helper_enable_organization_2fa(organization, user, status_code)

    def assert_cannot_enable_org_2fa(self, organization, user, status_code, err_msg=None):
        self.__helper_enable_organization_2fa(organization, user, status_code, err_msg)

    def __helper_enable_organization_2fa(self, organization, user, status_code, err_msg=None):
        response = self.api_enable_org_2fa(organization, user)
        assert response.status_code == status_code
        if err_msg:
            assert err_msg.encode("utf-8") in response.content
        organization = Organization.objects.get(id=organization.id)

        if 200 <= status_code < 300:
            assert organization.flags.require_2fa
        else:
            assert not organization.flags.require_2fa

    def add_2fa_users_to_org(self, organization, num_of_users=10, num_with_2fa=5):
        non_compliant_members = []
        for num in range(0, num_of_users):
            user = self.create_user("foo_%s@example.com" % num)
            self.create_member(organization=organization, user=user)
            if num_with_2fa:
                TotpInterface().enroll(user)
                num_with_2fa -= 1
            else:
                non_compliant_members.append(user.email)
        return non_compliant_members
