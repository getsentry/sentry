from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import run_table_query
from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationReplayTraceItemsEndpointTest(
    APITransactionTestCase,
    SnubaTestCase,
    SpanTestCase,
):
    view = "sentry-api-0-organization-trace-item-attributes-ranked"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.ten_mins_ago = before_now(minutes=10)

    def _store_span(self, description=None, tags=None, duration=None):
        if tags is None:
            tags = {"foo": "bar"}

        self.store_span(
            self.create_span(
                {"description": description or "foo", "sentry_tags": tags},
                start_ts=self.ten_mins_ago,
                duration=duration or 1000,
            ),
            is_eap=True,
        )

    def test_distribution_values(self):
        tags = [
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "chrome", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "desktop"}, 100),
            ({"browser": "safari", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "edge", "device": "desktop"}, 500),
        ]

        for tag, duration in tags:
            self._store_span(tags=tag, duration=duration)

        snuba_params = SnubaParams(
            start=before_now(minutes=20),
            end=before_now(minutes=0),
            environments=[],
            projects=[self.project],
            user=None,
            teams=[],
            organization=self.organization,
            query_string="",
            sampling_mode="BEST_EFFORT",
            debug="debug",
        )

        result = run_table_query(
            snuba_params,
            "",
            ["count(span.duration)"],
            None,
            config=SearchResolverConfig(use_aggregate_conditions=False),
            offset=0,
            limit=1,
            sampling_mode="BEST_EFFORT",
            referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
        )

        print(result)
        assert False
