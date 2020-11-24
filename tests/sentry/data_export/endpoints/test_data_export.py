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

    def setUp(self):
        self.user = self.create_user("user1@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.login_as(user=self.user)
        self.issue_payload = {
            "query_type": ExportQueryType.ISSUES_BY_TAG_STR,
            "query_info": {"env": "test", "project": [self.project.id]},
        }
        self.discover_payload = {
            "query_type": ExportQueryType.DISCOVER_STR,
            "query_info": {"field": ["id"], "query": "", "project": [self.project.id]},
        }

    def test_authorization(self):
        with self.feature({"organizations:discover-query": False}):
            # Without the discover-query feature, the endpoint should 404
            self.get_valid_response(self.org.slug, status_code=404, **self.issue_payload)
        # Without project permissions, the endpoint should 403
        modified_payload = self.issue_payload.copy()
        modified_payload["query_info"] = {"project": -5}
        with self.feature("organizations:discover-query"):
            self.get_valid_response(self.org.slug, status_code=403, **modified_payload)
        # With the right permissions, the endpoint should 201
        with self.feature("organizations:discover-query"):
            self.get_valid_response(self.org.slug, status_code=201, **self.issue_payload)

    def test_new_export(self):
        """
        Ensures that a request to this endpoint returns a 201 status code
        and an appropriate response object
        """
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.org.slug, status_code=201, **self.issue_payload)
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
            "query": {
                "type": self.issue_payload["query_type"],
                "info": self.issue_payload["query_info"],
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
        with self.feature("organizations:discover-query"):
            response1 = self.get_response(self.org.slug, **self.issue_payload)
        data_export = ExportedData.objects.get(id=response1.data["id"])
        with self.feature("organizations:discover-query"):
            response2 = self.get_valid_response(self.org.slug, **self.issue_payload)
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
        payload = self.discover_payload.copy()
        payload["query_info"].update({"field": "id"})
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.org.slug, status_code=201, **payload)
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
        payload = self.discover_payload.copy()
        payload["query_info"].update({"field": ["id"] * (MAX_FIELDS + 1)})
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.org.slug, status_code=400, **payload)
        assert response.data == {
            "non_field_errors": [
                "You can export up to 20 fields at a time. Please delete some and try again."
            ]
        }

    @freeze_time("2020-05-19 14:00:00")
    def test_converts_stats_period(self):
        """
        Ensures that statsPeriod is converted to start/end.
        """
        payload = self.discover_payload.copy()
        payload["query_info"].update({"statsPeriod": "24h"})
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.org.slug, status_code=201, **payload)
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
        payload = self.discover_payload.copy()
        payload["query_info"].update({"statsPeriodStart": "1w", "statsPeriodEnd": "5d"})
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.org.slug, status_code=201, **payload)
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
        payload = self.discover_payload.copy()
        payload["query_info"].update({"start": "2020-05-18T14:00:00", "end": "2020-05-19T14:00:00"})
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.org.slug, status_code=201, **payload)
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
        payload = self.discover_payload.copy()
        payload["query_info"].update({"query": "foo:"})
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.org.slug, status_code=400, **payload)
        assert response.data == {"non_field_errors": ["Empty string after 'foo:'"]}
