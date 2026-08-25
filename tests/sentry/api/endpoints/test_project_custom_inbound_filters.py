from datetime import datetime
from unittest.mock import patch

from django.urls import reverse

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
            data_type="all",
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
            "dataType": "all",
            "conditions": [{"type": "release", "value": ["1.*"]}],
        }
        assert second_data == {
            "id": str(second_filter.id),
            "name": "Error filter",
            "active": False,
            "dataType": "error",
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
                dataType="error",
                conditions=conditions,
                status_code=201,
            )

        custom_filter = CustomInboundFilter.objects.get(id=response.data["id"])
        assert custom_filter.project_id == self.project.id
        assert custom_filter.name == "Important errors"
        assert custom_filter.active is False
        assert custom_filter.data_type == "error"
        assert custom_filter.conditions == conditions

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_entry = AuditLogEntry.objects.get(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            )
        assert audit_entry.target_object == custom_filter.id
        assert audit_entry.data["operation"] == "add"
        assert audit_entry.data["filter_name"] == "Important errors"
        assert audit_entry.data["data_type"] == "error"
        assert audit_entry.data["conditions"] == conditions

    def test_post_without_name(self) -> None:
        conditions = [{"type": "release", "value": ["1.*"]}]

        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                dataType="error",
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

    def test_rejects_condition_the_data_type_does_not_carry(self) -> None:
        cases = [
            (
                "error",
                [
                    {"type": "error_message", "value": ["TypeError*"]},
                    {"type": "log_message", "value": ["Rate limit*"]},
                ],
                "A filter on error data cannot use the log_message condition. "
                "It accepts error_type, error_message, release.",
            ),
            (
                "log",
                [
                    {"type": "error_type", "value": ["TypeError"]},
                    {"type": "log_message", "value": ["Rate limit*"]},
                ],
                "A filter on log data cannot use the error_type condition. "
                "It accepts log_message, release.",
            ),
            (
                "span",
                [
                    {"type": "release", "value": ["1.*"]},
                    {"type": "metric_name", "value": ["counter.*"]},
                ],
                "A filter on span data cannot use the metric_name condition. It accepts release.",
            ),
            (
                "all",
                [
                    {"type": "release", "value": ["1.*"]},
                    {"type": "error_message", "value": ["TypeError*"]},
                ],
                "A filter on all data cannot use the error_message condition. It accepts release.",
            ),
        ]

        for data_type, conditions, expected in cases:
            with self.feature([*self.features, "organizations:ourlogs-ingestion"]):
                response = self.get_error_response(
                    self.organization.slug,
                    self.project.slug,
                    method="post",
                    name="Mixed data types",
                    dataType=data_type,
                    conditions=conditions,
                )

            assert str(response.data["conditions"][0]) == expected

    def test_post_catch_all(self) -> None:
        conditions = [{"type": "release", "value": ["1.*"]}]

        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Bad release, every data type",
                dataType="all",
                conditions=conditions,
                status_code=201,
            )

        custom_filter = CustomInboundFilter.objects.get(id=response.data["id"])
        assert response.data["dataType"] == "all"
        assert custom_filter.data_type == "all"

    def test_post_span(self) -> None:
        """Relay ingests spans for every organization, so a span filter needs no feature."""
        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Spans from a bad release",
                dataType="span",
                conditions=[{"type": "release", "value": ["1.*"]}],
                status_code=201,
            )

        custom_filter = CustomInboundFilter.objects.get(id=response.data["id"])
        assert response.data["dataType"] == "span"
        assert custom_filter.data_type == "span"

    def test_catch_all_needs_no_ingestion_feature(self) -> None:
        """The catch-all filters whichever data types the organization ingests."""
        with self.feature(self.features):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Bad release",
                dataType="all",
                conditions=[{"type": "release", "value": ["1.*"]}],
                status_code=201,
            )

    def test_rejects_unknown_data_type(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                dataType="replay",
                conditions=[{"type": "release", "value": ["1.*"]}],
            )

        assert '"replay" is not a valid choice.' in str(response.data["dataType"][0])

    def test_rejects_missing_data_type(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                conditions=[{"type": "release", "value": ["1.*"]}],
            )

        assert str(response.data["dataType"][0]) == "This field is required."

    def test_allows_error_type_with_error_message(self) -> None:
        conditions = [
            {"type": "error_type", "value": ["TypeError"]},
            {"type": "error_message", "value": ["*undefined*"]},
        ]

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                method="post",
                name="Type and message",
                dataType="error",
                conditions=conditions,
                status_code=201,
            )

        custom_filter = CustomInboundFilter.objects.get(id=response.data["id"])
        assert custom_filter.conditions == conditions

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
                dataType="error",
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
                dataType="error",
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
                dataType="error",
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
                dataType="error",
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
                dataType="error",
                conditions=[{"type": "release", "value": ["1.*"]}],
            )

        assert "at most 2" in response.data["detail"]
        assert CustomInboundFilter.objects.filter(project_id=self.project.id).count() == 2

    def test_rejects_data_type_without_required_ingestion_feature(self) -> None:
        cases = [
            ("log", "log_message", ["Rate limit*"], "Log filters are not enabled"),
            ("metric", "metric_name", ["counter.*"], "Metric filters are not enabled"),
        ]
        for data_type, condition_type, value, expected in cases:
            with self.feature(self.features):
                response = self.get_error_response(
                    self.organization.slug,
                    self.project.slug,
                    method="post",
                    dataType=data_type,
                    conditions=[{"type": condition_type, "value": value}],
                )
            assert expected in str(response.data["dataType"][0])


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
        assert response.data["dataType"] == "error"
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

    def test_put_name_only_change_skips_project_config_invalidation(self) -> None:
        with (
            self.feature(self.features),
            outbox_runner(),
            patch(
                "sentry.api.endpoints.project_custom_inbound_filters.schedule_invalidate_project_config"
            ) as mock_invalidate,
        ):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                name="Renamed filter",
            )

        mock_invalidate.assert_not_called()

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

    def test_put_validates_new_conditions_against_stored_data_type(self) -> None:
        """A partial update sending conditions alone keeps the stored data type."""
        with self.feature([*self.features, "organizations:ourlogs-ingestion"]):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                conditions=[{"type": "log_message", "value": ["Rate limit*"]}],
            )

        assert (
            str(response.data["conditions"][0])
            == "A filter on error data cannot use the log_message condition. "
            "It accepts error_type, error_message, release."
        )

    def test_put_to_catch_all(self) -> None:
        with self.feature(self.features), outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                dataType="all",
            )

        self.custom_filter.refresh_from_db()
        assert response.data["dataType"] == "all"
        assert self.custom_filter.data_type == "all"

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_entry = AuditLogEntry.objects.get(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            )
        assert audit_entry.data["changes"] == {"data_type": {"old": "error", "new": "all"}}

    def test_put_widening_data_type_and_conditions_together(self) -> None:
        """A data type and the conditions it allows are validated as one update."""
        with self.feature(self.features), outbox_runner():
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.custom_filter.id,
                dataType="all",
                conditions=[{"type": "release", "value": ["2.*"]}],
            )

        self.custom_filter.refresh_from_db()
        assert self.custom_filter.data_type == "all"
        assert self.custom_filter.conditions == [{"type": "release", "value": ["2.*"]}]

    def test_put_rejects_data_type_the_stored_conditions_do_not_fit(self) -> None:
        """Widening alone would strand conditions the new data type cannot read."""
        error_filter = self.create_project_custom_inbound_filter(
            project=self.project,
            name="Error filter",
            conditions=[{"type": "error_message", "value": ["TypeError*"]}],
        )

        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                error_filter.id,
                dataType="all",
            )

        assert (
            str(response.data["conditions"][0])
            == "A filter on all data cannot use the error_message condition. "
            "It accepts release."
        )
        error_filter.refresh_from_db()
        assert error_filter.data_type == "error"

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


