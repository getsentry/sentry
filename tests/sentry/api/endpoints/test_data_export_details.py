from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import ExportedData
from sentry.testutils import APITestCase


class DataExportTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export-details"
    method = "get"

    def test_simple(self):
        data_export = ExportedData.objects.create(
            organization=self.organization,
            user=self.user,
            date_added=timezone.now(),
            storage_url="https://storage.cloud.google.com/test_data_export_details/readme.html",
            query_type=1,
            query_info={"environment": "test"},
        )

        self.login_as(user=self.user)

        url = reverse(
            self.endpoint, kwargs={"data_export_id": 1, "organization_slug": self.organization.slug}
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["query"] == {
            "type": data_export.query_type,
            "info": data_export.query_info,
        }
        assert response.data["storageUrl"] == data_export.storage_url
        print (response.data["user"])
