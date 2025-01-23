from __future__ import annotations

import re
from base64 import b64encode
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import patch

import orjson
import pytest
import responses
from dateutil.parser import parse as parse_date
from django.core import mail
from django.db import router
from django.utils import timezone
from rest_framework import status

from sentry import audit_log
from sentry import options as sentry_options
from sentry.api.endpoints.organization_details import ERR_NO_2FA, ERR_SSO_ENABLED
from sentry.api.serializers.models.organization import TrustedRelaySerializer
from sentry.api.utils import generate_region_url
from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.constants import RESERVED_ORGANIZATION_SLUGS, ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authprovider import AuthProvider
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.deletedorganization import DeletedOrganization
from sentry.models.options import ControlOption
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationslugreservation import OrganizationSlugReservation
from sentry.signals import project_created
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase, TwoFactorAPITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode_of, create_test_regions, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user import User

pytestmark = [requires_snuba]

# some relay keys
_VALID_RELAY_KEYS = [
    "IbXZDWy8DcGLVoT_Z6-ODALEnsyhKiC_i-0r3azaztQ",
    "CZa3eDblYqBVoxK3O_4fr5WBbUmUVwc6FrRXbOQTPfk",
    "gyKnK-__yfEOweJ95sB1JoqAh6VlS4c_uIwsrrQ4G7E",
    "kSdr7ozq2T3gLg7FehJro2PH_NnNMJrrCslleKGZQd8",
]


def get_trusted_relay_value(organization):
    return list(
        OrganizationOption.objects.filter(
            organization=organization,
            key="sentry:trusted-relays",
        )
    )[0].value


class OrganizationDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


class MockAccess:
    def has_scope(self, scope):
        # For the "test_as_no_org_read_user" we need a set of scopes that allows GET on the
        # OrganizationDetailsEndpoint to allow high-level access, but without "org:read" scope
        # to cover that branch with test. The scope "org:write" is a good candidate for this.
        if scope == "org:write":
            return True
        return False


