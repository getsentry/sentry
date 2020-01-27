from __future__ import absolute_import

from sentry.testutils import APITestCase


class DataExportTest(APITestCase):
    endpoint = "sentry-api-0-organization-data-export"
    method = "post"
