from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import ExportedData
from sentry.models.exporteddata import ExportStatus
from sentry.testutils import APITestCase


class DataExportTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export"

    TEST_DATE_ADDED = timezone.now()

    def test_simple(self):
        with self.feature("organizations:data-export"):
            self.user = self.create_user("foo@example.com")
            self.org = self.create_organization(owner=self.user, name="Toucan Sam")
            self.login_as(user=self.user)

            data = {"query_type": 2, "query_info": {"environment": "test"}}
            url = reverse(self.endpoint, kwargs={"organization_slug": self.org.slug})

            response = self.client.post(url, data=data)
            data_export = ExportedData.objects.get(id=response.data["id"])
            assert response.status_code == 201
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
                "query": {"type": data["query_type"], "info": data["query_info"]},
                "status": ExportStatus.Early,
            }
