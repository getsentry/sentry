from __future__ import absolute_import

from hashlib import sha1

import six
from datetime import timedelta
from django.utils import timezone

from sentry.data_export.base import ExportStatus, ExportQueryType
from sentry.data_export.models import ExportedData
from sentry.models import File
from sentry.testutils import APITestCase


class DataExportDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export-details"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        self.data_export = ExportedData.objects.create(
            user=self.user, organization=self.organization, query_type=0, query_info={"env": "test"}
        )

    def test_content(self):
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, self.data_export.id)
        assert response.data["id"] == self.data_export.id
        assert response.data["user"] == {
            "id": six.text_type(self.user.id),
            "email": self.user.email,
            "username": self.user.username,
        }
        assert response.data["dateCreated"] == self.data_export.date_added
        assert response.data["query"] == {
            "type": ExportQueryType.as_str(self.data_export.query_type),
            "info": self.data_export.query_info,
        }

    def test_early(self):
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, self.data_export.id)
        assert response.data["dateFinished"] is None
        assert response.data["dateExpired"] is None
        assert response.data["status"] == ExportStatus.Early

    def test_valid(self):
        self.data_export.update(
            date_finished=timezone.now() - timedelta(weeks=2),
            date_expired=timezone.now() + timedelta(weeks=1),
        )
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, self.data_export.id)
        assert response.data["dateFinished"] is not None
        assert response.data["dateFinished"] == self.data_export.date_finished
        assert response.data["dateExpired"] is not None
        assert response.data["dateExpired"] == self.data_export.date_expired
        assert response.data["status"] == ExportStatus.Valid

    def test_expired(self):
        self.data_export.update(
            date_finished=timezone.now() - timedelta(weeks=2),
            date_expired=timezone.now() - timedelta(weeks=1),
        )
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, self.data_export.id)
        assert response.data["dateFinished"] is not None
        assert response.data["dateFinished"] == self.data_export.date_finished
        assert response.data["dateExpired"] is not None
        assert response.data["dateExpired"] == self.data_export.date_expired
        assert response.data["status"] == ExportStatus.Expired

    def test_no_file(self):
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, self.data_export.id)
        assert response.data["checksum"] is None
        assert response.data["fileName"] is None

    def test_file(self):
        contents = b"test"
        file = File.objects.create(
            name="test.csv", type="export.csv", headers={"Content-Type": "text/csv"}
        )
        file.putfile(six.BytesIO(contents))
        self.data_export.update(file=file)
        with self.feature("organizations:discover-query"):
            response = self.get_valid_response(self.organization.slug, self.data_export.id)
        assert response.data["checksum"] == sha1(contents).hexdigest()
        assert response.data["fileName"] == "test.csv"
