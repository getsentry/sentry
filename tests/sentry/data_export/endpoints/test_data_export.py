from __future__ import annotations

from typing import Any

from sentry.data_export.base import ExportQueryType, ExportStatus
from sentry.data_export.models import ExportedData
from sentry.search.utils import parse_datetime_string
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.snuba import MAX_FIELDS


class DataExportTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export"
    method = "post"

    def setUp(self):
        self.user = self.create_user("user1@example.com")
        self.org = self.create_organization(name="Test")
        self.team = self.create_team(organization=self.org, name="Data Export Team")
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Data Export Proj"
        )
        self.create_member(user=self.user, organization=self.org, teams=[self.team])
        self.login_as(user=self.user)

    def make_payload(self, payload_type, extras=None, overwrite=False):
        payload: dict[str, Any] = {}
        if payload_type == "issue":
            payload = {
                "query_type": ExportQueryType.ISSUES_BY_TAG_STR,
                "query_info": {"env": "test", "project": [self.project.id]},
            }
        elif payload_type == "discover":
            payload = {
                "query_type": ExportQueryType.DISCOVER_STR,
                "query_info": {"field": ["id"], "query": "", "project": [self.project.id]},
            }
        if extras is not None:
            if overwrite:
                payload["query_info"] = extras
            else:
                payload["query_info"].update(extras)
        return payload

    def test_authorization(self):
        payload = self.make_payload("issue")

        # Without the discover-query feature, the endpoint should 404
        with self.feature({"organizations:discover-query": False}):
            self.get_error_response(self.org.slug, status_code=404, **payload)

        # With the right permissions, the endpoint should 201
        with self.feature("organizations:discover-query"):
            self.get_success_response(self.org.slug, status_code=201, **payload)

        modified_payload = self.make_payload("issue", {"project": -5}, overwrite=True)

        # Without project permissions, the endpoint should 403
        with self.feature("organizations:discover-query"):
            self.get_error_response(self.org.slug, status_code=403, **modified_payload)

    def test_new_export(self):
        """
        Ensures that a request to this endpoint returns a 201 status code
        and an appropriate response object
        """
        payload = self.make_payload("issue")
        with self.feature("organizations:discover-query"):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        assert response.data == {
            "id": data_export.id,
            "user": {
                "id": str(self.user.id),
                "email": self.user.email,
                "username": self.user.username,
            },
            "dateCreated": data_export.date_added,
            "dateFinished": None,
            "dateExpired": None,
            "query": {
                "type": payload["query_type"],
                "info": payload["query_info"],
            },
            "status": ExportStatus.Early,
            "checksum": None,
            "fileName": None,
        }

    def test_progress_export(self):
        """
        Checks to make sure that identical requests (same payload, organization, user)
        are routed to the same ExportedData object, with a 200 status code
        """
        payload = self.make_payload("issue")
        with self.feature("organizations:discover-query"):
            response1 = self.get_response(self.org.slug, **payload)
        data_export = ExportedData.objects.get(id=response1.data["id"])
        with self.feature("organizations:discover-query"):
            response2 = self.get_success_response(self.org.slug, **payload)
        assert response2.data == {
            "id": data_export.id,
            "user": {
                "id": str(self.user.id),
                "email": self.user.email,
                "username": self.user.username,
            },
            "dateCreated": data_export.date_added,
            "dateFinished": data_export.date_finished,
            "dateExpired": data_export.date_expired,
            "query": {
                "type": ExportQueryType.as_str(data_export.query_type),
                "info": data_export.query_info,
            },
            "status": data_export.status,
            "checksum": None,
            "fileName": None,
        }

    def test_fields_are_lists(self):
        """
        Ensures that if a single field is passed, we convert it to a list before making
        a snuba query.
        """
        payload = self.make_payload("discover", {"field": "id"})
        with self.feature("organizations:discover-query"):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        # because we passed a single string as the field, we should convert it into a list
        # this happens when the user selects only a single field and it results in a string
        # rather than a list of strings
        assert data_export.query_info["field"] == ["id"]

    def test_export_too_many_fields(self):
        """
        Ensures that if too many fields are requested, returns a 400 status code with the
        corresponding error message.
        """
        payload = self.make_payload("discover", {"field": ["id"] * (MAX_FIELDS + 1)})
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {
            "non_field_errors": [
                "You can export up to 20 fields at a time. Please delete some and try again."
            ]
        }

    def test_export_no_fields(self):
        """
        Ensures that if no fields are requested, returns a 400 status code with
        the corresponding error message.
        """
        payload = self.make_payload("discover", {"field": []})
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {"non_field_errors": ["at least one field is required to export"]}

    def test_discover_without_query(self):
        """
        Ensurse that we handle export requests without a query, and return a 400 status code
        """
        payload = self.make_payload("discover", {"field": ["id"]}, overwrite=True)
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {
            "non_field_errors": [
                "query is a required to export, please pass an empty string if you don't want to set one"
            ]
        }

    def test_export_invalid_fields(self):
        """
        Ensures that if a field is requested with the wrong parameters, the corresponding
        error message is returned
        """
        payload = self.make_payload("discover", {"field": ["min()"]})
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {
            "non_field_errors": ["min: expected 1 argument(s) but got 0 argument(s)"]
        }

    @freeze_time("2020-02-27 12:07:37")
    def test_export_invalid_date_params(self):
        """
        Ensures that if an invalidate date parameter is specified, returns a 400 status code
        with the corresponding error message.
        """
        payload = self.make_payload("discover", {"statsPeriod": "shrug"})
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {"non_field_errors": ["Invalid statsPeriod: 'shrug'"]}

        payload = self.make_payload(
            "discover",
            {
                "start": "2021-02-27T12:07:37",
                "end": "shrug",
            },
        )
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {"non_field_errors": ["shrug is not a valid ISO8601 date query"]}

        payload = self.make_payload(
            "discover",
            {
                "start": "shrug",
                "end": "2021-02-27T12:07:37",
            },
        )
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {"non_field_errors": ["shrug is not a valid ISO8601 date query"]}

    @freeze_time("2020-05-19 14:00:00")
    def test_converts_stats_period(self):
        """
        Ensures that statsPeriod is converted to start/end.
        """
        payload = self.make_payload("discover", {"statsPeriod": "24h"})
        with self.feature("organizations:discover-query"):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert parse_datetime_string(query_info["start"]) == parse_datetime_string(
            "2020-05-18T14:00:00"
        )
        assert parse_datetime_string(query_info["end"]) == parse_datetime_string(
            "2020-05-19T14:00:00"
        )
        assert "statsPeriod" not in query_info
        assert "statsPeriodStart" not in query_info
        assert "statsPeriodSEnd" not in query_info

    @freeze_time("2020-05-19 14:00:00")
    def test_converts_stats_period_start_end(self):
        """
        Ensures that statsPeriodStart and statsPeriodEnd is converted to start/end.
        """
        payload = self.make_payload("discover", {"statsPeriodStart": "1w", "statsPeriodEnd": "5d"})
        with self.feature("organizations:discover-query"):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert parse_datetime_string(query_info["start"]) == parse_datetime_string(
            "2020-05-12T14:00:00"
        )
        assert parse_datetime_string(query_info["end"]) == parse_datetime_string(
            "2020-05-14T14:00:00"
        )
        assert "statsPeriod" not in query_info
        assert "statsPeriodStart" not in query_info
        assert "statsPeriodSEnd" not in query_info

    def test_preserves_start_end(self):
        """
        Ensures that start/end is preserved
        """
        payload = self.make_payload(
            "discover", {"start": "2020-05-18T14:00:00", "end": "2020-05-19T14:00:00"}
        )
        with self.feature("organizations:discover-query"):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert parse_datetime_string(query_info["start"]) == parse_datetime_string(
            "2020-05-18T14:00:00"
        )
        assert parse_datetime_string(query_info["end"]) == parse_datetime_string(
            "2020-05-19T14:00:00"
        )
        assert "statsPeriod" not in query_info
        assert "statsPeriodStart" not in query_info
        assert "statsPeriodSEnd" not in query_info

    def test_validates_query_info(self):
        """
        Ensures that bad queries are rejected.
        """
        payload = self.make_payload("discover", {"query": "foo:"})
        with self.feature("organizations:discover-query"):
            response = self.get_error_response(self.org.slug, status_code=400, **payload)
        assert response.data == {"non_field_errors": ["Empty string after 'foo:'"]}

    @freeze_time("2020-05-19 14:00:00")
    def test_export_resolves_empty_project(self):
        """
        Ensures that a request to this endpoint returns a 201 if projects
        is an empty list.
        """
        payload = self.make_payload(
            "discover",
            {"project": [], "start": "2020-05-18T14:00:00", "end": "2020-05-19T14:00:00"},
        )
        with self.feature("organizations:discover-query"):
            self.get_success_response(self.org.slug, status_code=201, **payload)

        payload = self.make_payload(
            "issue", {"project": None, "start": "2020-05-18T14:00:00", "end": "2020-05-19T14:00:00"}
        )
        with self.feature("organizations:discover-query"):
            self.get_success_response(self.org.slug, status_code=201, **payload)

    def test_equations(self):
        """
        Ensures that equations are handled
        """
        payload = self.make_payload("discover", {"field": ["equation|count() / 2", "count()"]})
        with self.feature(["organizations:discover-query"]):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert query_info["field"] == ["count()"]
        assert query_info["equations"] == ["count() / 2"]

    def test_valid_dataset(self):
        """
        Ensures that equations are handled
        """
        payload = self.make_payload(
            "discover", {"field": ["title", "count()"], "dataset": "issuePlatform"}
        )
        with self.feature(["organizations:discover-query"]):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert query_info["field"] == ["title", "count()"]
        assert query_info["dataset"] == "issuePlatform"

    def test_valid_dataset_transactions(self):
        """
        Tests that the transactions dataset is valid
        """
        payload = self.make_payload(
            "discover", {"field": ["title", "count()"], "dataset": "transactions"}
        )
        with self.feature(["organizations:discover-query"]):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert query_info["field"] == ["title", "count()"]
        assert query_info["dataset"] == "transactions"

    def test_valid_dataset_errors(self):
        """
        Tests that the errors dataset is valid
        """
        payload = self.make_payload(
            "discover", {"field": ["title", "count()"], "dataset": "errors"}
        )
        with self.feature(["organizations:discover-query"]):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert query_info["field"] == ["title", "count()"]
        assert query_info["dataset"] == "errors"

    def test_invalid_dataset(self):
        """
        Ensures that equations are handled
        """
        payload = self.make_payload(
            "discover", {"field": ["title", "count()"], "dataset": "somefakedataset"}
        )
        with self.feature(["organizations:discover-query"]):
            response = self.get_response(self.org.slug, **payload)
        assert response.status_code == 400

    def test_is_query(self):
        """
        is queries should work with the errors dataset
        """
        payload = self.make_payload(
            "discover",
            {
                "field": ["title", "project", "user.display", "timestamp"],
                "dataset": "errors",
                "query": "is:unresolved",
                "per_page": 50,
                "sort": "-timestamp",
            },
        )
        with self.feature(["organizations:discover-query"]):
            response = self.get_success_response(self.org.slug, status_code=201, **payload)
        data_export = ExportedData.objects.get(id=response.data["id"])
        query_info = data_export.query_info
        assert query_info["field"] == ["title", "project", "user.display", "timestamp"]
        assert query_info["dataset"] == "errors"
        assert query_info["query"] == "is:unresolved"