class CustomInboundFilterProjectConfigInvalidationTest(APITestCase):
    features = ["organizations:inbound-filters-v2", "projects:custom-inbound-filters"]

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.custom_filter = self.create_project_custom_inbound_filter(project=self.project)
        self.login_as(user=self.user)

    def test_write_methods_invalidate_project_config(self) -> None:
        list_url = reverse(
            "sentry-api-0-project-custom-inbound-filters",
            args=[self.organization.slug, self.project.slug],
        )
        details_url = reverse(
            "sentry-api-0-project-custom-inbound-filter-details",
            args=[self.organization.slug, self.project.slug, self.custom_filter.id],
        )
        cases = [
            (
                "post",
                list_url,
                {"dataType": "all", "conditions": [{"type": "release", "value": ["1.*"]}]},
                201,
            ),
            ("put", details_url, {"active": False}, 200),
            ("delete", details_url, {}, 204),
        ]

        for method, url, payload, status_code in cases:
            with (
                self.feature(self.features),
                outbox_runner(),
                patch(
                    "sentry.api.endpoints.project_custom_inbound_filters.schedule_invalidate_project_config"
                ) as mock_invalidate,
            ):
                response = getattr(self.client, method)(url, payload, format="json")

            assert response.status_code == status_code, (method, response.data)
            mock_invalidate.assert_called_once_with(
                project_id=self.project.id, trigger="custom_inbound_filters"
            )
