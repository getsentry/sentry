import re
from unittest.mock import patch

from sentry.auth.authenticators import TotpInterface
from sentry.models import Authenticator, Organization, OrganizationMember, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.testutils import APITestCase, TwoFactorAPITestCase
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test


class OrganizationIndexTest(APITestCase):
    endpoint = "sentry-api-0-organizations"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@region_silo_test(stable=True)
class OrganizationsListTest(OrganizationIndexTest):
    def test_membership(self):
        org = self.organization  # force creation
        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org.id)

    def test_show_all_with_superuser(self):
        org = self.organization  # force creation
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)

        response = self.get_success_response(qs_params={"show": "all"})
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(org.id)

    def test_show_all_without_superuser(self):
        response = self.get_success_response(qs_params={"show": "all"})
        assert len(response.data) == 0

    def test_ownership(self):
        org = self.create_organization(name="A", owner=self.user)
        org2 = self.create_organization(name="B", owner=self.user)

        user2 = self.create_user(email="user2@example.com")
        org3 = self.create_organization(name="C", owner=user2)
        org4 = self.create_organization(name="D", owner=user2)
        org5 = self.create_organization(name="E", owner=user2)

        self.create_member(user=user2, organization=org2, role="owner")
        self.create_member(user=self.user, organization=org3, role="owner")

        owner_team = self.create_team(organization=org4, org_role="owner")
        # org4 has 2 owners
        self.create_member(user=self.user, organization=org4, role="member", teams=[owner_team])
        self.create_member(user=self.user, organization=org5, role="member")

        response = self.get_success_response(qs_params={"owner": 1})
        assert len(response.data) == 4
        assert response.data[0]["organization"]["id"] == str(org.id)
        assert response.data[0]["singleOwner"] is True
        assert response.data[1]["organization"]["id"] == str(org2.id)
        assert response.data[1]["singleOwner"] is False
        assert response.data[2]["organization"]["id"] == str(org3.id)
        assert response.data[2]["singleOwner"] is False
        assert response.data[3]["organization"]["id"] == str(org4.id)
        assert response.data[3]["singleOwner"] is False

    def test_status_query(self):
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)

        response = self.get_success_response(qs_params={"query": "status:pending_deletion"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org.id)

        response = self.get_success_response(qs_params={"query": "status:deletion_in_progress"})
        assert len(response.data) == 0

        response = self.get_success_response(qs_params={"query": "status:invalid_status"})
        assert len(response.data) == 0

    def test_member_id_query(self):
        org = self.organization  # force creation
        self.create_organization(owner=self.user)

        response = self.get_success_response(qs_params={"member": 1})
        assert len(response.data) == 2

        om = OrganizationMember.objects.get(organization=org, user=self.user)
        response = self.get_success_response(qs_params={"query": f"member_id:{om.id}"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org.id)

        response = self.get_success_response(qs_params={"query": f"member_id:{om.id + 10}"})
        assert len(response.data) == 0


@region_silo_test
class OrganizationsCreateTest(OrganizationIndexTest):
    method = "post"

    def test_missing_params(self):
        self.get_error_response(status_code=400)

    def test_valid_params(self):
        data = {"name": "hello world", "slug": "foobar"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "hello world"
        assert org.slug == "foobar"

        self.get_error_response(status_code=400, **data)

    def test_slugs(self):
        valid_slugs = ["santry", "downtown-canada", "1234", "CaNaDa"]
        for input_slug in valid_slugs:
            self.organization.refresh_from_db()
            response = self.get_success_response(name=input_slug, slug=input_slug)
            org = Organization.objects.get(id=response.data["id"])
            assert org.slug == input_slug.lower()

    def test_invalid_slugs(self):
        with self.options({"api.rate-limit.org-create": 9001}):
            self.get_error_response(name="name", slug=" i have whitespace ", status_code=400)
            self.get_error_response(name="name", slug="foo-bar ", status_code=400)
            self.get_error_response(name="name", slug="bird-company!", status_code=400)
            self.get_error_response(name="name", slug="downtown_canada", status_code=400)
            self.get_error_response(name="name", slug="canada-", status_code=400)
            self.get_error_response(name="name", slug="-canada", status_code=400)
            self.get_error_response(name="name", slug="----", status_code=400)

    def test_without_slug(self):
        data = {"name": "hello world"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.slug == "hello-world"

    @patch(
        "sentry.api.endpoints.organization_member.requests.join.ratelimiter.is_limited",
        return_value=False,
    )
    def test_name_slugify(self, is_limited):
        response = self.get_success_response(name="---foo")
        org = Organization.objects.get(id=response.data["id"])
        assert org.slug == "foo"

        org_slug_pattern = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9-]*(?<!-)$")

        response = self.get_success_response(name="---foo---")
        org = Organization.objects.get(id=response.data["id"])
        assert org.slug != "foo-"
        assert org.slug.startswith("foo-")
        assert org_slug_pattern.match(org.slug)

        response = self.get_success_response(name="___foo___")
        org = Organization.objects.get(id=response.data["id"])
        assert org.slug != "foo-"
        assert org.slug.startswith("foo-")
        assert org_slug_pattern.match(org.slug)

        response = self.get_success_response(name="foo_bar")
        org = Organization.objects.get(id=response.data["id"])
        assert org.slug == "foo-bar"

        response = self.get_success_response(name="----")
        org = Organization.objects.get(id=response.data["id"])
        assert len(org.slug) > 0
        assert org_slug_pattern.match(org.slug)

        response = self.get_success_response(name="CaNaDa")
        org = Organization.objects.get(id=response.data["id"])
        assert org.slug == "canada"
        assert org_slug_pattern.match(org.slug)

    def test_required_terms_with_terms_url(self):
        data = {"name": "hello world"}
        with self.settings(PRIVACY_URL=None, TERMS_URL="https://example.com/terms"):
            self.get_success_response(**data)

        with self.settings(TERMS_URL=None, PRIVACY_URL="https://example.com/privacy"):
            self.get_success_response(**data)

        with self.settings(
            TERMS_URL="https://example.com/terms", PRIVACY_URL="https://example.com/privacy"
        ):
            data = {"name": "hello world", "agreeTerms": False}
            self.get_error_response(status_code=400, **data)

            data = {"name": "hello world", "agreeTerms": True}
            self.get_success_response(**data)

    def test_organization_mapping(self):
        data = {"slug": "santry", "name": "SaNtRy", "idempotencyKey": "1234"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.slug == data["slug"]
        assert org.name == data["name"]

        with exempt_from_silo_limits():
            assert OrganizationMapping.objects.filter(
                organization_id=organization_id,
                slug=data["slug"],
                name=data["name"],
                idempotency_key=data["idempotencyKey"],
            ).exists()

    def test_slug_already_taken(self):
        OrganizationMapping.objects.create(organization_id=999, slug="taken", region_name="us")
        self.get_error_response(slug="taken", name="TaKeN", status_code=409)


@region_silo_test
class OrganizationIndex2faTest(TwoFactorAPITestCase):
    endpoint = "sentry-organization-home"

    def setUp(self):
        self.org_2fa = self.create_organization(owner=self.create_user())
        self.enable_org_2fa(self.org_2fa)
        self.no_2fa_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=self.no_2fa_user, role="member")

    def assert_redirected_to_2fa(self):
        response = self.get_success_response(self.org_2fa.slug, status_code=302)
        assert self.path_2fa in response.url

    def test_preexisting_members_must_enable_2fa(self):
        self.login_as(self.no_2fa_user)
        self.assert_redirected_to_2fa()

        TotpInterface().enroll(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

    def test_new_member_must_enable_2fa(self):
        new_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=new_user, role="member")
        self.login_as(new_user)

        self.assert_redirected_to_2fa()

        TotpInterface().enroll(new_user)
        self.get_success_response(self.org_2fa.slug)

    def test_member_disable_all_2fa_blocked(self):
        TotpInterface().enroll(self.no_2fa_user)
        self.login_as(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

        Authenticator.objects.get(user=self.no_2fa_user).delete()
        self.assert_redirected_to_2fa()

    def test_superuser_can_access_org_home(self):
        user = self.create_user(is_superuser=True)
        self.login_as(user, superuser=True)
        self.get_success_response(self.org_2fa.slug)


@region_silo_test(stable=True)
class OrganizationIndexMemberLimitTest(APITestCase):
    endpoint = "sentry-organization-index"

    def setup_user(self, is_superuser=False):
        self.organization = self.create_organization()
        self.user = self.create_user(is_superuser=is_superuser)
        self.create_member(
            organization=self.organization,
            user=self.user,
            role="member",
            flags=OrganizationMember.flags["member-limit:restricted"],
        )
        self.login_as(self.user, superuser=is_superuser)

    def test_member_limit_redirect(self):
        self.setup_user()
        response = self.get_success_response(self.organization.slug, status_code=302)
        assert f"/organizations/{self.organization.slug}/disabled-member/" in response.url

    def test_member_limit_superuser_no_redirect(self):
        self.setup_user(is_superuser=True)
        self.get_success_response(self.organization.slug, status_code=200)
