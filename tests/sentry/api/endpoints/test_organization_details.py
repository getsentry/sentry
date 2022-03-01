from base64 import b64encode
from datetime import datetime, timedelta

from dateutil.parser import parse as parse_date
from django.core import mail
from django.utils import timezone
from pytz import UTC

from sentry.api.endpoints.organization_details import ERR_NO_2FA, ERR_SSO_ENABLED
from sentry.auth.authenticators import TotpInterface
from sentry.constants import RESERVED_ORGANIZATION_SLUGS
from sentry.models import (
    AuditLogEntry,
    Authenticator,
    AuthProvider,
    DeletedOrganization,
    ObjectStatus,
    Organization,
    OrganizationAvatar,
    OrganizationOption,
    OrganizationStatus,
    ScheduledDeletion,
)
from sentry.signals import project_created
from sentry.testutils import APITestCase, TwoFactorAPITestCase, pytest
from sentry.utils import json

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


class OrganizationDetailsTest(OrganizationDetailsTestBase):
    def test_simple(self):
        response = self.get_success_response(self.organization.slug)

        assert response.data["onboardingTasks"] == []
        assert response.data["id"] == str(self.organization.id)
        assert response.data["role"] == "owner"
        assert len(response.data["teams"]) == 0
        assert len(response.data["projects"]) == 0

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

        # TODO(dcramer): We need to pare this down. Lots of duplicate queries for membership data.
        expected_queries = 35

        # TODO(mgaeta): Extra query while we're "dual reading" from UserOptions and NotificationSettings.
        expected_queries += 1

        # Symbolication Low Priority Queue stats reads two killswitches
        expected_queries += 8

        with self.assertNumQueries(expected_queries, using="default"):
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

    def test_as_superuser(self):
        self.user = self.create_user("super@example.org", is_superuser=True)
        org = self.create_organization(owner=self.user)
        team = self.create_team(name="appy", organization=org)

        self.login_as(user=self.user)
        for i in range(5):
            self.create_project(organization=org, teams=[team])

        response = self.get_success_response(org.slug)
        assert len(response.data["projects"]) == 5
        assert len(response.data["teams"]) == 1

    def test_onboarding_tasks(self):
        response = self.get_success_response(self.organization.slug)
        assert response.data["onboardingTasks"] == []
        assert response.data["id"] == str(self.organization.id)

        project = self.create_project(organization=self.organization)
        project_created.send(project=project, user=self.user, sender=type(project))

        response = self.get_success_response(self.organization.slug)
        assert len(response.data["onboardingTasks"]) == 1
        assert response.data["onboardingTasks"][0]["task"] == "create_project"

    def test_trusted_relays_info(self):
        AuditLogEntry.objects.filter(organization=self.organization).delete()

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
            start_time = datetime.utcnow().replace(tzinfo=UTC)
            self.get_success_response(self.organization.slug, method="put", **data)
            end_time = datetime.utcnow().replace(tzinfo=UTC)
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


