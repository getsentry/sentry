from __future__ import absolute_import

import six

from sentry.models import ExportedData
from sentry.models.exporteddata import ExportStatus
from sentry.testutils import APITestCase


class DataExportTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export"
    method = "post"
    payload = {"query_type": 0, "query_info": {"env": "test"}}

    def setUp(self):
        self.user = self.create_user("user1@example.com")
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_new_export(self):
        """
        Ensures that a request to this endpoint returns a 201 status code
        and an appropriate response object
        """
        with self.feature("organizations:data-export"):
            response = self.get_valid_response(
                self.organization.slug, status_code=201, **self.payload
            )
        data_export = ExportedData.objects.get(id=response.data["id"])
        assert response.data == {
            "id": data_export.id,
            "user": {
                "id": six.binary_type(self.user.id),
                "email": self.user.email,
                "username": self.user.username,
            },
            "dateCreated": data_export.date_added,
            "dateFinished": None,
            "dateExpired": None,
            "query": {"type": self.payload["query_type"], "info": self.payload["query_info"]},
            "status": ExportStatus.Early,
        }

    def test_progress_export(self):
        """
        Checks to make sure that identical requests (same payload, organization, user)
        are routed to the same ExportedData object, with a 200 status code
        """
        with self.feature("organizations:data-export"):
            response1 = self.get_response(self.organization.slug, **self.payload)
        data_export = ExportedData.objects.get(id=response1.data["id"])
        with self.feature("organizations:data-export"):
            response2 = self.get_valid_response(self.organization.slug, **self.payload)
        assert response2.data == {
            "id": data_export.id,
            "user": {
                "id": six.binary_type(self.user.id),
                "email": self.user.email,
                "username": self.user.username,
            },
            "dateCreated": data_export.date_added,
            "dateFinished": data_export.date_finished,
            "dateExpired": data_export.date_expired,
            "query": {"type": data_export.query_type, "info": data_export.query_info},
            "status": data_export.status,
        }
