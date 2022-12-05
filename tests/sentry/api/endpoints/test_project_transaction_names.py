from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data


@region_silo_test
class ProjectTransactionNamesClusterTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)

        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        self.url = reverse(
            "sentry-api-0-organization-project-cluster-transaction-names",
            args=[self.org.slug, self.project.slug],
        )

        for transaction in ["/a/b/c/", "/a/foo", "/a/whathever/c/d/", "/not_a/"]:
            event = load_data(
                "transaction",
                timestamp=before_now(minutes=1),
                start_timestamp=before_now(minutes=1, milliseconds=500),
            )
            event["transaction"] = transaction
            event["transaction_info"] = {"source": "url"}
            self.store_event(event, project_id=self.project.id)

    def test_get(self):
        response = self.client.get(
            self.url,
            data={
                "project": [self.project.id],
                "statsPeriod": "1h",
                "limit": 5,
                "threshold": 3,
                "returnAllNames": True,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        data = response.data
        data["meta"]["unique_transaction_names"].sort()
        assert data == {
            "rules": ["/a/*/**"],
            "meta": {
                "unique_transaction_names": ["/a/b/c/", "/a/foo", "/a/whathever/c/d/", "/not_a/"]
            },
        }