class OrganizationUpdateTest(OrganizationDetailsTestBase):
    method = "put"

    def test_simple(self):
        self.get_success_response(self.organization.slug, name="hello world", slug="foobar")

        org = Organization.objects.get(id=self.organization.id)
        assert org.name == "hello world"
        assert org.slug == "foobar"

    def test_dupe_slug(self):
        org = self.create_organization(owner=self.user, slug="duplicate")

        self.get_error_response(self.organization.slug, slug=org.slug, status_code=400)

    def test_short_slug(self):
        self.get_error_response(self.organization.slug, slug="a", status_code=400)

    def test_reserved_slug(self):
        illegal_slug = list(RESERVED_ORGANIZATION_SLUGS)[0]
        self.get_error_response(self.organization.slug, slug=illegal_slug, status_code=400)

    def test_upload_avatar(self):
        data = {"avatarType": "upload", "avatar": b64encode(self.load_fixture("avatar.jpg"))}
        self.get_success_response(self.organization.slug, **data)

        avatar = OrganizationAvatar.objects.get(organization=self.organization)
        assert avatar.get_avatar_type_display() == "upload"
        assert avatar.file_id

    def test_various_options(self):
        initial = self.organization.get_audit_log_data()
        AuditLogEntry.objects.filter(organization=self.organization).delete()

        data = {
            "openMembership": False,
            "isEarlyAdopter": True,
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
        }

        # needed to set require2FA
        interface = TotpInterface()
        interface.enroll(self.user)
        assert Authenticator.objects.user_has_2fa(self.user)

        self.get_success_response(self.organization.slug, **data)

        org = Organization.objects.get(id=self.organization.id)
        assert initial != org.get_audit_log_data()

        assert org.flags.early_adopter
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

        # log created
        log = AuditLogEntry.objects.get(organization=org)
        assert log.get_event_display() == "org.edit"
        # org fields & flags
        assert "to {}".format(data["defaultRole"]) in log.data["default_role"]
        assert "to {}".format(data["openMembership"]) in log.data["allow_joinleave"]
        assert "to {}".format(data["isEarlyAdopter"]) in log.data["early_adopter"]
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
        AuditLogEntry.objects.filter(organization=self.organization).delete()

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
        resp_str = json.dumps(response_data)
        # check that we have the duplicate key specified somewhere in the error message
        assert resp_str.find(_VALID_RELAY_KEYS[0]) >= 0

    def test_creating_trusted_relays(self):
        AuditLogEntry.objects.filter(organization=self.organization).delete()

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
            start_time = datetime.utcnow().replace(tzinfo=UTC)
            response = self.get_success_response(self.organization.slug, **data)
            end_time = datetime.utcnow().replace(tzinfo=UTC)
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

        log = AuditLogEntry.objects.get(organization=self.organization)
        trusted_relay_log = log.data["trustedRelays"]

        assert trusted_relay_log is not None
        # check that we log a new trusted-relays entry
        assert trusted_relay_log.startswith("to ")
        # check that we have the public keys somewhere in the log message
        assert trusted_relays[0]["publicKey"] in trusted_relay_log
        assert trusted_relays[1]["publicKey"] in trusted_relay_log

    def test_modifying_trusted_relays(self):
        AuditLogEntry.objects.filter(organization=self.organization).delete()

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

        with self.feature("organizations:relay"):
            start_time = datetime.utcnow().replace(tzinfo=UTC)
            self.get_success_response(self.organization.slug, **initial_settings)
            after_initial = datetime.utcnow().replace(tzinfo=UTC)
            self.get_success_response(self.organization.slug, **changed_settings)
            after_final = datetime.utcnow().replace(tzinfo=UTC)

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
        (first_log, second_log) = AuditLogEntry.objects.filter(organization=self.organization)
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
        AuditLogEntry.objects.filter(organization=self.organization).delete()

        initial_trusted_relays = [
            {
                "publicKey": _VALID_RELAY_KEYS[0],
                "name": "name1",
                "description": "description1",
            },
        ]

        initial_settings = {"trustedRelays": initial_trusted_relays}
        changed_settings = {"trustedRelays": []}

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
        ScheduledDeletion.schedule(org, days=1)

        self.get_success_response(org.slug, **{"cancelDeletion": True})

        org = Organization.objects.get(id=org.id)
        assert org.status == OrganizationStatus.VISIBLE
        assert not ScheduledDeletion.objects.filter(
            model_name="Organization", object_id=org.id
        ).exists()

    def test_relay_pii_config(self):
        value = '{"applications": {"freeform": []}}'
        response = self.get_success_response(self.organization.slug, **{"relayPiiConfig": value})

        assert self.organization.get_option("sentry:relay_pii_config") == value
        assert response.data["relayPiiConfig"] == value


