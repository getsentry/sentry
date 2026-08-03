from datetime import datetime
from unittest.mock import patch

from sentry import audit_log
from sentry.api.endpoints.project_custom_inbound_filters import MAX_CONDITIONS_PER_FILTER
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.custominboundfilter import CustomInboundFilter
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class CustomInboundFiltersTest(APITestCase):
    endpoint = "sentry-api-0-project-custom-inbound-filters"
    features = ["organizations:inbound-filters-v2", "projects:custom-inbound-filters"]

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.login_as(user=self.user)

    def test_get(self) -> None:
        first_filter = self.create_project_custom_inbound_filter(
            project=self.project,
            name="Release filter",
            conditions=[{"type": "release", "value": ["1.*"]}],
        )
        second_filter = self.create_project_custom_inbound_filter(
            project=self.project,
            name="Error filter",
            active=False,
            conditions=[{"type": "error_message", "value": ["TypeError*"]}],
        )

        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, self.project.slug)

        first_data, second_data = response.data
        assert datetime.fromisoformat(first_data.pop("dateCreated")) == first_filter.date_added
        assert datetime.fromisoformat(first_data.pop("dateUpdated")) == first_filter.date_updated
        assert datetime.fromisoformat(second_data.pop("dateCreated")) == second_filter.date_added
        assert datetime.fromisoformat(second_data.pop("dateUpdated")) == second_filter.date_updated

        assert first_data == {
            "id": str(first_filter.id),
            "name": "Release filter",
            "active": True,
            "conditions": [{"type": "release", "value": ["1.*"]}],
        }
        assert second_data == {
            "id": str(second_filter.id),
            "name": "Error filter",
            "active": False,
            "conditions": [{"type": "error_message", "value": ["TypeError*"]}],
        }

    def test_post(self) -> None:
        conditions = [
            {"type": "release", "value": ["1.*"]},
            {"type": "error_message", "value": ["TypeError*"]},
        ]

        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Important errors",
                active=False,
                conditions=conditions,
                status_code=201,
            )

        custom_filter = CustomInboundFilter.objects.get(id=response.data["id"])
        assert custom_filter.project_id == self.project.id
        assert custom_filter.name == "Important errors"
        assert custom_filter.active is False
        assert custom_filter.conditions == conditions

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_entry = AuditLogEntry.objects.get(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            )
        assert audit_entry.target_object == custom_filter.id
        assert audit_entry.data["operation"] == "add"
        assert audit_entry.data["filter_name"] == "Important errors"
        assert audit_entry.data["conditions"] == conditions

    def test_post_without_name(self) -> None:
        conditions = [{"type": "release", "value": ["1.*"]}]

        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                conditions=conditions,
                status_code=201,
            )

        custom_filter = CustomInboundFilter.objects.get(id=response.data["id"])
        assert response.data["name"] is None
        assert custom_filter.name is None

    def test_without_inbound_filters_v2_feature(self) -> None:
        with self.feature(["projects:custom-inbound-filters"]):
            self.get_error_response(self.organization.slug, self.project.slug, status_code=404)

    def test_without_custom_inbound_filters_plan_feature(self) -> None:
        with self.feature(["organizations:inbound-filters-v2"]):
            response = self.get_error_response(
                self.organization.slug, self.project.slug, status_code=400
            )

        assert response.data["detail"] == "You do not have that feature enabled"

    def test_rejects_incompatible_primary_conditions(self) -> None:
        conditions = [
            {"type": "error_message", "value": ["TypeError*"]},
            {"type": "log_message", "value": ["Rate limit*"]},
        ]

        with self.feature([*self.features, "organizations:ourlogs-ingestion"]):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Mixed data types",
                conditions=conditions,
            )

        assert (
            str(response.data["conditions"][0])
            == "Only one of error_message, log_message, or metric_name can be used in a filter."
        )

    def test_allows_duplicate_condition_types(self) -> None:
        conditions = [
            {"type": "release", "value": [">2"]},
            {"type": "release", "value": ["<4"]},
        ]

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Release range",
                conditions=conditions,
                status_code=201,
            )

        custom_filter = CustomInboundFilter.objects.get(id=response.data["id"])
        assert custom_filter.conditions == conditions

    def test_rejects_empty_conditions_and_values(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="",
                conditions=[],
            )

        assert (
            str(response.data["conditions"]["non_field_errors"][0]) == "This list may not be empty."
        )

        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Empty value",
                conditions=[{"type": "release", "value": []}],
            )

        assert str(response.data["conditions"][0]["value"][0]) == "This list may not be empty."

    def test_rejects_too_many_conditions(self) -> None:
        conditions = [
            {"type": "release", "value": [str(i)]} for i in range(MAX_CONDITIONS_PER_FILTER + 1)
        ]

        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                conditions=conditions,
            )

        assert "no more than" in str(response.data["conditions"]["non_field_errors"][0])

    @patch(
        "sentry.api.endpoints.project_custom_inbound_filters.MAX_FILTERS_PER_PROJECT",
        2,
    )
    def test_rejects_create_past_project_filter_cap(self) -> None:
        for _ in range(2):
            self.create_project_custom_inbound_filter(project=self.project)

        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                conditions=[{"type": "release", "value": ["1.*"]}],
            )

        assert "at most 2" in response.data["detail"]
        assert CustomInboundFilter.objects.filter(project_id=self.project.id).count() == 2

    def test_rejects_conditions_without_required_ingestion_feature(self) -> None:
        cases = [
            ("log_message", ["Rate limit*"], "Log message filters are not enabled"),
            ("metric_name", ["counter.*"], "Metric name filters are not enabled"),
        ]
        for condition_type, value, expected in cases:
            with self.feature(self.features):
                response = self.get_error_response(
                    self.organization.slug,
                    self.project.slug,
                    method="post",
                    conditions=[{"type": condition_type, "value": value}],
                )
            assert expected in str(response.data["conditions"][0])


class CustomInboundFilterDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-custom-inbound-filter-details"
    method = "put"
    features = ["organizations:inbound-filters-v2", "projects:custom-inbound-filters"]

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.custom_filter = self.create_project_custom_inbound_filter(
            project=self.project,
            name="Original filter",
            conditions=[{"type": "release", "value": ["1.*"]}],
        )
        self.login_as(user=self.user)

    def test_get(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                method="get",
            )

        assert response.data["id"] == str(self.custom_filter.id)
        assert response.data["name"] == "Original filter"
        assert response.data["active"] is True
        assert response.data["conditions"] == [{"type": "release", "value": ["1.*"]}]

    def test_put(self) -> None:
        new_conditions = [{"type": "error_message", "value": ["TypeError*"]}]

        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                name="Renamed filter",
                active=False,
                conditions=new_conditions,
            )

        self.custom_filter.refresh_from_db()
        assert response.data["name"] == "Renamed filter"
        assert response.data["active"] is False
        assert response.data["conditions"] == new_conditions
        assert self.custom_filter.name == "Renamed filter"
        assert self.custom_filter.active is False
        assert self.custom_filter.conditions == new_conditions

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_entry = AuditLogEntry.objects.get(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            )
        assert audit_entry.target_object == self.custom_filter.id
        assert audit_entry.data["operation"] == "edit"
        assert audit_entry.data["filter_name"] == "Renamed filter"
        assert audit_entry.data["changes"] == {
            "name": {"old": "Original filter", "new": "Renamed filter"},
            "active": {"old": True, "new": False},
            "conditions": {
                "old": [{"type": "release", "value": ["1.*"]}],
                "new": new_conditions,
            },
        }

    def test_put_partial_active_only(self) -> None:
        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                active=False,
            )

        self.custom_filter.refresh_from_db()
        assert response.data["active"] is False
        assert self.custom_filter.active is False
        assert self.custom_filter.name == "Original filter"
        assert self.custom_filter.conditions == [{"type": "release", "value": ["1.*"]}]

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_entry = AuditLogEntry.objects.get(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            )
        assert audit_entry.data["operation"] == "edit"
        assert audit_entry.data["changes"] == {"active": {"old": True, "new": False}}

    def test_put_no_changes_skips_audit_log(self) -> None:
        with self.feature(self.features), outbox_runner():
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                name="Original filter",
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            ).exists()

    def test_put_rejects_incompatible_primary_conditions(self) -> None:
        conditions = [
            {"type": "error_message", "value": ["TypeError*"]},
            {"type": "log_message", "value": ["Rate limit*"]},
        ]

        with self.feature([*self.features, "organizations:ourlogs-ingestion"]):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                conditions=conditions,
            )

        assert (
            str(response.data["conditions"][0])
            == "Only one of error_message, log_message, or metric_name can be used in a filter."
        )

    def test_delete(self) -> None:
        with self.feature(self.features), outbox_runner():
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                method="delete",
                status_code=204,
            )

        assert not CustomInboundFilter.objects.filter(id=self.custom_filter.id).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_entry = AuditLogEntry.objects.get(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            )
        assert audit_entry.target_object == self.custom_filter.id
        assert audit_entry.data["operation"] == "remove"
        assert audit_entry.data["filter_name"] == "Original filter"

    def test_returns_404_for_missing_filter(self) -> None:
        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                "1234567890",
                method="get",
                status_code=404,
            )

    def test_scopes_lookup_to_project(self) -> None:
        other_project = self.create_project(organization=self.organization, teams=[self.team])
        other_filter = self.create_project_custom_inbound_filter(project=other_project)

        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                other_filter.id,
                method="get",
                status_code=404,
            )

    def test_without_inbound_filters_v2_feature(self) -> None:
        with self.feature(["projects:custom-inbound-filters"]):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                method="get",
                status_code=404,
            )

    def test_without_custom_inbound_filters_plan_feature(self) -> None:
        with self.feature(["organizations:inbound-filters-v2"]):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                method="get",
                status_code=400,
            )

        assert response.data["detail"] == "You do not have that feature enabled"