@region_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
class OrganizationDetailsTest(OrganizationDetailsTestBase):
    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"include_feature_flags": 1}
        )

        assert response.data["slug"] == self.organization.slug
        assert response.data["links"] == {
            "organizationUrl": f"http://{self.organization.slug}.testserver",
            "regionUrl": generate_region_url(),
        }
        assert response.data["id"] == str(self.organization.id)
        assert response.data["role"] == "owner"
        assert response.data["orgRole"] == "owner"
        assert len(response.data["teams"]) == 0
        assert len(response.data["projects"]) == 0

    def test_include_feature_flag_query_param(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"include_feature_flags": 1}
        )
        assert "features" in response.data

        response = self.get_success_response(self.organization.slug)
        assert "features" not in response.data

    def test_simple_customer_domain(self):
        HTTP_HOST = f"{self.organization.slug}.testserver"
        response = self.get_success_response(
            self.organization.slug,
            extra_headers={"HTTP_HOST": HTTP_HOST},
            qs_params={"include_feature_flags": 1},
        )

        assert response.data["slug"] == self.organization.slug
        assert response.data["links"] == {
            "organizationUrl": f"http://{self.organization.slug}.testserver",
            "regionUrl": generate_region_url(),
        }
        assert response.data["id"] == str(self.organization.id)
        assert response.data["role"] == "owner"
        assert response.data["orgRole"] == "owner"
        assert len(response.data["teams"]) == 0
        assert len(response.data["projects"]) == 0

        with self.feature({"system:multi-region": False}):
            HTTP_HOST = f"{self.organization.slug}.testserver"
            response = self.get_success_response(
                self.organization.slug,
                extra_headers={"HTTP_HOST": HTTP_HOST},
                qs_params={"include_feature_flags": 1},
            )

    def test_org_mismatch_customer_domain(self):
        HTTP_HOST = f"{self.organization.slug}-apples.testserver"
        self.get_error_response(
            self.organization.slug, status_code=404, extra_headers={"HTTP_HOST": HTTP_HOST}
        )

    def test_with_projects(self):
        # Create non-member team to test response shape
        self.create_team(name="no-member", organization=self.organization)

        # Ensure deleted teams don't come back.
        self.create_team(
            name="deleted",
            organization=self.organization,
            members=[self.user],
            status=ObjectStatus.PENDING_DELETION,
        )

        # Some projects with membership and some without.
        for i in range(2):
            self.create_project(organization=self.organization, teams=[self.team])
        for i in range(2):
            self.create_project(organization=self.organization)

        # Should not show up.
        self.create_project(
            slug="deleted",
            organization=self.organization,
            teams=[self.team],
            status=ObjectStatus.PENDING_DELETION,
        )

        # make sure options are not cached the first time to get predictable number of database queries
        with assume_test_silo_mode_of(ControlOption):
            sentry_options.delete("system.rate-limit")

        # TODO(dcramer): We need to pare this down. Lots of duplicate queries for membership data.
        # TODO(hybrid-cloud): put this back in
        # expected_queries = 59 if SiloMode.get_current_mode() == SiloMode.MONOLITH else 62

        # with self.assertNumQueries(expected_queries, using="default"):
        response = self.get_success_response(self.organization.slug)

        project_slugs = [p["slug"] for p in response.data["projects"]]
        assert len(project_slugs) == 4
        assert "deleted" not in project_slugs

        team_slugs = [t["slug"] for t in response.data["teams"]]
        assert len(team_slugs) == 2
        assert "deleted" not in team_slugs

    def test_details_no_projects_or_teams(self):
        # Create non-member team to test response shape
        self.create_team(name="no-member", organization=self.organization)

        for i in range(2):
            self.create_project(organization=self.organization, teams=[self.team])

        response = self.get_success_response(self.organization.slug, qs_params={"detailed": 0})

        assert "projects" not in response.data
        assert "teams" not in response.data

    def test_as_no_org_read_user(self):
        with patch("sentry.auth.access.Access.has_scope", MockAccess().has_scope):
            response = self.get_success_response(self.organization.slug)

            assert "access" in response.data
            assert "projects" not in response.data
            assert "teams" not in response.data
            assert "orgRoleList" not in response.data

    def test_as_superuser(self):
        self.superuser = self.create_user(is_superuser=True)
        team = self.create_team(name="appy", organization=self.organization)

        self.login_as(user=self.superuser, superuser=True)
        for i in range(5):
            self.create_project(organization=self.organization, teams=[team])

        response = self.get_success_response(self.organization.slug)
        assert len(response.data["projects"]) == 5
        assert len(response.data["teams"]) == 1

    def get_onboard_tasks(self, tasks, task_type):
        return [task for task in tasks if task["task"] == task_type]

    def test_onboarding_tasks(self):
        response = self.get_success_response(self.organization.slug)
        assert not self.get_onboard_tasks(response.data["onboardingTasks"], "create_project")
        assert response.data["id"] == str(self.organization.id)

        project = self.create_project(organization=self.organization)
        project_created.send(project=project, user=self.user, sender=type(project))

        response = self.get_success_response(self.organization.slug)
        assert self.get_onboard_tasks(response.data["onboardingTasks"], "create_project")

    def test_trusted_relays_info(self):
        with assume_test_silo_mode_of(AuditLogEntry):
            AuditLogEntry.objects.filter(organization_id=self.organization.id).delete()

        trusted_relays = [
            {
                "publicKey": _VALID_RELAY_KEYS[0],
                "name": "name1",
                "description": "description1",
            },
            {
                "publicKey": _VALID_RELAY_KEYS[1],
                "name": "name2",
                "description": "description2",
            },
        ]

        data = {"trustedRelays": trusted_relays}

        with self.feature("organizations:relay"):
            start_time = timezone.now()
            self.get_success_response(self.organization.slug, method="put", **data)
            end_time = timezone.now()
            response = self.get_success_response(self.organization.slug)

        response_data = response.data.get("trustedRelays")

        assert response_data is not None
        assert len(response_data) == len(trusted_relays)

        for i in range(len(trusted_relays)):
            assert response_data[i]["publicKey"] == trusted_relays[i]["publicKey"]
            assert response_data[i]["name"] == trusted_relays[i]["name"]
            assert response_data[i]["description"] == trusted_relays[i]["description"]
            # check that last_modified is in the correct range
            last_modified = parse_date(response_data[i]["lastModified"])
            assert start_time < last_modified < end_time
            # check that created is in the correct range
            created = parse_date(response_data[i]["created"])
            assert start_time < created < end_time

    def test_has_auth_provider(self):
        response = self.get_success_response(self.organization.slug)
        assert response.data["hasAuthProvider"] is False

        with assume_test_silo_mode_of(AuthProvider):
            AuthProvider.objects.create(organization_id=self.organization.id, provider="dummy")

        response = self.get_success_response(self.organization.slug)
        assert response.data["hasAuthProvider"] is True

    def test_is_dynamically_sampled(self):
        with self.feature({"organizations:dynamic-sampling": True}):
            with patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ):
                response = self.get_success_response(self.organization.slug)
                assert response.data["isDynamicallySampled"]
                assert response.data["planSampleRate"] == 0.5

        with self.feature({"organizations:dynamic-sampling": True}):
            with patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ):
                response = self.get_success_response(self.organization.slug)
                assert not response.data["isDynamicallySampled"]
                assert response.data["planSampleRate"] == 1.0

        with self.feature({"organizations:dynamic-sampling": True}):
            with patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=None,
            ):
                response = self.get_success_response(self.organization.slug)
                assert not response.data["isDynamicallySampled"]
                assert "planSampleRate" not in response.data

        with self.feature({"organizations:dynamic-sampling": False}):
            with patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=None,
            ):
                response = self.get_success_response(self.organization.slug)
                assert not response.data["isDynamicallySampled"]
                assert "planSampleRate" not in response.data

    def test_is_dynamically_sampled_no_org_option(self):
        with self.feature({"organizations:dynamic-sampling-custom": True}):
            with patch(
                "sentry.dynamic_sampling.rules.base.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ):
                response = self.get_success_response(self.organization.slug)
                assert response.data["isDynamicallySampled"]

    def test_is_dynamically_sampled_org_option(self):
        self.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value
        )
        self.organization.update_option("sentry:target_sample_rate", 0.1)
        with self.feature({"organizations:dynamic-sampling-custom": True}):
            response = self.get_success_response(self.organization.slug)
            assert response.data["isDynamicallySampled"]
            assert "planSampleRate" in response.data
            assert "desiredSampleRate" in response.data

        self.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value
        )
        self.organization.update_option("sentry:target_sample_rate", 1.0)
        with self.feature({"organizations:dynamic-sampling-custom": True}):
            response = self.get_success_response(self.organization.slug)
            assert not response.data["isDynamicallySampled"]

    def test_is_dynamically_sampled_proj_option(self):
        proj_1 = self.create_project(organization=self.organization)
        proj_2 = self.create_project(organization=self.organization)

        self.organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT.value)
        proj_1.update_option("sentry:target_sample_rate", 1.0)
        # proj_2 remains unset
        with self.feature({"organizations:dynamic-sampling-custom": True}):
            response = self.get_success_response(self.organization.slug)
            assert not response.data["isDynamicallySampled"]

        proj_2.update_option("sentry:target_sample_rate", 0.1)
        with self.feature({"organizations:dynamic-sampling-custom": True}):
            response = self.get_success_response(self.organization.slug)
            assert response.data["isDynamicallySampled"]
            assert "planSampleRate" not in response.data
            assert "desiredSampleRate" not in response.data

    def test_dynamic_sampling_custom_target_sample_rate(self):
        with self.feature({"organizations:dynamic-sampling-custom": True}):
            response = self.get_success_response(self.organization.slug)
            assert response.data["targetSampleRate"] == 1.0

        with self.feature({"organizations:dynamic-sampling-custom": False}):
            response = self.get_success_response(self.organization.slug)
            assert "targetSampleRate" not in response.data

    def test_dynamic_sampling_custom_sampling_mode(self):
        with self.feature({"organizations:dynamic-sampling-custom": True}):
            response = self.get_success_response(self.organization.slug)
            assert response.data["samplingMode"] == "organization"

        with self.feature({"organizations:dynamic-sampling-custom": False}):
            response = self.get_success_response(self.organization.slug)
            assert "samplingMode" not in response.data

    @django_db_all
    def test_sampling_mode_project_to_org(self):
        """
        Test changing sampling mode from project-level to organization-level:
        - Should set org-level target sample rate to the blended rate
        - Should remove project-level sampling rates
        """
        self.organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT.value)

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        project1.update_option("sentry:target_sample_rate", 0.3)
        project2.update_option("sentry:target_sample_rate", 0.5)

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_response(
                self.organization.slug,
                method="put",
                samplingMode=DynamicSamplingMode.ORGANIZATION.value,
                targetSampleRate=0.123456789,
            )

        assert response.status_code == 200

        # Verify org option was set
        assert self.organization.get_option("sentry:target_sample_rate") == 0.123456789

        # Verify project options were removed

        assert not ProjectOption.objects.filter(
            project__organization_id=self.organization.id, key="sentry:target_sample_rate"
        )

    @django_db_all
    def test_sampling_mode_retains_target_sample_rate(self):
        """
        Test that changing sampling mode while not providing a new targetSampleRate
        retains the previous targetSampleRate value
        """
        self.organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT.value)
        self.organization.update_option("sentry:target_sample_rate", 0.4)

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_response(
                self.organization.slug,
                method="put",
                samplingMode=DynamicSamplingMode.ORGANIZATION.value,
            )

        assert response.status_code == 200
        assert self.organization.get_option("sentry:target_sample_rate") == 0.4

    @django_db_all
    def test_cannot_set_target_sample_rate_in_project_mode(self):
        """
        Test that setting targetSampleRate while in project sampling mode raises an error
        """
        self.organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT.value)

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_response(self.organization.slug, method="put", targetSampleRate=0.5)

        assert response.status_code == 400
        assert response.data == {
            "non_field_errors": [
                "Must be in Automatic Mode to configure the organization sample rate."
            ]
        }

    @django_db_all
    def test_sampling_mode_default_when_not_set(self):
        """
        Test that when sentry:sampling_mode is not set, it uses SAMPLING_MODE_DEFAULT
        when validating targetSampleRate
        """
        # Ensure no sampling mode is set
        self.organization.delete_option("sentry:sampling_mode")

        with self.feature("organizations:dynamic-sampling-custom"):
            # Since SAMPLING_MODE_DEFAULT is ORGANIZATION, this should succeed
            response = self.get_response(self.organization.slug, method="put", targetSampleRate=0.5)

        assert response.status_code == 200
        assert self.organization.get_option("sentry:target_sample_rate") == 0.5

    @django_db_all
    def test_sampling_mode_org_to_project(self):
        """
        Test changing sampling mode from organization-level to project-level:
        - Should preserve existing project rates
        - Should remove org-level target sample rate
        """
        self.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value
        )
        self.organization.update_option("sentry:target_sample_rate", 0.4)

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        # Set some existing sampling rates
        project1.update_option("sentry:target_sample_rate", 0.3)
        project2.update_option("sentry:target_sample_rate", 0.5)

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_response(
                self.organization.slug,
                method="put",
                samplingMode=DynamicSamplingMode.PROJECT.value,
            )

        assert response.status_code == 200

        # Verify project rates were preserved
        assert project1.get_option("sentry:target_sample_rate") == 0.3
        assert project2.get_option("sentry:target_sample_rate") == 0.5

        # Verify org target rate was removed
        assert not self.organization.get_option("sentry:target_sample_rate")

    @django_db_all
    def test_change_just_org_target_sample_rate(self):
        self.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value
        )
        self.organization.update_option("sentry:target_sample_rate", 0.4)
        assert self.organization.get_option("sentry:target_sample_rate") == 0.4

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_response(
                self.organization.slug,
                method="put",
                targetSampleRate=0.1,
            )

        assert response.status_code == 200
        assert self.organization.get_option("sentry:target_sample_rate") == 0.1

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_response(
                self.organization.slug,
                method="put",
                unrelatedData="hello",
            )

        assert response.status_code == 200
        assert self.organization.get_option("sentry:target_sample_rate") == 0.1

    @django_db_all
    def test_sampling_mode_change_requires_write_scope(self):
        """
        Test that changing sampling mode requires org:write scope
        """
        self.non_write_user = self.create_user(is_superuser=False)
        self.create_member(
            user=self.non_write_user,
            organization=self.organization,
            role="member",  # Member role doesn't have org:write scope
        )
        self.login_as(user=self.non_write_user)

        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_response(
                self.organization.slug,
                method="put",
                data={"samplingMode": DynamicSamplingMode.ORGANIZATION.value},
            )

        assert response.status_code == 403

    def test_sensitive_fields_too_long(self):
        value = 1000 * ["0123456789"] + ["1"]
        resp = self.get_response(self.organization.slug, method="put", sensitiveFields=value)
        assert resp.status_code == 400

    def test_with_avatar_image(self):
        organization = self.organization
        OrganizationAvatar.objects.create(
            organization_id=organization.id,
            avatar_type=1,  # upload
            file_id=1,
            ident="abc123",
        )
        resp = self.get_response(organization.slug)
        assert resp.status_code == 200
        assert "avatar" in resp.data
        assert resp.data["avatar"]["avatarType"] == "upload"
        assert resp.data["avatar"]["avatarUuid"] == "abc123"
        assert (
            resp.data["avatar"]["avatarUrl"]
            == generate_region_url() + "/organization-avatar/abc123/"
        )

    def test_old_orgs_with_options_do_not_get_onboarding_feature_flag(self):
        with self.feature("organizations:onboarding"):
            old_date = datetime(2023, 12, 31, tzinfo=UTC)
            old_org = self.create_organization(name="old-org", date_added=old_date, owner=self.user)
            self.login_as(user=self.user)

            OrganizationOption.objects.create(organization_id=old_org.id, key="foo:bar", value=True)

            response = self.get_success_response(
                old_org.slug, qs_params={"include_feature_flags": 1}
            )
            assert "onboarding" not in response.data["features"]

    def test_new_orgs_with_options_get_onboarding_feature_flag(self):
        with self.feature("organizations:onboarding"):
            newer_date = datetime(2024, 12, 31, tzinfo=UTC)
            new_org = self.create_organization(date_added=newer_date, owner=self.user)
            self.login_as(user=self.user)

            OrganizationOption.objects.create(organization_id=new_org.id, key="foo:bar", value=True)

            response = self.get_success_response(
                new_org.slug, qs_params={"include_feature_flags": 1}
            )
            assert "onboarding" in response.data["features"]

    def test_new_orgs_with_options_do_not_get_onboarding_feature_flag(self):
        with self.feature("organizations:onboarding"):
            newer_date = datetime(2024, 12, 31, tzinfo=UTC)
            new_org = self.create_organization(date_added=newer_date, owner=self.user)
            self.login_as(user=self.user)

            OrganizationOption.objects.create(
                organization_id=new_org.id, key="onboarding:complete", value=True
            )

            response = self.get_success_response(
                new_org.slug, qs_params={"include_feature_flags": 1}
            )
            assert "onboarding" not in response.data["features"]


