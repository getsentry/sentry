from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import ExportedData
from sentry.models.exporteddata import ExportStatus
from sentry.testutils import APITestCase


class DataExportDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export-details"

    TEST_DATE_ADDED = timezone.now()

    def test_simple(self):
        with self.feature("organizations:data-export"):
            self.user = self.create_user("foo@example.com")
            self.org = self.create_organization(owner=self.user, name="Toucan Sam")
            self.login_as(user=self.user)

            data_export = ExportedData.objects.create(
                organization=self.org,
                user=self.user,
                date_added=self.TEST_DATE_ADDED,
                query_type=1,
                query_info={"environment": "test"},
            )
            url = reverse(
                self.endpoint,
                kwargs={"data_export_id": data_export.id, "organization_slug": self.org.slug},
            )

            response = self.client.get(url, format="json")
            assert response.status_code == 200
            assert response.data == {
                "id": data_export.id,
                "user": {
                    "id": six.binary_type(self.user.id),
                    "email": self.user.email,
                    "username": self.user.username,
                },
                "dateCreated": self.TEST_DATE_ADDED,
                "dateFinished": None,
                "dateExpired": None,
                "query": {"type": data_export.query_type, "info": data_export.query_info},
                "status": ExportStatus.Early,
            }
