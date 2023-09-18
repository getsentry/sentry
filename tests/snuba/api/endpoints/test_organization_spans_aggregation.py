import hashlib
from unittest import mock

from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase


class OrganizationSpansAggregationTest(APITestCase, SnubaTestCase):
    url_name = "sentry-api-0-organization-spans-aggregation"
    FEATURES = [
        "organizations:starfish-view",
        "organizations:performance-view",
    ]

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            self.url_name,
            kwargs={"organization_slug": self.project.organization.slug},
        )

    @mock.patch("sentry.api.endpoints.organization_spans_aggregation.raw_snql_query")
    def test_simple(self, mock_query):
        mock_query.side_effect = [
            {
                "data": [
                    {
                        "transaction_id": "80fe542aea4945ffbe612646987ee449",
                        "count": 71,
                        "spans": [
                            [
                                "root_1",
                                1,
                                "parent_1",
                                "A",
                                "A",
                                "bind_organization_context",
                                422,
                                0,
                                0.0,
                            ],
                            ["B1", 0, "root_1", "B", "B", "connect", 158, 50, 50.0],
                            ["C1", 0, "root_1", "C", "C", "resolve_conditions", 448, 0, 10.0],
                            ["D1", 0, "C1", "D", "D", "resolve_orderby", 429, 0, 20.0],
                        ],
                    },
                    {
                        "transaction_id": "86b21833d1854d9b811000b91e7fccfa",
                        "count": 71,
                        "spans": [
                            [
                                "root_2",
                                1,
                                "parent_2",
                                "A",
                                "A",
                                "bind_organization_context",
                                422,
                                0,
                                0.0,
                            ],
                            ["B2", 0, "root_2", "B", "B", "connect", 158, 10, 30.0],
                            ["C2", 0, "root_2", "C", "C", "resolve_conditions", 448, 0, 40.0],
                            ["D2", 0, "C2", "D", "D", "resolve_orderby", 429, 0, 10.0],
                            ["D2-duplicate", 0, "C2", "D", "D", "resolve_orderby", 430, 0, 20.0],
                        ],
                    },
                ]
            }
        ]
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"transaction": "foo"},
                format="json",
            )

            assert response.data
            data = response.data
            root_fingerprint = hashlib.md5(b"A").hexdigest()[:16]
            assert root_fingerprint in data
            assert data[root_fingerprint]["description"] == "bind_organization_context"
            assert data[root_fingerprint]["count()"] == 2

            fingerprint = hashlib.md5(b"A-B").hexdigest()[:16]
            assert data[fingerprint]["description"] == "connect"
            assert data[fingerprint]["avg(duration)"] == 30.0

            fingerprint = hashlib.md5(b"A-C-D").hexdigest()[:16]
            assert data[fingerprint]["description"] == "resolve_orderby"
            assert data[fingerprint]["avg(exclusive_time)"] == 15.0
            assert data[fingerprint]["count()"] == 2

            fingerprint = hashlib.md5(b"A-C-D2").hexdigest()[:16]
            assert data[fingerprint]["description"] == "resolve_orderby"
            assert data[fingerprint]["avg(exclusive_time)"] == 20.0
            assert data[fingerprint]["count()"] == 1