class OrganizationUpdateTest(OrganizationDetailsTestBase):
    method = "put"

    def test_simple(self):
        self.get_success_response(self.organization.slug, name="hello world", slug="foobar")

        org = Organization.objects.get(id=self.organization.id)
        assert org.name == "hello world"
        assert org.slug == "foobar"

    def test_include_feature_flag_query_param(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"include_feature_flags": 1}
        )
        assert "features" in response.data

        response = self.get_success_response(self.organization.slug)
        assert "features" not in response.data

    def test_dupe_slug(self):
        org = self.create_organization(owner=self.user, slug="duplicate")

        self.get_error_response(self.organization.slug, slug=org.slug, status_code=400)

    def test_short_slug(self):
        self.get_error_response(self.organization.slug, slug="a", status_code=400)

    def test_reserved_slug(self):
        illegal_slug = list(RESERVED_ORGANIZATION_SLUGS)[0]
        self.get_error_response(self.organization.slug, slug=illegal_slug, status_code=400)

    def test_valid_slugs(self):
        valid_slugs = ["santry", "downtown-canada", "1234-foo", "SaNtRy"]
        for slug in valid_slugs:
            self.organization.refresh_from_db()
            self.get_success_response(self.organization.slug, slug=slug)

    def test_invalid_slugs(self):
        self.get_error_response(self.organization.slug, slug=" i have whitespace ", status_code=400)
        self.get_error_response(self.organization.slug, slug="foo-bar ", status_code=400)
        self.get_error_response(self.organization.slug, slug="bird-company!", status_code=400)
        self.get_error_response(self.organization.slug, slug="downtown_canada", status_code=400)
        self.get_error_response(self.organization.slug, slug="canada-", status_code=400)
        self.get_error_response(self.organization.slug, slug="-canada", status_code=400)
        self.get_error_response(self.organization.slug, slug="----", status_code=400)
        self.get_error_response(self.organization.slug, slug="1234", status_code=400)

    def test_upload_avatar(self):
        data = {
            "avatarType": "upload",
            "avatar": b64encode(self.load_fixture("avatar.jpg")),
        }
        self.get_success_response(self.organization.slug, **data)

        avatar = OrganizationAvatar.objects.get(organization=self.organization)
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.file_id

    @responses.activate
    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories",
        return_value=[{"name": "cool-repo", "full_name": "testgit/cool-repo"}],
    )
    @with_feature(["organizations:codecov-integration", "organizations:dynamic-sampling-custom"])
    def test_various_options(self, mock_get_repositories):
        initial = self.organization.get_audit_log_data()
        with assume_test_silo_mode_of(AuditLogEntry):
            AuditLogEntry.objects.filter(organization_id=self.organization.id).delete()
        self.create_integration(
            organization=self.organization, provider="github", external_id="extid"
        )
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/github/testgit",
            status=200,
        )

        data = {
            "openMembership": False,
            "isEarlyAdopter": True,
            "codecovAccess": True,
            "allowSuperuserAccess": False,
            "allowMemberInvite": False,
            "hideAiFeatures": True,
            "githubOpenPRBot": False,
            "githubNudgeInvite": False,
            "githubPRBot": False,
            "allowSharedIssues": False,
            "enhancedPrivacy": True,
            "dataScrubber": True,
            "dataScrubberDefaults": True,
            "sensitiveFields": ["password"],
            "eventsMemberAdmin": False,
            "alertsMemberWrite": False,
            "safeFields": ["email"],
            "storeCrashReports": 10,
            "scrubIPAddresses": True,
            "scrapeJavaScript": False,
            "defaultRole": "owner",
            "require2FA": True,
            "allowJoinRequests": False,
            "issueAlertsThreadFlag": False,
            "metricAlertsThreadFlag": False,
            "metricsActivatePercentiles": False,
            "metricsActivateLastForGauges": True,
            "uptimeAutodetection": False,
            "targetSampleRate": 0.1,
            "samplingMode": "organization",
            "rollbackEnabled": True,
            "streamlineOnly": None,
        }

        # needed to set require2FA
        interface = TotpInterface()
        with assume_test_silo_mode_of(Authenticator):
            interface.enroll(self.user)
            assert self.user.has_2fa()

        with outbox_runner():
            self.get_success_response(self.organization.slug, **data)

        org = Organization.objects.get(id=self.organization.id)
        assert initial != org.get_audit_log_data()

        assert org.flags.early_adopter
        assert org.flags.codecov_access
        assert org.flags.prevent_superuser_access
        assert org.flags.disable_member_invite
        assert not org.flags.allow_joinleave
        assert org.flags.disable_shared_issues
        assert org.flags.enhanced_privacy
        assert org.flags.require_2fa
        assert org.default_role == "owner"

        options = {o.key: o.value for o in OrganizationOption.objects.filter(organization=org)}

        assert options.get("sentry:require_scrub_defaults")
        assert options.get("sentry:require_scrub_data")
        assert options.get("sentry:require_scrub_ip_address")
        assert options.get("sentry:sensitive_fields") == ["password"]
        assert options.get("sentry:safe_fields") == ["email"]
        assert options.get("sentry:store_crash_reports") == 10
        assert options.get("sentry:scrape_javascript") is False
        assert options.get("sentry:join_requests") is False
        assert options.get("sentry:events_member_admin") is False
        assert options.get("sentry:metrics_activate_percentiles") is False
        assert options.get("sentry:metrics_activate_last_for_gauges") is True
        assert options.get("sentry:uptime_autodetection") is False
        assert options.get("sentry:target_sample_rate") == 0.1
        assert options.get("sentry:sampling_mode") == "organization"
        assert options.get("sentry:rollback_enabled") is True
        assert options.get("sentry:hide_ai_features") is True

        # log created
        with assume_test_silo_mode_of(AuditLogEntry):
            log = AuditLogEntry.objects.get(organization_id=org.id)
        assert audit_log.get(log.event).api_name == "org.edit"
        # org fields & flags
        assert "to {}".format(data["defaultRole"]) in log.data["default_role"]
        assert "to {}".format(data["openMembership"]) in log.data["allow_joinleave"]
        assert "to {}".format(data["isEarlyAdopter"]) in log.data["early_adopter"]
        assert "to {}".format(data["codecovAccess"]) in log.data["codecov_access"]
        assert (
            "to {}".format(not data["allowSuperuserAccess"]) in log.data["prevent_superuser_access"]
        )
        assert "to {}".format(not data["allowMemberInvite"]) in log.data["disable_member_invite"]
        assert "to {}".format(data["enhancedPrivacy"]) in log.data["enhanced_privacy"]
        assert "to {}".format(not data["allowSharedIssues"]) in log.data["disable_shared_issues"]
        assert "to {}".format(data["require2FA"]) in log.data["require_2fa"]
        # org options
        assert "to {}".format(data["dataScrubber"]) in log.data["dataScrubber"]
        assert "to {}".format(data["dataScrubberDefaults"]) in log.data["dataScrubberDefaults"]
        assert "to {}".format(data["sensitiveFields"]) in log.data["sensitiveFields"]
        assert "to {}".format(data["safeFields"]) in log.data["safeFields"]
        assert "to {}".format(data["storeCrashReports"]) in log.data["storeCrashReports"]
        assert "to {}".format(data["scrubIPAddresses"]) in log.data["scrubIPAddresses"]
        assert "to {}".format(data["scrapeJavaScript"]) in log.data["scrapeJavaScript"]
        assert "to {}".format(data["allowJoinRequests"]) in log.data["allowJoinRequests"]
        assert "to {}".format(data["eventsMemberAdmin"]) in log.data["eventsMemberAdmin"]
        assert "to {}".format(data["alertsMemberWrite"]) in log.data["alertsMemberWrite"]
        assert "to {}".format(data["hideAiFeatures"]) in log.data["hideAiFeatures"]
        assert "to {}".format(data["githubPRBot"]) in log.data["githubPRBot"]
        assert "to {}".format(data["githubOpenPRBot"]) in log.data["githubOpenPRBot"]
        assert "to {}".format(data["githubNudgeInvite"]) in log.data["githubNudgeInvite"]
        assert "to {}".format(data["issueAlertsThreadFlag"]) in log.data["issueAlertsThreadFlag"]
        assert "to {}".format(data["metricAlertsThreadFlag"]) in log.data["metricAlertsThreadFlag"]
        assert (
            "to {}".format(data["metricsActivatePercentiles"])
            in log.data["metricsActivatePercentiles"]
        )
        assert (
            "to {}".format(data["metricsActivateLastForGauges"])
            in log.data["metricsActivateLastForGauges"]
        )
        assert "to {}".format(data["uptimeAutodetection"]) in log.data["uptimeAutodetection"]

    @responses.activate
    @patch(
        "sentry.integrations.github.client.GitHubApiClient.get_repositories",
        return_value=[{"name": "abc", "full_name": "testgit/abc"}],
    )
    @with_feature("organizations:codecov-integration")
    def test_setting_codecov_without_integration_forbidden(self, mock_get_repositories):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/github/testgit",
            status=404,
        )
        data = {"codecovAccess": True}
        self.get_error_response(self.organization.slug, status_code=400, **data)

    def test_setting_codecov_without_paid_plan_forbidden(self):
        data = {"codecovAccess": True}
        self.get_error_response(self.organization.slug, status_code=403, **data)

    def test_setting_trusted_relays_forbidden(self):
        data = {
            "trustedRelays": [
                {"publicKey": _VALID_RELAY_KEYS[0], "name": "name1"},
                {"publicKey": _VALID_RELAY_KEYS[1], "name": "name2"},
            ]
        }

        with self.feature({"organizations:relay": False}):
            response = self.get_error_response(self.organization.slug, status_code=400, **data)

        assert b"feature" in response.content

    def test_setting_duplicate_trusted_keys(self):
        """
        Test that you cannot set duplicated keys

        Try to put the same key twice and check we get an error
        """
        with assume_test_silo_mode_of(AuditLogEntry):
            AuditLogEntry.objects.filter(organization_id=self.organization.id).delete()

        trusted_relays = [
            {
                "publicKey": _VALID_RELAY_KEYS[0],
                "name": "name1",
                "description": "description1",
            },
            {
                "publicKey": _VALID_RELAY_KEYS[1],
                "name": "name2",
                "description": "description2",
            },
            {
                "publicKey": _VALID_RELAY_KEYS[0],
                "name": "name1 2",
                "description": "description1 2",
            },
        ]

        data = {"trustedRelays": trusted_relays}

        with self.feature("organizations:relay"):
            response = self.get_error_response(self.organization.slug, status_code=400, **data)

        response_data = response.data.get("trustedRelays")
        assert response_data is not None
        resp_str = orjson.dumps(response_data).decode()
        # check that we have the duplicate key specified somewhere in the error message
        assert resp_str.find(_VALID_RELAY_KEYS[0]) >= 0

    def test_creating_trusted_relays(self):
        with assume_test_silo_mode_of(AuditLogEntry):
            AuditLogEntry.objects.filter(organization_id=self.organization.id).delete()

        trusted_relays = [
            {
                "publicKey": _VALID_RELAY_KEYS[0],
                "name": "name1",
                "description": "description1",
            },
            {
                "publicKey": _VALID_RELAY_KEYS[1],
                "name": "name2",
                "description": "description2",
            },
        ]

        data = {"trustedRelays": trusted_relays}

        with self.feature("organizations:relay"), outbox_runner():
            start_time = timezone.now()
            response = self.get_success_response(self.organization.slug, **data)
            end_time = timezone.now()
            response_data = response.data.get("trustedRelays")

        actual = get_trusted_relay_value(self.organization)
        assert len(actual) == len(trusted_relays)
        assert len(response_data) == len(trusted_relays)

        for i in range(len(actual)):
            assert actual[i]["public_key"] == trusted_relays[i]["publicKey"]
            assert actual[i]["name"] == trusted_relays[i]["name"]
            assert actual[i]["description"] == trusted_relays[i]["description"]
            assert response_data[i]["publicKey"] == trusted_relays[i]["publicKey"]
            assert response_data[i]["name"] == trusted_relays[i]["name"]
            assert response_data[i]["description"] == trusted_relays[i]["description"]
            # check that last_modified is in the correct range
            last_modified = parse_date(actual[i]["last_modified"])
            assert start_time < last_modified < end_time
            assert response_data[i]["lastModified"] == actual[i]["last_modified"]
            # check that created is in the correct range
            created = parse_date(actual[i]["created"])
            assert start_time < created < end_time
            assert response_data[i]["created"] == actual[i]["created"]

        with assume_test_silo_mode_of(AuditLogEntry):
            log = AuditLogEntry.objects.get(organization_id=self.organization.id)
        trusted_relay_log = log.data["trustedRelays"]

        assert trusted_relay_log is not None
        # check that we log a new trusted-relays entry
        assert trusted_relay_log.startswith("to ")
        # check that we have the public keys somewhere in the log message
        assert trusted_relays[0]["publicKey"] in trusted_relay_log
        assert trusted_relays[1]["publicKey"] in trusted_relay_log

    def test_modifying_trusted_relays(self):
        with assume_test_silo_mode_of(AuditLogEntry):
            AuditLogEntry.objects.filter(organization_id=self.organization.id).delete()

        initial_trusted_relays = [
            {
                "publicKey": _VALID_RELAY_KEYS[0],
                "name": "name1",
                "description": "description1",
            },
            {
                "publicKey": _VALID_RELAY_KEYS[1],
                "name": "name2",
                "description": "description2",
            },
            {
                "publicKey": _VALID_RELAY_KEYS[2],
                "name": "name3",
                "description": "description3",
            },
        ]

        modified_trusted_relays = [
            # key1 was removed
            # key2 is not modified
            {
                "publicKey": _VALID_RELAY_KEYS[1],
                "name": "name2",
                "description": "description2",
            },
            # key3 modified name & desc
            {
                "publicKey": _VALID_RELAY_KEYS[2],
                "name": "name3 modified",
                "description": "description3 modified",
            },
            # key4 is new
            {
                "publicKey": _VALID_RELAY_KEYS[3],
                "name": "name4",
                "description": "description4",
            },
        ]

        initial_settings = {"trustedRelays": initial_trusted_relays}
        changed_settings = {"trustedRelays": modified_trusted_relays}

        with self.feature("organizations:relay"), outbox_runner():
            start_time = timezone.now()
            self.get_success_response(self.organization.slug, **initial_settings)
            after_initial = timezone.now()
            self.get_success_response(self.organization.slug, **changed_settings)
            after_final = timezone.now()

        actual = get_trusted_relay_value(self.organization)
        assert len(actual) == len(modified_trusted_relays)

        for i in range(len(actual)):
            assert actual[i]["public_key"] == modified_trusted_relays[i]["publicKey"]
            assert actual[i]["name"] == modified_trusted_relays[i]["name"]
            assert actual[i]["description"] == modified_trusted_relays[i]["description"]

            last_modified = parse_date(actual[i]["last_modified"])
            created = parse_date(actual[i]["created"])
            key = modified_trusted_relays[i]["publicKey"]

            if key == _VALID_RELAY_KEYS[1]:
                # key2 should have not been modified
                assert start_time < created < after_initial
                assert start_time < last_modified < after_initial
            elif key == _VALID_RELAY_KEYS[2]:
                # key3 should have been updated
                assert start_time < created < after_initial
                assert after_initial < last_modified < after_final
            elif key == _VALID_RELAY_KEYS[3]:
                # key4 is new
                assert after_initial < created < after_final
                assert after_initial < last_modified < after_final

        # we should have 2 log messages from the two calls
        with assume_test_silo_mode_of(AuditLogEntry):
            (first_log, second_log) = AuditLogEntry.objects.filter(
                organization_id=self.organization.id
            )
        log_str_1 = first_log.data["trustedRelays"]
        log_str_2 = second_log.data["trustedRelays"]

        assert log_str_1 is not None
        assert log_str_2 is not None

        if log_str_1.startswith("to "):
            modif_log = log_str_2
        else:
            modif_log = log_str_1

        assert modif_log.startswith("from ")
        # check that we have the new public keys somewhere in the modify operation log message
        for i in range(len(modified_trusted_relays)):
            assert modified_trusted_relays[i]["publicKey"] in modif_log

    def test_deleting_trusted_relays(self):
        with assume_test_silo_mode_of(AuditLogEntry):
            AuditLogEntry.objects.filter(organization_id=self.organization.id).delete()

        initial_trusted_relays = [
            {
                "publicKey": _VALID_RELAY_KEYS[0],
                "name": "name1",
                "description": "description1",
            },
        ]

        initial_settings = {"trustedRelays": initial_trusted_relays}
        changed_settings: dict[str, Any] = {"trustedRelays": []}

        with self.feature("organizations:relay"):
            self.get_success_response(self.organization.slug, **initial_settings)
            response = self.get_success_response(self.organization.slug, **changed_settings)

        response_data = response.data.get("trustedRelays")

        actual = get_trusted_relay_value(self.organization)
        assert len(actual) == 0
        assert len(response_data) == 0

    def test_setting_legacy_rate_limits(self):
        data = {"accountRateLimit": 1000}
        self.get_error_response(self.organization.slug, status_code=400, **data)

        data = {"projectRateLimit": 1000}
        self.get_error_response(self.organization.slug, status_code=400, **data)

        OrganizationOption.objects.set_value(self.organization, "sentry:project-rate-limit", 1)

        data = {"projectRateLimit": 100}
        self.get_success_response(self.organization.slug, **data)

        assert (
            OrganizationOption.objects.get_value(self.organization, "sentry:project-rate-limit")
            == 100
        )

        data = {"accountRateLimit": 50}
        self.get_success_response(self.organization.slug, **data)

        assert (
            OrganizationOption.objects.get_value(self.organization, "sentry:account-rate-limit")
            == 50
        )

    def test_safe_fields_as_string_regression(self):
        data = {"safeFields": "email"}
        self.get_error_response(self.organization.slug, status_code=400, **data)
        org = Organization.objects.get(id=self.organization.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(organization=org)}

        assert not options.get("sentry:safe_fields")

    def test_manager_cannot_set_default_role(self):
        org = self.create_organization(owner=self.user)
        user = self.create_user("baz@example.com")
        self.create_member(organization=org, user=user, role="manager")
        self.login_as(user=user)

        self.get_success_response(org.slug, **{"defaultRole": "owner"})
        org = Organization.objects.get(id=org.id)

        assert org.default_role == "member"

    def test_empty_string_in_array_safe_fields(self):
        self.get_error_response(self.organization.slug, status_code=400, **{"safeFields": [""]})
        org = Organization.objects.get(id=self.organization.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(organization=org)}

        assert not options.get("sentry:safe_fields")

    def test_empty_string_in_array_sensitive_fields(self):
        OrganizationOption.objects.set_value(
            self.organization, "sentry:sensitive_fields", ["foobar"]
        )

        self.get_error_response(
            self.organization.slug, status_code=400, **{"sensitiveFields": [""]}
        )
        org = Organization.objects.get(id=self.organization.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(organization=org)}

        assert options.get("sentry:sensitive_fields") == ["foobar"]

    def test_empty_sensitive_fields(self):
        OrganizationOption.objects.set_value(
            self.organization, "sentry:sensitive_fields", ["foobar"]
        )

        self.get_success_response(self.organization.slug, **{"sensitiveFields": []})
        org = Organization.objects.get(id=self.organization.id)

        options = {o.key: o.value for o in OrganizationOption.objects.filter(organization=org)}

        assert not options.get("sentry:sensitive_fields")

    def test_cancel_delete(self):
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)
        RegionScheduledDeletion.schedule(org, days=1)

        self.get_success_response(org.slug, **{"cancelDeletion": True})

        org = Organization.objects.get(id=org.id)
        assert org.status == OrganizationStatus.ACTIVE
        assert not RegionScheduledDeletion.objects.filter(
            model_name="Organization", object_id=org.id
        ).exists()

    def test_relay_pii_config(self):
        value = '{"applications": {"freeform": []}}'
        response = self.get_success_response(self.organization.slug, **{"relayPiiConfig": value})

        assert self.organization.get_option("sentry:relay_pii_config") == value
        assert response.data["relayPiiConfig"] == value

    def test_store_crash_reports_exceeded(self):
        # Uses a hard-coded number of MAX + 1 for regression testing.
        #
        # DO NOT INCREASE this number without checking the logic in event
        # manager's ``get_stored_crashreports`` function. Increasing this number
        # causes more load on postgres during ingestion.
        data = {"storeCrashReports": 101}

        resp = self.get_error_response(self.organization.slug, status_code=400, **data)
        assert self.organization.get_option("sentry:store_crash_reports") is None
        assert b"storeCrashReports" in resp.content

    def test_update_name_with_mapping_and_slug_reservation(self):
        response = self.get_success_response(self.organization.slug, name="SaNtRy")

        organization_id = response.data["id"]
        org = Organization.objects.get(id=organization_id)
        assert org.name == "SaNtRy"

        with assume_test_silo_mode_of(OrganizationMapping):
            assert OrganizationMapping.objects.filter(
                organization_id=organization_id, name="SaNtRy"
            ).exists()

    def test_update_slug(self):
        with outbox_runner():
            pass

        with assume_test_silo_mode_of(OrganizationMapping, OrganizationSlugReservation):
            organization_mapping = OrganizationMapping.objects.get(
                organization_id=self.organization.id,
            )
            org_slug_res = OrganizationSlugReservation.objects.get(
                organization_id=self.organization.id, slug=self.organization.slug
            )

        assert organization_mapping.slug == self.organization.slug

        desired_slug = "new-santry"
        self.get_success_response(self.organization.slug, slug=desired_slug)
        self.organization.refresh_from_db()
        assert self.organization.slug == desired_slug

        organization_mapping.refresh_from_db()
        assert organization_mapping.slug == desired_slug
        org_slug_res.refresh_from_db()
        assert org_slug_res.slug == desired_slug

    def test_org_mapping_already_taken(self):
        self.create_organization(slug="taken")
        self.get_error_response(self.organization.slug, slug="taken", status_code=400)

    def test_target_sample_rate_feature(self):
        with self.feature("organizations:dynamic-sampling-custom"):
            data = {"targetSampleRate": 0.1}
            self.get_success_response(self.organization.slug, **data)

        with self.feature({"organizations:dynamic-sampling-custom": False}):
            data = {"targetSampleRate": 0.1}
            self.get_error_response(self.organization.slug, status_code=400, **data)

    @with_feature("organizations:dynamic-sampling-custom")
    def test_target_sample_rate_range(self):
        # low, within and high
        data = {"targetSampleRate": 0.0}
        self.get_success_response(self.organization.slug, **data)

        data = {"targetSampleRate": 0.1}
        self.get_success_response(self.organization.slug, **data)

        data = {"targetSampleRate": 1.0}
        self.get_success_response(self.organization.slug, **data)

        # below range
        data = {"targetSampleRate": -0.1}
        self.get_error_response(self.organization.slug, status_code=400, **data)

        # above range
        data = {"targetSampleRate": 1.1}
        self.get_error_response(self.organization.slug, status_code=400, **data)

    def test_sampling_mode_feature(self):
        with self.feature("organizations:dynamic-sampling-custom"):
            data = {"samplingMode": "project"}
            self.get_success_response(self.organization.slug, **data)

        with self.feature({"organizations:dynamic-sampling-custom": False}):
            data = {"samplingMode": "project"}
            self.get_error_response(self.organization.slug, status_code=400, **data)

    @with_feature("organizations:dynamic-sampling-custom")
    def test_sampling_mode_values(self):
        # project
        data = {"samplingMode": "project"}
        self.get_success_response(self.organization.slug, **data)

        # organization
        data = {"samplingMode": "organization"}
        self.get_success_response(self.organization.slug, **data)

        # invalid
        data = {"samplingMode": "invalid"}
        self.get_error_response(self.organization.slug, status_code=400, **data)


