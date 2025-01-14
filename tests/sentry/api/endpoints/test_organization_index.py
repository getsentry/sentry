from __future__ import annotations

import re
from typing import Any
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse

from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.apitoken import ApiToken
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.slug.patterns import ORG_SLUG_PATTERN
from sentry.testutils.cases import APITestCase, TwoFactorAPITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import assume_test_silo_mode, create_test_regions, region_silo_test
from sentry.users.models.authenticator import Authenticator


class OrganizationIndexTest(APITestCase):
    endpoint = "sentry-api-0-organizations"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


class OrganizationsListTest(OrganizationIndexTest):
    def test_membership(self):
        org = self.organization  # force creation
        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org.id)

    def test_show_all_with_superuser(self):
        org = self.organization  # force creation
        org2 = self.create_organization()
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)

        response = self.get_success_response(qs_params={"show": "all"})
        assert len(response.data) == 2
        assert {r["id"] for r in response.data} == {str(org.id), str(org2.id)}

    def test_show_all_without_superuser(self):
        self.organization  # force creation
        self.create_organization()
        user = self.create_user()
        self.login_as(user=user)
        response = self.get_success_response(qs_params={"show": "all"})
        assert len(response.data) == 0

    def test_ownership(self):
        org = self.create_organization(name="A", owner=self.user)
        org2 = self.create_organization(name="B", owner=self.user)

        user2 = self.create_user(email="user2@example.com")
        org3 = self.create_organization(name="C", owner=user2)
        self.create_organization(name="D", owner=user2)
        org4 = self.create_organization(name="E", owner=user2)

        self.create_member(user=user2, organization=org2, role="owner")
        self.create_member(user=self.user, organization=org3, role="owner")

        self.create_member(user=self.user, organization=org4, role="member")

        response = self.get_success_response(qs_params={"owner": 1})
        assert len(response.data) == 3
        assert response.data[0]["organization"]["id"] == str(org.id)
        assert response.data[0]["singleOwner"] is True
        assert response.data[1]["organization"]["id"] == str(org2.id)
        assert response.data[1]["singleOwner"] is False
        assert response.data[2]["organization"]["id"] == str(org3.id)
        assert response.data[2]["singleOwner"] is False

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

        om = OrganizationMember.objects.get(organization=org, user_id=self.user.id)
        response = self.get_success_response(qs_params={"query": f"member_id:{om.id}"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org.id)

        response = self.get_success_response(qs_params={"query": f"member_id:{om.id + 10}"})
        assert len(response.data) == 0

    def test_show_only_token_organization(self):
        org1 = self.create_organization(owner=self.user)
        self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            user_token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_token.plaintext_token}")
        response = self.client.get(reverse(self.endpoint))
        # if token is not specific to any organization, it should return all the organizations
        assert len(response.data) == 2

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_scoped_token = ApiToken.objects.create(
                user=self.user, scoping_organization_id=org1.id, scope_list=["org:read"]
            )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {org_scoped_token.plaintext_token}")
        response = self.client.get(reverse(self.endpoint))
        # if token is specific to an organization, it should return only that organization
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org1.id)