class OrganizationDeleteTest(OrganizationDetailsTestBase):
    method = "delete"

    def test_can_remove_as_owner(self):
        owners = self.organization.get_owners()
        assert len(owners) > 0

        with self.tasks():
            self.get_success_response(self.organization.slug, status_code=202)

        org = Organization.objects.get(id=self.organization.id)

        assert org.status == OrganizationStatus.PENDING_DELETION

        deleted_org = DeletedOrganization.objects.get(slug=org.slug)
        self.assert_valid_deleted_log(deleted_org, org)

        schedule = ScheduledDeletion.objects.get(object_id=org.id, model_name="Organization")
        # Delay is 24 hours but to avoid wobbling microseconds we compare with 23 hours.
        assert schedule.date_scheduled >= timezone.now() + timedelta(hours=23)

        # Make sure we've emailed all owners
        assert len(mail.outbox) == len(owners)
        owner_emails = {o.email for o in owners}
        for msg in mail.outbox:
            assert "Deletion" in msg.subject
            assert len(msg.to) == 1
            owner_emails.remove(msg.to[0])
        # No owners should be remaining
        assert len(owner_emails) == 0

    def test_cannot_remove_as_admin(self):
        org = self.create_organization(owner=self.user)
        user = self.create_user(email="foo@example.com", is_superuser=False)
        self.create_member(organization=org, user=user, role="admin")

        self.login_as(user)

        self.get_error_response(org.slug, status_code=403)

    def test_cannot_remove_default(self):
        Organization.objects.all().delete()
        org = self.create_organization(owner=self.user)

        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            self.get_error_response(org.slug, status_code=400)

    def test_redo_deletion(self):
        # Orgs can delete, undelete, delete within a day
        org = self.create_organization(owner=self.user)
        ScheduledDeletion.schedule(org, days=1)

        self.get_success_response(org.slug)

        org = Organization.objects.get(id=org.id)
        assert org.status == OrganizationStatus.PENDING_DELETION

        assert ScheduledDeletion.objects.filter(
            object_id=org.id, model_name="Organization"
        ).exists()


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
        TotpInterface().enroll(self.has_2fa)
        self.create_member(organization=self.organization, user=self.has_2fa, role="manager")
        assert Authenticator.objects.user_has_2fa(self.has_2fa)

    def assert_2fa_email_equal(self, outbox, expected):
        assert len(outbox) == len(expected)
        assert sorted(email.to[0] for email in outbox) == sorted(expected)

    def test_cannot_enforce_2fa_without_2fa_enabled(self):
        assert not Authenticator.objects.user_has_2fa(self.owner)
        self.assert_cannot_enable_org_2fa(self.organization, self.owner, 400, ERR_NO_2FA)

    def test_cannot_enforce_2fa_with_sso_enabled(self):
        self.auth_provider = AuthProvider.objects.create(
            provider="github", organization=self.organization
        )
        # bypass SSO login
        self.auth_provider.flags.allow_unlinked = True
        self.auth_provider.save()

        self.assert_cannot_enable_org_2fa(self.organization, self.has_2fa, 400, ERR_SSO_ENABLED)

    def test_cannot_enforce_2fa_with_saml_enabled(self):
        self.auth_provider = AuthProvider.objects.create(
            provider="saml2", organization=self.organization
        )
        # bypass SSO login
        self.auth_provider.flags.allow_unlinked = True
        self.auth_provider.save()

        self.assert_cannot_enable_org_2fa(self.organization, self.has_2fa, 400, ERR_SSO_ENABLED)

    def test_owner_can_set_2fa_single_member(self):
        org = self.create_organization(owner=self.owner)
        TotpInterface().enroll(self.owner)
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.assert_can_enable_org_2fa(org, self.owner)
        assert len(mail.outbox) == 0

    def test_manager_can_set_2fa(self):
        org = self.create_organization(owner=self.owner)
        self.create_member(organization=org, user=self.manager, role="manager")

        self.assert_cannot_enable_org_2fa(org, self.manager, 400)
        TotpInterface().enroll(self.manager)
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.assert_can_enable_org_2fa(org, self.manager)
        self.assert_2fa_email_equal(mail.outbox, [self.owner.email])

    def test_members_cannot_set_2fa(self):
        self.assert_cannot_enable_org_2fa(self.organization, self.org_user, 403)
        TotpInterface().enroll(self.org_user)
        self.assert_cannot_enable_org_2fa(self.organization, self.org_user, 403)

    def test_owner_can_set_org_2fa(self):
        org = self.create_organization(owner=self.owner)
        TotpInterface().enroll(self.owner)
        user_emails_without_2fa = self.add_2fa_users_to_org(org)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.assert_can_enable_org_2fa(org, self.owner)
        self.assert_2fa_email_equal(mail.outbox, user_emails_without_2fa)

        mail.outbox = []
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            response = self.api_disable_org_2fa(org, self.owner)

        assert response.status_code == 200
        assert not Organization.objects.get(id=org.id).flags.require_2fa
        assert len(mail.outbox) == 0

    def test_preexisting_members_must_enable_2fa(self):
        self.login_as(self.no_2fa_user)
        self.get_error_response(self.org_2fa.slug, status_code=401)

        TotpInterface().enroll(self.no_2fa_user)
        self.get_success_response(self.org_2fa.slug)

    def test_new_member_must_enable_2fa(self):
        new_user = self.create_user()
        self.create_member(organization=self.org_2fa, user=new_user, role="member")
        self.login_as(new_user)
        self.get_error_response(self.org_2fa.slug, status_code=401)

        TotpInterface().enroll(new_user)
        self.get_success_response(self.org_2fa.slug)

    def test_member_disable_all_2fa_blocked(self):
        TotpInterface().enroll(self.no_2fa_user)
        self.login_as(self.no_2fa_user)

        self.get_success_response(self.org_2fa.slug)

        Authenticator.objects.get(user=self.no_2fa_user).delete()
        self.get_error_response(self.org_2fa.slug, status_code=401)

    def test_superuser_can_access_org_details(self):
        user = self.create_user(is_superuser=True)
        self.login_as(user, superuser=True)
        self.get_success_response(self.org_2fa.slug)


from sentry.api.endpoints.organization_details import TrustedRelaySerializer


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