class OrganizationDeleteTest(OrganizationDetailsTestBase):
    method = "delete"

    def test_can_remove_as_owner(self):
        owners = self.organization.get_owners()
        assert len(owners) > 0

        with self.tasks():
            self.get_success_response(self.organization.slug, status_code=status.HTTP_202_ACCEPTED)

        org = Organization.objects.get(id=self.organization.id)

        assert org.status == OrganizationStatus.PENDING_DELETION

        deleted_org = DeletedOrganization.objects.get(slug=org.slug)
        self.assert_valid_deleted_log(deleted_org, org)

        schedule = RegionScheduledDeletion.objects.get(object_id=org.id, model_name="Organization")
        # Delay is 24 hours but to avoid wobbling microseconds we compare with 23 hours.
        assert schedule.date_scheduled >= timezone.now() + timedelta(hours=23)

        # Make sure we've emailed all owners
        assert len(mail.outbox) == len(owners)
        owner_emails = {o.email for o in owners}
        for msg in mail.outbox:
            assert "Deletion" in msg.subject
            assert self.user.username in msg.body
            # Test that the IP address is correctly rendered in the email
            assert "IP: 127.0.0.1" in msg.body
            assert len(msg.to) == 1
            owner_emails.remove(msg.to[0])
        # No owners should be remaining
        assert len(owner_emails) == 0

        with outbox_runner():
            pass

        with assume_test_silo_mode_of(AuditLogEntry):
            assert AuditLogEntry.objects.filter(
                organization_id=self.organization.id, actor=self.user.id
            ).exists()

    def test_cannot_remove_as_admin(self):
        org = self.create_organization(owner=self.user)
        user = self.create_user(email="foo@example.com", is_superuser=False)
        self.create_member(organization=org, user=user, role="admin")

        self.login_as(user)

        self.get_error_response(org.slug, status_code=403)

    def test_cannot_remove_default(self):
        with unguarded_write(using=router.db_for_write(Organization)):
            Organization.objects.all().delete()
        org = self.create_organization(owner=self.user)

        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            self.get_error_response(org.slug, status_code=400)

    def test_redo_deletion(self):
        # Orgs can delete, undelete, delete within a day
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)
        RegionScheduledDeletion.schedule(org, days=1)

        self.get_success_response(org.slug, status_code=status.HTTP_202_ACCEPTED)

        org = Organization.objects.get(id=org.id)
        assert org.status == OrganizationStatus.PENDING_DELETION

        scheduled_deletions = RegionScheduledDeletion.objects.filter(
            object_id=org.id, model_name="Organization"
        )
        assert scheduled_deletions.exists()
        assert scheduled_deletions.count() == 1

    def test_update_org_mapping_on_deletion(self):
        with assume_test_silo_mode_of(OrganizationMapping):
            org_mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        assert org_mapping.status == OrganizationStatus.ACTIVE
        with self.tasks(), outbox_runner():
            self.get_success_response(self.organization.slug, status_code=status.HTTP_202_ACCEPTED)

        org = Organization.objects.get(id=self.organization.id)
        assert org.status == OrganizationStatus.PENDING_DELETION

        deleted_org = DeletedOrganization.objects.get(slug=org.slug)
        self.assert_valid_deleted_log(deleted_org, org)

        org_mapping.refresh_from_db()
        assert org_mapping.status == OrganizationStatus.PENDING_DELETION

    def test_organization_does_not_exist(self):
        with unguarded_write(using=router.db_for_write(Organization)):
            Organization.objects.all().delete()

        self.get_error_response("nonexistent-slug", status_code=404)

    def test_published_sentry_app(self):
        """Test that we do not allow an organization who has a published sentry app to be deleted"""
        org = self.create_organization(name="test", owner=self.user)
        self.create_sentry_app(
            organization=org,
            scopes=["project:write"],
            published=True,
        )
        self.login_as(self.user)
        self.get_error_response(org.slug, status_code=400)


