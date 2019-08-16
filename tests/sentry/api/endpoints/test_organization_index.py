from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import (
    Authenticator,
    Organization,
    OrganizationMember,
    OrganizationStatus,
    TotpInterface,
)
from sentry.testutils import APITestCase, TwoFactorAPITestCase


class OrganizationsListTest(APITestCase):
    path = "/api/0/organizations/"

    def test_membership(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        response = self.client.get(u"{}".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(org.id)

    def test_show_all_with_superuser(self):
        org = self.organization
        self.login_as(user=self.create_user(is_superuser=True), superuser=True)
        response = self.client.get(u"{}?show=all".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == six.text_type(org.id)

    def test_show_all_without_superuser(self):
        self.create_organization(owner=self.user)
        self.login_as(user=self.create_user(is_superuser=False))
        response = self.client.get(u"{}?show=all".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_ownership(self):
        org = self.create_organization(name="A", owner=self.user)
        user2 = self.create_user(email="user2@example.com")
        org2 = self.create_organization(name="B", owner=self.user)
        org3 = self.create_organization(name="C", owner=user2)
        self.create_organization(name="D", owner=user2)

        self.create_member(user=user2, organization=org2, role="owner")

        self.create_member(user=self.user, organization=org3, role="owner")

        self.login_as(user=self.user)
        response = self.client.get(u"{}?owner=1".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 3
        assert response.data[0]["organization"]["id"] == six.text_type(org.id)
        assert response.data[0]["singleOwner"] is True
        assert response.data[1]["organization"]["id"] == six.text_type(org2.id)
        assert response.data[1]["singleOwner"] is False
        assert response.data[2]["organization"]["id"] == six.text_type(org3.id)
        assert response.data[2]["singleOwner"] is False

    def test_status_query(self):
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)
        self.login_as(user=self.user)
        response = self.client.get(u"{}?query=status:pending_deletion".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(org.id)
        response = self.client.get(u"{}?query=status:deletion_in_progress".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0
        response = self.client.get(u"{}?query=status:invalid_status".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_member_id_query(self):
        org = self.create_organization(owner=self.user)
        self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        response = self.client.get(u"{}?member=1".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 2

        om = OrganizationMember.objects.get(organization=org, user=self.user)
        response = self.client.get(u"{}?query=member_id:{}".format(self.path, om.id))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(org.id)

        response = self.client.get(u"{}?query=member_id:{}".format(self.path, om.id + 10))
        assert response.status_code == 200
        assert len(response.data) == 0


class OrganizationsCreateTest(APITestCase):
    path = "/api/0/organizations/"

    def test_missing_params(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 400

    def test_valid_params(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={"name": "hello world", "slug": "foobar"})
        assert resp.status_code == 201, resp.content
        org = Organization.objects.get(id=resp.data["id"])
        assert org.name == "hello world"
        assert org.slug == "foobar"

        resp = self.client.post(self.path, data={"name": "hello world", "slug": "foobar"})
        assert resp.status_code == 409, resp.content

    def test_without_slug(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={"name": "hello world"})
        assert resp.status_code == 201, resp.content
        org = Organization.objects.get(id=resp.data["id"])
        assert org.slug == "hello-world"

    def test_required_terms_with_terms_url(self):
        self.login_as(user=self.user)

        with self.settings(PRIVACY_URL=None, TERMS_URL="https://example.com/terms"):
            resp = self.client.post(self.path, data={"name": "hello world"})
            assert resp.status_code == 201, resp.content

        with self.settings(TERMS_URL=None, PRIVACY_URL="https://example.com/privacy"):
            resp = self.client.post(self.path, data={"name": "hello world"})
            assert resp.status_code == 201, resp.content

        with self.settings(
            TERMS_URL="https://example.com/terms", PRIVACY_URL="https://example.com/privacy"
        ):
            resp = self.client.post(self.path, data={"name": "hello world", "agreeTerms": False})
            assert resp.status_code == 400, resp.content

            resp = self.client.post(self.path, data={"name": "hello world", "agreeTerms": True})
            assert resp.status_code == 201, resp.content


class OrganizationIndex2faTest(TwoFactorAPITestCase):
    def setUp(self):
        self.org_2fa = self.create_organization(owner=self.create_user())
        self.enable_org_2fa(self.org_2fa)
        self.no_2fa_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=self.no_2fa_user, role="member")

    @fixture
    def path(self):
        return reverse("sentry-organization-home", kwargs={"organization_slug": self.org_2fa.slug})

    def assert_can_access_org_home(self):
        response = self.client.get(self.path)
        assert response.status_code == 200

    def assert_redirected_to_2fa(self):
        response = self.client.get(self.path)
        assert response.status_code == 302
        assert self.path_2fa in response.url

    def test_preexisting_members_must_enable_2fa(self):
        self.login_as(self.no_2fa_user)
        self.assert_redirected_to_2fa()

        TotpInterface().enroll(self.no_2fa_user)
        self.assert_can_access_org_home()

    def test_new_member_must_enable_2fa(self):
        new_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=new_user, role="member")
        self.login_as(new_user)

        self.assert_redirected_to_2fa()

        TotpInterface().enroll(new_user)
        self.assert_can_access_org_home()

    def test_member_disable_all_2fa_blocked(self):
        TotpInterface().enroll(self.no_2fa_user)
        self.login_as(self.no_2fa_user)
        self.assert_can_access_org_home()

        Authenticator.objects.get(user=self.no_2fa_user).delete()
        self.assert_redirected_to_2fa()

    def test_superuser_can_access_org_home(self):
        user = self.create_user(is_superuser=True)
        self.login_as(user, superuser=True)
        self.assert_can_access_org_home()