class OrganizationsCreateTest(OrganizationIndexTest, HybridCloudTestMixin):
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
        team_qs = Team.objects.filter(organization_id=organization_id)
        assert not team_qs.exists()

        self.get_error_response(status_code=400, **data)

    def test_org_ownership(self):
        data = {"name": "hello world", "slug": "foobar"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "hello world"
        owners = [owner.id for owner in org.get_owners()]
        assert [self.user.id] == owners

    def test_with_default_team_false(self):
        data = {"name": "hello world", "slug": "foobar", "defaultTeam": False}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "hello world"
        assert org.slug == "foobar"
        team_qs = Team.objects.filter(organization_id=organization_id)
        assert not team_qs.exists()

    def test_with_default_team_true(self):
        data = {"name": "hello world", "slug": "foobar", "defaultTeam": True}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        Organization.objects.get(id=organization_id)
        team = Team.objects.get(organization_id=organization_id)
        assert team.name == "hello world"

        org_member = OrganizationMember.objects.get(
            organization_id=organization_id, user_id=self.user.id
        )
        OrganizationMemberTeam.objects.get(organizationmember_id=org_member.id, team_id=team.id)

    def test_slugs(self):
        valid_slugs = ["santry", "downtown-canada", "1234-foo", "CaNaDa"]
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
            self.get_error_response(name="name", slug="1234", status_code=400)

    def test_without_slug(self):
        response = self.get_success_response(name="hello world")

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.slug == "hello-world"

    def test_generated_slug_not_entirely_numeric(self):
        response = self.get_success_response(name="1234")

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.slug.startswith("1234-")
        assert not org.slug.isdecimal()

    @patch(
        "sentry.api.endpoints.organization_member.requests.join.ratelimiter.backend.is_limited",
        return_value=False,
    )
    def test_name_slugify(self, is_limited):
        response = self.get_success_response(name="---foo")
        org = Organization.objects.get(id=response.data["id"])
        assert org.slug == "foo"

        org_slug_pattern = re.compile(ORG_SLUG_PATTERN)

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

        response = self.get_success_response(name="1234-foo")
        org = Organization.objects.get(id=response.data["id"])
        assert org.slug == "1234-foo"
        assert org_slug_pattern.match(org.slug)

    def test_required_terms_with_terms_url(self):
        data: dict[str, Any] = {"name": "hello world"}
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

    def test_slug_already_taken(self):
        self.create_organization(slug="taken")
        self.get_error_response(slug="taken", name="TaKeN", status_code=400)

    def test_add_organization_member(self):
        self.login_as(user=self.user)

        response = self.get_success_response(name="org name")

        org_member = OrganizationMember.objects.get(
            organization_id=response.data["id"], user_id=self.user.id
        )
        self.assert_org_member_mapping(org_member=org_member)

    def test_data_consent(self):
        data = {"name": "hello world original", "agreeTerms": True}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == data["name"]
        assert not OrganizationOption.objects.get_value(org, "sentry:aggregated_data_consent")

        data = {"name": "hello world", "agreeTerms": True, "aggregatedDataConsent": True}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == data["name"]
        assert OrganizationOption.objects.get_value(org, "sentry:aggregated_data_consent") is True

    @override_options({"issues.details.streamline-experiment-rollout-rate": 0})
    @override_options({"issues.details.streamline-experiment-split-rate": 1.0})
    def test_streamline_only_is_unset_with_full_split_rate(self):
        """
        If the rollout rate is 0%, Ignore split rate, the organization should not be put into a bucket.
        """
        self.login_as(user=self.user)
        response = self.get_success_response(name="acme")
        organization = Organization.objects.get(id=response.data["id"])
        assert (
            OrganizationOption.objects.get_value(organization, "sentry:streamline_ui_only") is None
        )

    @override_options({"issues.details.streamline-experiment-rollout-rate": 0})
    @override_options({"issues.details.streamline-experiment-split-rate": 0})
    def test_streamline_only_is_unset_with_empty_split_rate(self):
        """
        If the rollout rate is 0%, Ignore split rate, the organization should not be put into a bucket.
        """
        self.login_as(user=self.user)
        response = self.get_success_response(name="acme")
        organization = Organization.objects.get(id=response.data["id"])
        assert (
            OrganizationOption.objects.get_value(organization, "sentry:streamline_ui_only") is None
        )

    @override_options({"issues.details.streamline-experiment-rollout-rate": 1.0})
    @override_options({"issues.details.streamline-experiment-split-rate": 1.0})
    def test_streamline_only_is_true(self):
        """
        If the rollout rate is 100%, the split rate should be applied to all orgs.
        In this case, with a split rate of 100%, all orgs should see the Streamline UI.
        """
        self.login_as(user=self.user)
        response = self.get_success_response(name="acme")
        organization = Organization.objects.get(id=response.data["id"])
        assert OrganizationOption.objects.get_value(organization, "sentry:streamline_ui_only")

    @override_options({"issues.details.streamline-experiment-rollout-rate": 1.0})
    @override_options({"issues.details.streamline-experiment-split-rate": 0})
    def test_streamline_only_is_false(self):
        """
        If the rollout rate is 100%, the split rate should be applied to all orgs.
        In this case, with a split rate of 0%, all orgs should see the Legacy UI.
        """
        self.login_as(user=self.user)
        response = self.get_success_response(name="acme")
        organization = Organization.objects.get(id=response.data["id"])
        assert not OrganizationOption.objects.get_value(organization, "sentry:streamline_ui_only")


@region_silo_test(regions=create_test_regions("de", "us"))
class OrganizationsCreateInRegionTest(OrganizationIndexTest, HybridCloudTestMixin):
    method = "post"

    @override_settings(SENTRY_MONOLITH_REGION="us", SENTRY_REGION="de")
    def test_success(self):
        data = {"name": "hello world", "slug": "slug-world"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "hello world"
        owners = [owner.id for owner in org.get_owners()]
        assert [self.user.id] == owners

        with assume_test_silo_mode(SiloMode.CONTROL):
            mapping = OrganizationMapping.objects.get(organization_id=organization_id)
        assert mapping
        assert mapping.region_name == "de"


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

        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

    def test_new_member_must_enable_2fa(self):
        new_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=new_user, role="member")
        self.login_as(new_user)

        self.assert_redirected_to_2fa()

        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(new_user)
        self.get_success_response(self.org_2fa.slug)

    def test_member_disable_all_2fa_blocked(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(self.no_2fa_user)
        self.login_as(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

        with assume_test_silo_mode(SiloMode.CONTROL):
            Authenticator.objects.get(user=self.no_2fa_user).delete()
        self.assert_redirected_to_2fa()

    def test_superuser_can_access_org_home(self):
        user = self.create_user(is_superuser=True)
        self.login_as(user, superuser=True)
        self.get_success_response(self.org_2fa.slug)


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