class OrganizationSettings2FATest(TwoFactorAPITestCase):
    endpoint = "sentry-api-0-organization-details"

    def setUp(self):
        # 2FA enforced org
        self.org_2fa = self.create_organization(owner=self.create_user())
        self.enable_org_2fa(self.org_2fa)
        self.no_2fa_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=self.no_2fa_user, role="member")

        # 2FA not enforced org
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.manager = self.create_user()
        self.create_member(organization=self.organization, user=self.manager, role="manager")
        self.org_user = self.create_user()
        self.create_member(organization=self.organization, user=self.org_user, role="member")

        # 2FA enrolled user
        self.has_2fa = self.create_user()
        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(self.has_2fa)
        self.create_member(organization=self.organization, user=self.has_2fa, role="manager")

        with assume_test_silo_mode_of(Authenticator):
            assert self.has_2fa.has_2fa()

    def assert_2fa_email_equal(self, outbox, expected):
        invite_url_regex = re.compile(r"http://.*/accept/[0-9]+/[a-f0-9]+/")
        assert len(outbox) == len(expected)
        assert sorted(email.to[0] for email in outbox) == sorted(expected)
        for email in outbox:
            assert invite_url_regex.search(
                email.body
            ), f"No invite URL found in 2FA invite email body to: {email.to}"

    def assert_has_correct_audit_log(
        self, acting_user: User, target_user: User, organization: Organization
    ):
        with outbox_runner():
            pass

        with assume_test_silo_mode_of(AuditLogEntry):
            audit_log_entry_query = AuditLogEntry.objects.filter(
                actor_id=acting_user.id,
                organization_id=organization.id,
                event=audit_log.get_event_id("MEMBER_PENDING"),
                target_user_id=target_user.id,
            )

        assert (
            audit_log_entry_query.exists()
        ), f"No matching audit log entry found for actor: {acting_user}, target_user: {target_user}"

        assert (
            len(audit_log_entry_query) == 1
        ), f"More than 1 matching audit log entry found for actor: {acting_user}, target_user: {target_user}"

        audit_log_entry = audit_log_entry_query[0]
        assert audit_log_entry.target_object == organization.id
        assert audit_log_entry.data
        assert audit_log_entry.ip_address == "127.0.0.1"

    def test_cannot_enforce_2fa_without_2fa_enabled(self):
        with assume_test_silo_mode_of(Authenticator):
            assert not self.owner.has_2fa()
        self.assert_cannot_enable_org_2fa(self.organization, self.owner, 400, ERR_NO_2FA)

        # having recovery codes only (backup method) should not allow to enforce org 2FA
        with assume_test_silo_mode_of(Authenticator):
            RecoveryCodeInterface().enroll(self.owner)
            assert not self.owner.has_2fa()
        self.assert_cannot_enable_org_2fa(self.organization, self.owner, 400, ERR_NO_2FA)

    def test_cannot_enforce_2fa_with_sso_enabled(self):
        with assume_test_silo_mode_of(AuthProvider):
            auth_provider = AuthProvider.objects.create(
                provider="github", organization_id=self.organization.id
            )
        # bypass SSO login
        auth_provider.flags.allow_unlinked = True
        with assume_test_silo_mode_of(AuthProvider):
            auth_provider.save()

        self.assert_cannot_enable_org_2fa(self.organization, self.has_2fa, 400, ERR_SSO_ENABLED)

    def test_cannot_enforce_2fa_with_saml_enabled(self):
        with assume_test_silo_mode_of(AuthProvider):
            auth_provider = AuthProvider.objects.create(
                provider="saml2", organization_id=self.organization.id
            )
        # bypass SSO login
        auth_provider.flags.allow_unlinked = True
        with assume_test_silo_mode_of(AuthProvider):
            auth_provider.save()

        self.assert_cannot_enable_org_2fa(self.organization, self.has_2fa, 400, ERR_SSO_ENABLED)

    def test_owner_can_set_2fa_single_member(self):
        org = self.create_organization(owner=self.owner)
        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(self.owner)
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.assert_can_enable_org_2fa(org, self.owner)
        assert len(mail.outbox) == 0

    def test_manager_can_set_2fa(self):
        org = self.create_organization(owner=self.owner)
        self.create_member(organization=org, user=self.manager, role="manager")

        self.assert_cannot_enable_org_2fa(org, self.manager, 400)
        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(self.manager)
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.assert_can_enable_org_2fa(org, self.manager)

        self.assert_2fa_email_equal(mail.outbox, [self.owner.email])
        self.assert_has_correct_audit_log(
            acting_user=self.manager, target_user=self.owner, organization=org
        )

    def test_members_cannot_set_2fa(self):
        self.assert_cannot_enable_org_2fa(self.organization, self.org_user, 403)
        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(self.org_user)
        self.assert_cannot_enable_org_2fa(self.organization, self.org_user, 403)

    def test_owner_can_set_org_2fa(self):
        org = self.create_organization(owner=self.owner)
        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(self.owner)
            user_emails_without_2fa = self.add_2fa_users_to_org(org)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.assert_can_enable_org_2fa(org, self.owner)
        self.assert_2fa_email_equal(mail.outbox, user_emails_without_2fa)

        for user_email in user_emails_without_2fa:
            with assume_test_silo_mode_of(User):
                user = User.objects.get(username=user_email)

            self.assert_has_correct_audit_log(
                acting_user=self.owner, target_user=user, organization=org
            )

        mail.outbox = []
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            response = self.api_disable_org_2fa(org, self.owner)

        assert response.status_code == 200
        assert not Organization.objects.get(id=org.id).flags.require_2fa
        assert len(mail.outbox) == 0

    def test_preexisting_members_must_enable_2fa(self):
        self.login_as(self.no_2fa_user)
        self.get_error_response(self.org_2fa.slug, status_code=401)

        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

    def test_new_member_must_enable_2fa(self):
        new_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=new_user, role="member")
        self.login_as(new_user)
        self.get_error_response(self.org_2fa.slug, status_code=401)

        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(new_user)
        self.get_success_response(self.org_2fa.slug)

    def test_member_disable_all_2fa_blocked(self):
        with assume_test_silo_mode_of(Authenticator):
            TotpInterface().enroll(self.no_2fa_user)
        self.login_as(self.no_2fa_user)

        self.get_success_response(self.org_2fa.slug)

        with assume_test_silo_mode_of(Authenticator):
            Authenticator.objects.get(user=self.no_2fa_user).delete()
        self.get_error_response(self.org_2fa.slug, status_code=401)

    def test_superuser_can_access_org_details(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)
        self.get_success_response(self.org_2fa.slug)


