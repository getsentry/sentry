from django.urls import reverse

from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.datasource.redis import _get_redis_key, get_redis_client
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


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

        redis_client = get_redis_client()

        for transaction in ["/a/b/c/", "/a/foo", "/a/whathever/c/d/", "/not_a/"]:
            event = load_data(
                "transaction",
                timestamp=before_now(minutes=1),
                start_timestamp=before_now(minutes=1, milliseconds=500),
            )
            event["transaction"] = transaction
            event["transaction_info"] = {"source": "url"}
            self.store_event(event, project_id=self.project.id)

            redis_client.sadd(
                _get_redis_key(ClustererNamespace.TRANSACTIONS, self.project), transaction
            )

    def _test_get(self, datasource):
        response = self.client.get(
            self.url,
            data={
                "datasource": datasource,
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
                "rules_projectoption": {},
                "rules_redis": {},
                "unique_transaction_names": ["/a/b/c/", "/a/foo", "/a/whathever/c/d/", "/not_a/"],
            },
        }

    def test_get_snuba(self):
        self._test_get("snuba")

    def test_get_redis(self):
        self._test_get("redis")
