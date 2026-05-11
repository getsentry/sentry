from __future__ import annotations

import re
from typing import Any
from unittest import mock
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.urls import reverse

from sentry import audit_log
from sentry.analytics.events.data_consent_org_creation import (
    AggregatedDataConsentOrganizationCreatedEvent,
)
from sentry.analytics.events.organization_created import OrganizationCreatedEvent
from sentry.api.bases.organization import OrganizationPermission
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.apitoken import ApiToken
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase, TwoFactorAPITestCase
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import (
    assume_test_silo_mode,
    cell_silo_test,
    control_silo_test,
    create_test_cells,
)
from sentry.users.models.authenticator import Authenticator
from sentry.utils.slug import ORG_SLUG_PATTERN


class OrganizationIndexTest(APITestCase):
    endpoint = "sentry-api-0-organizations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)


class OrganizationsListTest(OrganizationIndexTest):
    def test_membership(self) -> None:
        org = self.organization  # force creation
        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org.id)

    def test_show_all_with_superuser(self) -> None:
        org = self.organization  # force creation
        org2 = self.create_organization()
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)

        response = self.get_success_response(qs_params={"show": "all"})
        assert len(response.data) == 2
        assert {r["id"] for r in response.data} == {str(org.id), str(org2.id)}

    def test_show_all_without_superuser(self) -> None:
        self.organization  # force creation
        self.create_organization()
        user = self.create_user()
        self.login_as(user=user)
        response = self.get_success_response(qs_params={"show": "all"})
        assert len(response.data) == 0

    def test_ownership(self) -> None:
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

    def test_status_query(self) -> None:
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)

        response = self.get_success_response(qs_params={"query": "status:pending_deletion"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org.id)

        response = self.get_success_response(qs_params={"query": "status:deletion_in_progress"})
        assert len(response.data) == 0

        response = self.get_success_response(qs_params={"query": "status:invalid_status"})
        assert len(response.data) == 0

    def test_member_id_query(self) -> None:
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

    def test_show_only_token_organization(self) -> None:
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


@control_silo_test(cells=create_test_cells("us", "de"))
class OrganizationsControlListTest(OrganizationIndexTest):
    endpoint = "sentry-api-0-organizations"

    def test_membership_across_cells(self) -> None:
        us_org = self.create_organization(cell="us", owner=self.user, name="US Org", slug="us-org")
        de_org = self.create_organization(cell="de", owner=self.user, name="DE Org", slug="de-org")

        response = self.get_success_response()

        assert {item["id"] for item in response.data} == {str(us_org.id), str(de_org.id)}
        assert {item["slug"] for item in response.data} == {"us-org", "de-org"}

    def test_show_only_token_organization(self) -> None:
        org1 = self.create_organization(cell="us", owner=self.user)
        self.create_organization(cell="de", owner=self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_scoped_token = ApiToken.objects.create(
                user=self.user, scoping_organization_id=org1.id, scope_list=["org:read"]
            )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {org_scoped_token.plaintext_token}")
        response = self.client.get(reverse(self.endpoint))

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(org1.id)

    def test_owner_not_supported(self) -> None:
        self.create_organization(cell="us", owner=self.user)

        response = self.get_error_response(status_code=400, owner="1")

        assert (
            response.data["detail"]
            == "The control-silo organizations endpoint does not support owner=1."
        )

    def test_sort_by_members(self) -> None:
        smaller_org = self.create_organization(
            cell="us", owner=self.user, name="Smaller Org", slug="smaller-org"
        )
        larger_org = self.create_organization(
            cell="de", owner=self.user, name="Larger Org", slug="larger-org"
        )

        self.create_member(user=self.create_user(), organization=smaller_org)
        self.create_member(user=self.create_user(), organization=larger_org)
        self.create_member(user=self.create_user(), organization=larger_org)

        response = self.get_success_response(sortBy="members")

        assert [item["id"] for item in response.data] == [str(larger_org.id), str(smaller_org.id)]

    def test_response_compatible_with_cell(self) -> None:
        # The control listing is being built out to replace the cell listing.
        # Until that swap happens, every field the control side returns must
        # match the cell side for the same org so we can cut over without
        # breaking clients.
        self.create_organization(cell="us", owner=self.user, name="My Org", slug="my-org")

        with assume_test_silo_mode(SiloMode.CONTROL):
            control_response = self.get_success_response()
        with assume_test_silo_mode(SiloMode.CELL):
            cell_response = self.get_success_response()

        assert len(control_response.data) == 1
        assert len(cell_response.data) == 1

        # TODO(cells): fields the control serializer doesn't return yet. Remove
        # entries as they're ported — once empty, drop the filter and assert
        # full equality.
        missing_fields = {
            "allowMemberInvite",
            "allowMemberProjectCreation",
            "allowSuperuserAccess",
            "avatar",
            "dateCreated",
            "hasAuthProvider",
            "isEarlyAdopter",
            "links",
            "require2FA",
            "status",
        }
        assert control_response.data[0] == {
            k: v for k, v in cell_response.data[0].items() if k not in missing_fields
        }


class OrganizationsCreateTest(OrganizationIndexTest, HybridCloudTestMixin):
    method = "post"

    def test_missing_params(self) -> None:
        self.get_error_response(status_code=400)

    def test_valid_params(self) -> None:
        data = {"name": "hello world", "slug": "foobar"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "hello world"
        assert org.slug == "foobar"
        team_qs = Team.objects.filter(organization_id=organization_id)
        assert not team_qs.exists()

        self.get_error_response(status_code=400, **data)

    def test_org_ownership(self) -> None:
        data = {"name": "hello world", "slug": "foobar"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "hello world"
        owners = [owner.id for owner in org.get_owners()]
        assert [self.user.id] == owners

    def test_with_default_team_false(self) -> None:
        data = {"name": "hello world", "slug": "foobar", "defaultTeam": False}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "hello world"
        assert org.slug == "foobar"
        team_qs = Team.objects.filter(organization_id=organization_id)
        assert not team_qs.exists()

    def test_with_default_team_true(self) -> None:
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

    def test_valid_slugs(self) -> None:
        valid_slugs = ["santry", "downtown-canada", "1234-foo"]
        for input_slug in valid_slugs:
            self.organization.refresh_from_db()
            response = self.get_success_response(name=input_slug, slug=input_slug)
            org = Organization.objects.get(id=response.data["id"])
            assert org.slug == input_slug.lower()

    def test_invalid_slugs(self) -> None:
        with self.options({"api.rate-limit.org-create": 9001}):
            self.get_error_response(name="name", slug=" i have whitespace ", status_code=400)
            self.get_error_response(name="name", slug="foo-bar ", status_code=400)
            self.get_error_response(name="name", slug="bird-company!", status_code=400)
            self.get_error_response(name="name", slug="downtown_canada", status_code=400)
            self.get_error_response(name="name", slug="canada-", status_code=400)
            self.get_error_response(name="name", slug="-canada", status_code=400)
            self.get_error_response(name="name", slug="----", status_code=400)
            self.get_error_response(name="name", slug="1234", status_code=400)
            self.get_error_response(name="name", slug="I-contain-UPPERCASE", status_code=400)

    def test_name_with_url_scheme_rejected(self) -> None:
        with self.options({"api.rate-limit.org-create": 9001}):
            self.get_error_response(
                name="https://evil.com Click Here", slug="legit-slug", status_code=400
            )
            self.get_error_response(name="http://evil.com", slug="legit-slug-2", status_code=400)

    def test_name_with_spam_signals_rejected(self) -> None:
        response = self.get_error_response(
            name="Win $50 ETH bit.ly/offer Claim Now",
            slug="spam-org",
            status_code=400,
        )
        assert "disallowed content" in str(response.data)

    def test_name_with_single_signal_allowed(self) -> None:
        response = self.get_success_response(name="BTC Analytics", slug="btc-analytics")
        org = Organization.objects.get(id=response.data["id"])
        assert org.name == "BTC Analytics"

    def test_name_with_periods_allowed(self) -> None:
        response = self.get_success_response(name="Acme Inc.", slug="acme-inc")
        org = Organization.objects.get(id=response.data["id"])
        assert org.name == "Acme Inc."

    def test_without_slug(self) -> None:
        response = self.get_success_response(name="hello world")

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.slug == "hello-world"

    def test_generated_slug_not_entirely_numeric(self) -> None:
        response = self.get_success_response(name="1234")

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.slug.startswith("1234-")
        assert not org.slug.isdecimal()

    @patch(
        "sentry.core.endpoints.organization_member_requests_join.ratelimiter.backend.is_limited",
        return_value=False,
    )
    def test_name_slugify(self, is_limited: MagicMock) -> None:
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

    def test_required_terms_with_terms_url(self) -> None:
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

    def test_organization_mapping(self) -> None:
        data = {"slug": "santry", "name": "SaNtRy", "idempotencyKey": "1234"}
        response = self.get_success_response(**data)

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.slug == data["slug"]
        assert org.name == data["name"]

    def test_slug_already_taken(self) -> None:
        self.create_organization(slug="taken")
        self.get_error_response(slug="taken", name="TaKeN", status_code=400)

    def test_add_organization_member(self) -> None:
        self.login_as(user=self.user)

        response = self.get_success_response(name="org name")

        org_member = OrganizationMember.objects.get(
            organization_id=response.data["id"], user_id=self.user.id
        )
        self.assert_org_member_mapping(org_member=org_member)

    @mock.patch("sentry.analytics.record")
    def test_success_analytics_recorded(self, mock_record: mock.MagicMock) -> None:
        self.login_as(user=self.user)

        with outbox_runner():
            response = self.get_success_response(name="org name", aggregatedDataConsent=True)
        assert response.status_code == 201

        org = Organization.objects.get(slug="org-name")

        assert_any_analytics_event(
            mock_record,
            OrganizationCreatedEvent(
                id=org.id,
                actor_id=self.user.id,
                name=org.name,
                slug=org.slug,
            ),
        )
        assert_any_analytics_event(
            mock_record, AggregatedDataConsentOrganizationCreatedEvent(organization_id=org.id)
        )
        assert_org_audit_log_exists(
            organization=org,
            event=audit_log.get_event_id("ORG_ADD"),
        )
        assert org.get_option("sentry:aggregated_data_consent") is True

    def test_data_consent(self) -> None:
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

    @override_options({"provision_organization_in_cell.record_analytics": True})
    @mock.patch("sentry.analytics.record")
    def test_success_analytics_in_rpc_call(self, mock_record: mock.MagicMock) -> None:
        self.login_as(user=self.user)

        with outbox_runner():
            data = {
                "name": "org name",
                "aggregatedDataConsent": True,
                "agreeTerms": True,
                "defaultTeam": True,
            }
            response = self.get_success_response(**data)
        assert response.status_code == 201

        org = Organization.objects.get(slug="org-name")

        assert_any_analytics_event(
            mock_record,
            OrganizationCreatedEvent(
                id=org.id,
                actor_id=self.user.id,
                name=org.name,
                slug=org.slug,
            ),
        )
        assert_any_analytics_event(
            mock_record, AggregatedDataConsentOrganizationCreatedEvent(organization_id=org.id)
        )
        assert_org_audit_log_exists(
            organization=org,
            event=audit_log.get_event_id("ORG_ADD"),
        )
        assert org.get_option("sentry:aggregated_data_consent") is True
        assert org.get_option("sentry:streamline_ui_only") is True
        assert OrganizationMember.objects.filter(
            organization_id=org.id, user_id=self.user.id
        ).exists()
        assert Team.objects.filter(organization_id=org.id).exists()

    def test_streamline_only_is_true(self) -> None:
        """
        All new organizations should never see the legacy UI.
        """
        self.login_as(user=self.user)
        response = self.get_success_response(name="acme")
        organization = Organization.objects.get(id=response.data["id"])
        assert OrganizationOption.objects.get_value(organization, "sentry:streamline_ui_only")

    def test_demo_user_cannot_create_organization(self) -> None:
        demo_user = self.create_user("demo@example.com")
        self.login_as(demo_user)
        with override_options({"demo-mode.enabled": True, "demo-mode.users": [demo_user.id]}):
            self.get_error_response(name="demo org", slug="demo-org", status_code=403)
            assert not Organization.objects.filter(slug="demo-org").exists()

    def test_demo_user_cannot_create_organization_when_demo_mode_disabled(self) -> None:
        demo_user = self.create_user("demo@example.com")
        self.login_as(demo_user)
        with override_options({"demo-mode.enabled": False, "demo-mode.users": [demo_user.id]}):
            self.get_error_response(name="demo org", slug="demo-org", status_code=403)
            assert not Organization.objects.filter(slug="demo-org").exists()

    @patch.object(OrganizationPermission, "has_permission", return_value=True)
    def test_demo_user_handler_level_guard(self, mock_perm: MagicMock) -> None:
        """The handler itself blocks demo users even if the permission layer is bypassed."""
        demo_user = self.create_user("demo@example.com")
        self.login_as(demo_user)
        with override_options({"demo-mode.enabled": True, "demo-mode.users": [demo_user.id]}):
            response = self.get_error_response(name="demo org", slug="demo-org", status_code=403)
            assert response.data["detail"] == "Demo users are not allowed to create organizations."
            assert not Organization.objects.filter(slug="demo-org").exists()


@cell_silo_test(cells=create_test_cells("de", "us"))
class OrganizationsCreateInRegionTest(OrganizationIndexTest):
    method = "post"

    @override_settings(SENTRY_MONOLITH_REGION="us", SENTRY_LOCAL_CELL="de")
    def test_success(self) -> None:
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
        assert mapping.cell_name == "de"


@control_silo_test
class OrganizationIndex2faTest(TwoFactorAPITestCase):
    # This is the HTML view, not an API endpoint
    endpoint = "sentry-organization-home"

    def setUp(self) -> None:
        self.org_2fa = self.create_organization(owner=self.create_user())
        self.enable_org_2fa(self.org_2fa)
        self.no_2fa_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=self.no_2fa_user, role="member")

    def assert_redirected_to_2fa(self):
        response = self.get_success_response(self.org_2fa.slug, status_code=302)
        assert self.path_2fa in response.url

    def test_preexisting_members_must_enable_2fa(self) -> None:
        self.login_as(self.no_2fa_user)
        self.assert_redirected_to_2fa()

        TotpInterface().enroll(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

    def test_new_member_must_enable_2fa(self) -> None:
        new_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=new_user, role="member")
        self.login_as(new_user)

        self.assert_redirected_to_2fa()

        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(new_user)
        self.get_success_response(self.org_2fa.slug)

    def test_member_disable_all_2fa_blocked(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(self.no_2fa_user)
        self.login_as(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

        with assume_test_silo_mode(SiloMode.CONTROL):
            Authenticator.objects.get(user=self.no_2fa_user).delete()
        self.assert_redirected_to_2fa()

    def test_superuser_can_access_org_home(self) -> None:
        user = self.create_user(is_superuser=True)
        self.login_as(user, superuser=True)
        self.get_success_response(self.org_2fa.slug)


@control_silo_test
class OrganizationIndexMemberLimitTest(APITestCase):
    # This is a react view, not an API endpoint
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

    def test_member_limit_redirect(self) -> None:
        self.setup_user()
        response = self.get_success_response(self.organization.slug, status_code=302)
        assert f"/organizations/{self.organization.slug}/disabled-member/" in response.url

    def test_member_limit_superuser_no_redirect(self) -> None:
        self.setup_user(is_superuser=True)
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.headers["Content-Type"] == "text/html"