def test_trusted_relays_option_serialization():
    # incoming raw data
    data = {
        "publicKey": _VALID_RELAY_KEYS[0],
        "name": "Relay1",
        "description": "the description",
        "lastModified": "2020-05-20T20:21:22",
        "created": "2020-01-17T11:12:13",
    }
    serializer = TrustedRelaySerializer(data=data)
    assert serializer.is_valid()

    expected_incoming = {
        "public_key": _VALID_RELAY_KEYS[0],
        "name": "Relay1",
        "description": "the description",
    }

    # check incoming deserialization (data will be further completed with date info the by server)
    assert serializer.validated_data == expected_incoming


invalid_payloads = [
    {
        "publicKey": _VALID_RELAY_KEYS[0],
        # no name
        "description": "the description",
    },
    {
        "publicKey": _VALID_RELAY_KEYS[0],
        "name": "  ",  # empty name
        "description": "the description",
    },
    {
        "publicKey": _VALID_RELAY_KEYS[0],
        "name": None,  # null name
        "description": "the description",
    },
    {"publicKey": "Bad Key", "name": "name", "description": "the description"},  # invalid key
    {
        # missing key
        "name": "name",
        "description": "the description",
    },
    {"publicKey": None, "name": "name", "description": "the description"},  # null key
    "Bad input",  # not an object
]


@pytest.mark.parametrize("invalid_data", invalid_payloads)
def test_trusted_relay_serializer_validation(invalid_data):
    """
    Tests that the public key is validated
    """
    # incoming raw data
    serializer = TrustedRelaySerializer(data=invalid_data)
    assert not serializer.is_valid()


def test_trusted_relays_option_deserialization():
    # internal data
    instance = {
        "public_key": "key1",
        "name": "Relay1",
        "description": "the description",
        "last_modified": "2020-05-20T20:21:22Z",
        "created": "2020-01-17T11:12:13Z",
    }
    serializer = TrustedRelaySerializer(instance)

    expected_outgoing = {
        "publicKey": "key1",
        "name": "Relay1",
        "description": "the description",
        "lastModified": "2020-05-20T20:21:22Z",
        "created": "2020-01-17T11:12:13Z",
    }
    # check outgoing deserialization (all info in camelCase)
    assert serializer.data == expected_outgoing
