from __future__ import absolute_import

import six
from freezegun import freeze_time

from sentry.data_export.base import ExportStatus, ExportQueryType
from sentry.data_export.models import ExportedData
from sentry.search.utils import parse_datetime_string
from sentry.utils.snuba import MAX_FIELDS
from sentry.testutils import APITestCase


class DataExportTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export"
    method = "post"
    payload = {"query_type": ExportQueryType.ISSUES_BY_TAG_STR, "query_info": {"env": "test"}}

    def setUp(self):
        self.user = self.create_user("user1@example.com")
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_authorization(self):
        with self.feature({"organizations:discover-query": False}):
            # Without the discover-query feature, the endpoint should 404
            self.get_valid_response(self.organization.slug, status_code=404, **self.payload)
        # Without project permissions, the endpoint should 403
        modified_payload = {"query_type": self.payload["query_type"], "query_info": {"project": -5}}
        with self.feature("organizations:discover-query"):
            self.get_valid_response(self.organization.slug, status_code=403, **modified_payload)
        # With the right permissions, the endpoint should 201
        discover_payload = {"query_type": "Discover", "query_info": self.payload["query_info"]}
        with self.feature("organizations:discover-query"):
            self.get_valid_response(self.organization.slug, status_code=201, **discover_payload)

    def test_new_export(self):
        """
        Ensures that a request to this endpoint returns a 201 status code
        and an appropriate response object
        """
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(
                self.organization.slug, status_code=201, **self.payload
            )
        data_export = ExportedData.objects.get(id=response.data["id"])
        assert response.data == {
            "id": data_export.id,
            "user": {
                "id": six.text_type(self.user.id),
                "email": self.user.email,
                "username": self.user.username,
            },
            "dateCreated": data_export.date_added,
            "dateFinished": None,
            "dateExpired": None,
            "query": {"type": self.payload["query_type"], "info": self.payload["query_info"]},
            "status": ExportStatus.Early,
            "checksum": None,
            "fileName": None,
        }

    def test_progress_export(self):
        """
        Checks to make sure that identical requests (same payload, organization, user)
        are routed to the same ExportedData object, with a 200 status code
        """
        with self.feature("organizations:discover-query"):
            response1 = self.get_response(self.organization.slug, **self.payload)
        data_export = ExportedData.objects.get(id=response1.data["id"])
        with self.feature("organizations:discover-query"):
            response2 = self.get_valid_response(self.organization.slug, **self.payload)
        assert response2.data == {
            "id": data_export.id,
            "user": {
                "id": six.text_type(self.user.id),
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
        payload = {
            "query_type": ExportQueryType.DISCOVER_STR,
            "query_info": {"env": "test", "field": "id"},
        }
        result_query_info = payload["query_info"].copy()
        result_query_info["field"] = [result_query_info["field"]]
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, status_code=201, **payload)
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
        payload = {
            "query_type": ExportQueryType.DISCOVER_STR,
            "query_info": {"env": "test", "field": ["id"] * (MAX_FIELDS + 1)},
        }
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, status_code=400, **payload)
        assert response.data == {
            "detail": "You can export up to 20 fields at a time. Please delete some and try again."
        }

    @freeze_time("2020-05-19 14:00:00")
    def test_converts_stats_period(self):
        """
        Ensures that statsPeriod is converted to start/end.
        """
        payload = {
            "query_type": ExportQueryType.DISCOVER_STR,
            "query_info": {"env": "test", "statsPeriod": "24h"},
        }
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, status_code=201, **payload)
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
        payload = {
            "query_type": ExportQueryType.DISCOVER_STR,
            "query_info": {"env": "test", "statsPeriodStart": "1w", "statsPeriodEnd": "5d"},
        }
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, status_code=201, **payload)
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
        payload = {
            "query_type": ExportQueryType.DISCOVER_STR,
            "query_info": {
                "env": "test",
                "start": "2020-05-18T14:00:00",
                "end": "2020-05-19T14:00:00",
            },
        }
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, status_code=201, **payload)
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
