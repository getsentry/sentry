import time
from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils import json
from sentry.utils.samples import load_data


class OrganizationEventsSpansPerformanceEndpointBase(APITestCase, SnubaTestCase):
    FEATURES = ["organizations:performance-suspect-spans-view"]

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-organization-events-spans-performance",
            kwargs={"organization_slug": self.organization.slug},
        )

        self.min_ago = before_now(minutes=1).replace(microsecond=0)

    def update_snuba_config_ensure(self, config, poll=60, wait=1):
        self.snuba_update_config(config)

        for i in range(poll):
            updated = True

            new_config = json.loads(self.snuba_get_config().decode("utf-8"))

            for k, v in config.items():
                if new_config.get(k) != v:
                    updated = False
                    break

            if updated:
                return

            time.sleep(wait)

        assert False, "snuba config not updated in time"

    def create_event(self, **kwargs):
        if "span_id" not in kwargs:
            kwargs["span_id"] = "a" * 16

        if "start_timestamp" not in kwargs:
            kwargs["start_timestamp"] = self.min_ago

        if "timestamp" not in kwargs:
            kwargs["timestamp"] = self.min_ago + timedelta(seconds=8)

        if "trace_context" not in kwargs:
            # should appear for all of the pXX metrics
            kwargs["trace_context"] = {
                "op": "http.server",
                "hash": "ab" * 8,
                "exclusive_time": 4.0,
            }

        if "spans" not in kwargs:
            kwargs["spans"] = [
                # should appear for the sum metric
                {
                    "same_process_as_parent": True,
                    "parent_span_id": "a" * 16,
                    "span_id": x * 16,
                    "start_timestamp": iso_format(self.min_ago + timedelta(seconds=1)),
                    "timestamp": iso_format(self.min_ago + timedelta(seconds=4)),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "hash": "cd" * 8,
                    "exclusive_time": 3.0,
                }
                for x in ["b", "c"]
            ] + [
                # should appear for the count metric
                {
                    "same_process_as_parent": True,
                    "parent_span_id": "a" * 16,
                    "span_id": x * 16,
                    "start_timestamp": iso_format(self.min_ago + timedelta(seconds=4)),
                    "timestamp": iso_format(self.min_ago + timedelta(seconds=5)),
                    "op": "django.view",
                    "description": "view span",
                    "hash": "ef" * 8,
                    "exclusive_time": 1.0,
                }
                for x in ["d", "e", "f"]
            ]

        data = load_data("transaction", **kwargs)
        data["transaction"] = "root transaction"

        return self.store_event(data, project_id=self.project.id)

    def suspect_span_group_snuba_results(self, op, event):
        results = {
            "project.id": self.project.id,
            "project": self.project.slug,
            "transaction": event.transaction,
            "array_join_spans_op": op,
        }

        if op == "http.server":
            results.update(
                {
                    "array_join_spans_group": "ab" * 8,
                    "count_unique_id": 1,
                    "count": 1,
                    "sumArray_spans_exclusive_time": 4.0,
                    "percentileArray_spans_exclusive_time_0_50": 4.0,
                    "percentileArray_spans_exclusive_time_0_75": 4.0,
                    "percentileArray_spans_exclusive_time_0_95": 4.0,
                    "percentileArray_spans_exclusive_time_0_99": 4.0,
                }
            )
        elif op == "django.middleware":
            results.update(
                {
                    "array_join_spans_group": "cd" * 8,
                    "count_unique_id": 1,
                    "count": 2,
                    "sumArray_spans_exclusive_time": 6.0,
                    "percentileArray_spans_exclusive_time_0_50": 3.0,
                    "percentileArray_spans_exclusive_time_0_75": 3.0,
                    "percentileArray_spans_exclusive_time_0_95": 3.0,
                    "percentileArray_spans_exclusive_time_0_99": 3.0,
                }
            )
        elif op == "django.view":
            results.update(
                {
                    "array_join_spans_group": "ef" * 8,
                    "count_unique_id": 1,
                    "count": 3,
                    "sumArray_spans_exclusive_time": 3.0,
                    "percentileArray_spans_exclusive_time_0_50": 1.0,
                    "percentileArray_spans_exclusive_time_0_75": 1.0,
                    "percentileArray_spans_exclusive_time_0_95": 1.0,
                    "percentileArray_spans_exclusive_time_0_99": 1.0,
                }
            )
        else:
            assert False, f"Unexpected Op: {op}"

        return results

    def suspect_span_examples_snuba_results(self, op, event):
        results = {
            "id": event.event_id,
            "array_join_spans_op": op,
        }

        if op == "http.server":
            results.update(
                {
                    "array_join_spans_group": "ab" * 8,
                    "count": 1,
                    "sumArray_spans_exclusive_time": 4.0,
                    "maxArray_spans_exclusive_time": 4.0,
                }
            )
        elif op == "django.middleware":
            results.update(
                {
                    "array_join_spans_group": "cd" * 8,
                    "count": 2,
                    "sumArray_spans_exclusive_time": 6.0,
                    "maxArray_spans_exclusive_time": 3.0,
                }
            )
        elif op == "django.view":
            results.update(
                {
                    "array_join_spans_group": "ef" * 8,
                    "count": 3,
                    "sumArray_spans_exclusive_time": 3.0,
                    "maxArray_spans_exclusive_time": 1.0,
                }
            )
        else:
            assert False, f"Unexpected Op: {op}"

        return results

    def suspect_span_results(self, op, event):
        if op == "http.server":
            return {
                "projectId": self.project.id,
                "project": self.project.slug,
                "transaction": event.transaction,
                "op": op,
                "group": "ab" * 8,
                "frequency": 1,
                "count": 1,
                "sumExclusiveTime": 4.0,
                "p50ExclusiveTime": 4.0,
                "p75ExclusiveTime": 4.0,
                "p95ExclusiveTime": 4.0,
                "p99ExclusiveTime": 4.0,
                "examples": [
                    {
                        "id": event.event_id,
                        "description": "root transaction",
                        "startTimestamp": self.min_ago.timestamp(),
                        "finishTimestamp": (self.min_ago + timedelta(seconds=8)).timestamp(),
                        "nonOverlappingExclusiveTime": 4000.0,
                        "spans": [
                            {
                                "id": "a" * 16,
                                "startTimestamp": self.min_ago.timestamp(),
                                "finishTimestamp": (
                                    self.min_ago + timedelta(seconds=8)
                                ).timestamp(),
                                "exclusiveTime": 4.0,
                            }
                        ],
                    },
                ],
            }

        if op == "django.middleware":
            return {
                "projectId": self.project.id,
                "project": self.project.slug,
                "transaction": event.transaction,
                "op": op,
                "group": "cd" * 8,
                "frequency": 1,
                "count": 2,
                "sumExclusiveTime": 6.0,
                "p50ExclusiveTime": 3.0,
                "p75ExclusiveTime": 3.0,
                "p95ExclusiveTime": 3.0,
                "p99ExclusiveTime": 3.0,
                "examples": [
                    {
                        "id": event.event_id,
                        "description": "middleware span",
                        "startTimestamp": self.min_ago.timestamp(),
                        "finishTimestamp": (self.min_ago + timedelta(seconds=8)).timestamp(),
                        "nonOverlappingExclusiveTime": 3000.0,
                        "spans": [
                            {
                                "id": x * 16,
                                "startTimestamp": (self.min_ago + timedelta(seconds=1)).timestamp(),
                                "finishTimestamp": (
                                    self.min_ago + timedelta(seconds=4)
                                ).timestamp(),
                                "exclusiveTime": 3.0,
                            }
                            for x in ["b", "c"]
                        ],
                    },
                ],
            }

        if op == "django.view":
            return {
                "projectId": self.project.id,
                "project": self.project.slug,
                "transaction": event.transaction,
                "op": op,
                "group": "ef" * 8,
                "frequency": 1,
                "count": 3,
                "sumExclusiveTime": 3.0,
                "p50ExclusiveTime": 1.0,
                "p75ExclusiveTime": 1.0,
                "p95ExclusiveTime": 1.0,
                "p99ExclusiveTime": 1.0,
                "examples": [
                    {
                        "id": event.event_id,
                        "description": "view span",
                        "startTimestamp": self.min_ago.timestamp(),
                        "finishTimestamp": (self.min_ago + timedelta(seconds=8)).timestamp(),
                        "nonOverlappingExclusiveTime": 1000.0,
                        "spans": [
                            {
                                "id": x * 16,
                                "startTimestamp": (self.min_ago + timedelta(seconds=4)).timestamp(),
                                "finishTimestamp": (
                                    self.min_ago + timedelta(seconds=5)
                                ).timestamp(),
                                "exclusiveTime": 1.0,
                            }
                            for x in ["d", "e", "f"]
                        ],
                    },
                ],
            }

        assert False, f"Unexpected Op: {op}"

    def assert_suspect_span(self, result, expected_result):
        assert len(result) == len(expected_result)
        for suspect, expected_suspect in zip(result, expected_result):
            for key in [
                "projectId",
                "project",
                "transaction",
                "op",
                "group",
                "frequency",
                "count",
                "sumExclusiveTime",
                "p50ExclusiveTime",
                "p75ExclusiveTime",
                "p95ExclusiveTime",
                "p99ExclusiveTime",
            ]:
                assert suspect[key] == expected_suspect[key], key

            assert len(suspect["examples"]) == len(expected_suspect["examples"])

            for example, expected_example in zip(suspect["examples"], expected_suspect["examples"]):
                for key in [
                    "id",
                    "description",
                    "startTimestamp",
                    "finishTimestamp",
                    "nonOverlappingExclusiveTime",
                ]:
                    assert example[key] == expected_example[key], key

                assert len(example["spans"]) == len(expected_example["spans"])

                for span, expected_span in zip(example["spans"], expected_example["spans"]):
                    for key in [
                        "id",
                        "startTimestamp",
                        "finishTimestamp",
                        "exclusiveTime",
                    ]:
                        assert span[key] == expected_span[key], key

    def test_no_feature(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-events-spans-performance",
            kwargs={"organization_slug": org.slug},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content

    def test_bad_sort(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-stuff",
                },
                format="json",
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "Can only order by one of count, sumExclusiveTime, p50ExclusiveTime, p75ExclusiveTime, p95ExclusiveTime, p99ExclusiveTime"
        }

    def test_sort_default(self):
        # TODO: remove this and the @pytest.skip once the config
        # is no longer necessary as this can add ~10s to the test
        self.update_snuba_config_ensure({"write_span_columns_projects": f"[{self.project.id}]"})

        event = self.create_event()

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id},
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_suspect_span(
            response.data,
            [
                self.suspect_span_results("django.middleware", event),
                self.suspect_span_results("http.server", event),
                self.suspect_span_results("django.view", event),
            ],
        )

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_sort_sum(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {
                "data": [
                    self.suspect_span_group_snuba_results("django.middleware", event),
                    self.suspect_span_group_snuba_results("http.server", event),
                    self.suspect_span_group_snuba_results("django.view", event),
                ],
            },
            {
                "data": [
                    self.suspect_span_examples_snuba_results("django.middleware", event),
                    self.suspect_span_examples_snuba_results("http.server", event),
                    self.suspect_span_examples_snuba_results("django.view", event),
                ],
            },
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-sumExclusiveTime",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_suspect_span(
            response.data,
            [
                self.suspect_span_results("django.middleware", event),
                self.suspect_span_results("http.server", event),
                self.suspect_span_results("django.view", event),
            ],
        )

        assert mock_raw_snql_query.call_count == 2

        # the first call is the get the suspects, and should be using the specified sort
        assert mock_raw_snql_query.call_args_list[0][0][0].orderby == [
            OrderBy(
                exp=Function(
                    "sum",
                    [Function("arrayJoin", [Column("spans.exclusive_time")])],
                    "sumArray_spans_exclusive_time",
                ),
                direction=Direction.DESC,
            )
        ]
        assert (
            mock_raw_snql_query.call_args_list[0][0][1]
            == "api.organization-events-spans-performance-suspects"
        )

        # the second call is the get the examples, and should also be using the specified sort
        assert mock_raw_snql_query.call_args_list[1][0][0].orderby == [
            OrderBy(
                exp=Function(
                    "sum",
                    [Function("arrayJoin", [Column("spans.exclusive_time")])],
                    "sumArray_spans_exclusive_time",
                ),
                direction=Direction.DESC,
            )
        ]
        assert (
            mock_raw_snql_query.call_args_list[1][0][1]
            == "api.organization-events-spans-performance-examples"
        )

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_sort_count(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {
                "data": [
                    self.suspect_span_group_snuba_results("django.view", event),
                    self.suspect_span_group_snuba_results("django.middleware", event),
                    self.suspect_span_group_snuba_results("http.server", event),
                ],
            },
            {
                "data": [
                    self.suspect_span_examples_snuba_results("django.view", event),
                    self.suspect_span_examples_snuba_results("django.middleware", event),
                    self.suspect_span_examples_snuba_results("http.server", event),
                ],
            },
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-count",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_suspect_span(
            response.data,
            [
                self.suspect_span_results("django.view", event),
                self.suspect_span_results("django.middleware", event),
                self.suspect_span_results("http.server", event),
            ],
        )

        assert mock_raw_snql_query.call_count == 2

        # the first call is the get the suspects, and should be using the specified sort
        assert mock_raw_snql_query.call_args_list[0][0][0].orderby == [
            OrderBy(exp=Function("count", [], "count"), direction=Direction.DESC)
        ]
        assert (
            mock_raw_snql_query.call_args_list[0][0][1]
            == "api.organization-events-spans-performance-suspects"
        )

        # the second call is the get the examples, and should also be using the specified sort
        assert mock_raw_snql_query.call_args_list[1][0][0].orderby == [
            OrderBy(exp=Function("count", [], "count"), direction=Direction.DESC)
        ]
        assert (
            mock_raw_snql_query.call_args_list[1][0][1]
            == "api.organization-events-spans-performance-examples"
        )

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_sort_percentiles(self, mock_raw_snql_query):
        event = self.create_event()

        for i, sort in enumerate(
            [
                "p50ExclusiveTime",
                "p75ExclusiveTime",
                "p95ExclusiveTime",
                "p99ExclusiveTime",
            ]
        ):
            mock_raw_snql_query.side_effect = [
                {
                    "data": [
                        self.suspect_span_group_snuba_results("http.server", event),
                        self.suspect_span_group_snuba_results("django.middleware", event),
                        self.suspect_span_group_snuba_results("django.view", event),
                    ],
                },
                {
                    "data": [
                        self.suspect_span_examples_snuba_results("http.server", event),
                        self.suspect_span_examples_snuba_results("django.middleware", event),
                        self.suspect_span_examples_snuba_results("django.view", event),
                    ],
                },
            ]

            with self.feature(self.FEATURES):
                response = self.client.get(
                    self.url,
                    data={
                        "project": self.project.id,
                        "sort": f"-{sort}",
                    },
                    format="json",
                )

            assert response.status_code == 200, response.content
            self.assert_suspect_span(
                response.data,
                [
                    self.suspect_span_results("http.server", event),
                    self.suspect_span_results("django.middleware", event),
                    self.suspect_span_results("django.view", event),
                ],
            )

            offset = 2 * i
            percentile = sort[1:3]

            assert mock_raw_snql_query.call_count == offset + 2

            # the first call is the get the suspects, and should be using the specified sort
            assert mock_raw_snql_query.call_args_list[offset][0][0].orderby == [
                OrderBy(
                    exp=Function(
                        f"quantile(0.{percentile.rstrip('0')})",
                        [Function("arrayJoin", [Column("spans.exclusive_time")])],
                        f"percentileArray_spans_exclusive_time_0_{percentile}",
                    ),
                    direction=Direction.DESC,
                )
            ]
            assert (
                mock_raw_snql_query.call_args_list[offset][0][1]
                == "api.organization-events-spans-performance-suspects"
            )

            # the second call is the get the examples, and should also be using the specified sort
            assert mock_raw_snql_query.call_args_list[offset + 1][0][0].orderby == [
                OrderBy(
                    exp=Function(
                        "max",
                        [Function("arrayJoin", [Column("spans.exclusive_time")])],
                        "maxArray_spans_exclusive_time",
                    ),
                    direction=Direction.DESC,
                )
            ]
            assert (
                mock_raw_snql_query.call_args_list[offset + 1][0][1]
                == "api.organization-events-spans-performance-examples"
            )

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_op_filters(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {"data": [self.suspect_span_group_snuba_results("http.server", event)]},
            {"data": [self.suspect_span_examples_snuba_results("http.server", event)]},
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-count",
                    "spanOp": "http.server",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_suspect_span(
            response.data,
            # when sorting by -count, this should be the last of the 3 results
            # but the spanOp filter means it should be the only result
            [self.suspect_span_results("http.server", event)],
        )

        assert mock_raw_snql_query.call_count == 2

        # the first call is the get the suspects, and should be using the specified sort
        assert mock_raw_snql_query.call_args_list[0][0][0].orderby == [
            OrderBy(exp=Function("count", [], "count"), direction=Direction.DESC)
        ]
        # the first call should also contain the additional condition on the span op
        assert (
            Condition(
                lhs=Function("arrayJoin", [Column("spans.op")], "array_join_spans_op"),
                op=Op.IN,
                rhs=Function("tuple", ["http.server"]),
            )
            in mock_raw_snql_query.call_args_list[0][0][0].where
        )
        assert (
            mock_raw_snql_query.call_args_list[0][0][1]
            == "api.organization-events-spans-performance-suspects"
        )

        # the second call is the get the examples, and should also be using the specified sort
        assert mock_raw_snql_query.call_args_list[1][0][0].orderby == [
            OrderBy(exp=Function("count", [], "count"), direction=Direction.DESC)
        ]
        assert (
            mock_raw_snql_query.call_args_list[1][0][1]
            == "api.organization-events-spans-performance-examples"
        )

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_pagination_first_page(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {
                "data": [
                    self.suspect_span_group_snuba_results("django.middleware", event),
                    # make sure to return 1 extra result to indicate that there is a next page
                    self.suspect_span_group_snuba_results("http.server", event),
                ],
            },
            # the results for the next page do not need examples
            {"data": [self.suspect_span_examples_snuba_results("django.middleware", event)]},
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-sumExclusiveTime",
                    "per_page": 1,
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        links = parse_link_header(response["Link"])
        for link, info in links.items():
            assert f"project={self.project.id}" in link
            assert "sort=-sumExclusiveTime" in link
            # first page does not have a previous page, only next
            assert info["results"] == "true" if info["rel"] == "next" else "false"

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_pagination_middle_page(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {
                "data": [
                    self.suspect_span_group_snuba_results("http.server", event),
                    # make sure to return 1 extra result to indicate that there is a next page
                    self.suspect_span_group_snuba_results("django.view", event),
                ],
            },
            # the results for the next page do not need examples
            {"data": [self.suspect_span_examples_snuba_results("http.server", event)]},
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-sumExclusiveTime",
                    "per_page": 1,
                    "cursor": "0:1:0",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        links = parse_link_header(response["Link"])
        for link, info in links.items():
            assert f"project={self.project.id}" in link
            assert "sort=-sumExclusiveTime" in link
            # middle page has both a previous and next
            assert info["results"] == "true"

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_pagination_last_page(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {"data": [self.suspect_span_group_snuba_results("http.server", event)]},
            {"data": [self.suspect_span_examples_snuba_results("http.server", event)]},
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-sumExclusiveTime",
                    "per_page": 1,
                    "cursor": "0:2:0",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        links = parse_link_header(response["Link"])
        for link, info in links.items():
            assert f"project={self.project.id}" in link
            assert "sort=-sumExclusiveTime" in link
            # last page does not have a next page, only previous
            assert info["results"] == ("true" if info["rel"] == "previous" else "false")

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_span_group_prefixed_with_zeros(self, mock_raw_snql_query):
        trace_context = {
            "op": "http.server",
            "hash": "00" + "ab" * 7,
            "exclusive_time": 4.0,
        }

        event = self.create_event(trace_context=trace_context)

        group_results = self.suspect_span_group_snuba_results("http.server", event)
        # make sure the span group is missing the zero prefix
        group_results["array_join_spans_group"] = "ab" * 7

        example_results = self.suspect_span_examples_snuba_results("http.server", event)
        # make sure the span group is missing the zero prefix
        example_results["array_join_spans_group"] = "ab" * 7

        mock_raw_snql_query.side_effect = [
            {"data": [group_results]},
            {"data": [example_results]},
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-p99ExclusiveTime",
                    "per_page": 1,
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        results = self.suspect_span_results("http.server", event)
        results["group"] = "00" + "ab" * 7
        self.assert_suspect_span(response.data, [results])
