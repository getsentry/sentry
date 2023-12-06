from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class ProjectFilterDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-filters-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.subfilters = [
            "safari_pre_6",
            "ie11",
            "opera_pre_15",
            "edge_pre_79",
        ]
        self.login_as(user=self.user)

    def test_browser_extensions(self):
        # test enabling
        self.project.update_option("filters:browser-extensions", "0")
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            "browser-extensions",
            active=True,
            status_code=200,
        )

        print(
            self.project.organization,
            self.project.id,
            audit_log.get_event_id("PROJECT_ENABLE"),
            {"state": "browser-extensions"},
        )
        # first_instance = AuditLogEntry.objects.first()
        # print(first_instance)
        # for field in first_instance._meta.fields:
        #     field_name = field.name
        #     field_value = getattr(first_instance, field_name)
        #     print(f"{field_name}: {field_value}")
        print(self.project.id)

        assert response.data["active"] is True
        assert self.project.get_option("filters:browser-extensions") == "1"
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("PROJECT_ENABLE"),
            data={"state": "browser-extensions"},
        )

        # test disabling
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            "browser-extensions",
            active=False,
            status_code=200,
        )

        assert response.data["active"] is False
        assert self.project.get_option("filters:browser-extensions") == "0"
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("PROJECT_DISABLE"),
            data={"state": "browser-extensions"},
        )

    def test_health_check_filter(self):
        # test enabling
        self.project.update_option("filters:filtered-transaction", "0")
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            "filtered-transaction",
            active=True,
            status_code=200,
        )

        assert response.data["active"] is True
        assert self.project.get_option("filters:filtered-transaction") == "1"
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("PROJECT_ENABLE"),
            data={"state": "filtered-transaction"},
        )

        # test disabling
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            "filtered-transaction",
            active=False,
            status_code=200,
        )

        assert response.data["active"] is False
        assert self.project.get_option("filters:filtered-transaction") == "0"
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("PROJECT_DISABLE"),
            data={"state": "filtered-transaction"},
        )

    def test_legacy_browsers(self):
        # test enabling
        assert self.project.get_option("filters:legacy-browsers") == []
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            "legacy-browsers",
            subfilters=self.subfilters,
            status_code=200,
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            print(AuditLogEntry.objects.all())
            entry = AuditLogEntry.objects.first()
        for field in entry._meta.fields:
            field_name = field.name
            field_value = getattr(entry, field_name)
            print(f"{field_name}: {field_value}")

        assert set(response.data["active"]) == set(self.subfilters)
        assert set(self.project.get_option("filters:legacy-browsers")) == set(self.subfilters)

        # Fetch the entry manually because we cannot filter by the subfilters list. The order is
        # randomized because we convert to a set and back.
        with assume_test_silo_mode(SiloMode.CONTROL):
            entry = AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("PROJECT_ENABLE"),
            ).first()
        assert set(entry.data["state"]) == set(self.subfilters)

        # test disabling
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            "legacy-browsers",
            subfilters=[],
            status_code=200,
        )

        assert response.data["active"] == []
        assert self.project.get_option("filters:legacy-browsers") == []

        # Fetch the entry manually because we cannot filter by the subfilters list. The order is
        # randomized because we convert to a set and back.
        with assume_test_silo_mode(SiloMode.CONTROL):
            entry = AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("PROJECT_DISABLE"),
            ).first()
        assert entry.data["state"] == []

    def test_legacy_browsers_subfilters_must_be_list(self):
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "legacy-browsers",
            subfilters=False,
            status_code=400,
        )

        assert str(response.data["subfilters"][0]) == "Please provide a valid list."
