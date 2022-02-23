import time
from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils import json
from sentry.utils.samples import load_data


class OrganizationEventsSpansEndpointTestBase(APITestCase, SnubaTestCase):
    FEATURES = [
        "organizations:global-views",
        "organizations:performance-suspect-spans-view",
    ]

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            self.URL,
            kwargs={"organization_slug": self.organization.slug},
        )

        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

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

    def suspect_span_examples_snuba_results(self, op, event):
        results = {
            "project.id": self.project.id,
            "id": event.event_id,
        }

        if op == "http.server":
            results.update(
                {
                    "count_span_time": 1,
                    "sum_span_time": 4.0,
                    "max_span_time": 4.0,
                }
            )
        elif op == "django.middleware":
            results.update(
                {
                    "count_span_time": 2,
                    "sum_span_time": 6.0,
                    "max_span_time": 3.0,
                }
            )
        elif op == "django.view":
            results.update(
                {
                    "count_span_time": 3,
                    "sum_span_time": 3.0,
                    "max_span_time": 1.0,
                }
            )
        else:
            assert False, f"Unexpected Op: {op}"

        return results

    def assert_span_results(
        self, result, expected_result, keys, none_keys=None, with_examples=False
    ):
        assert len(result) == len(expected_result)
        for suspect, expected_suspect in zip(result, expected_result):
            for key in keys:
                if none_keys and key in none_keys:
                    assert suspect[key] is None, key
                else:
                    assert suspect[key] == expected_suspect[key], key

            if with_examples:
                assert len(suspect["examples"]) == len(expected_suspect["examples"])

                for example, expected_example in zip(
                    suspect["examples"], expected_suspect["examples"]
                ):
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

    def assert_suspect_span(self, result, expected_result, none_keys=None):
        self.assert_span_results(
            result,
            expected_result,
            [
                "op",
                "group",
                "frequency",
                "count",
                "sumExclusiveTime",
                "p50ExclusiveTime",
                "p75ExclusiveTime",
                "p95ExclusiveTime",
                "p99ExclusiveTime",
            ],
            none_keys=none_keys,
            with_examples=False,
        )

    def assert_span_examples(self, result, expected_result):
        self.assert_span_results(result, expected_result, ["op", "group"], with_examples=True)

    def suspect_span_group_snuba_results(self, op, event):
        results = {
            "array_join_spans_op": op,
            "any_id": event.event_id,
        }

        if op == "http.server":
            results.update(
                {
                    "array_join_spans_group": "ab" * 8,
                    "count_unique_id": 1,
                    "count": 1,
                    "equation[0]": 1,
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
                    "equation[0]": 2,
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
                    "equation[0]": 3,
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

    def span_example_results(self, op, event):
        if op == "http.server":
            return {
                "op": op,
                "group": "ab" * 8,
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

        elif op == "django.middleware":
            return {
                "op": op,
                "group": "cd" * 8,
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

        elif op == "django.view":
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

        else:
            assert False, f"Unexpected Op: {op}"

    def suspect_span_results(self, op, event):
        results = self.span_example_results(op, event)

        if op == "http.server":
            results.update(
                {
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
                }
            )

        elif op == "django.middleware":
            results.update(
                {
                    "projectId": self.project.id,
                    "project": self.project.slug,
                    "transaction": event.transaction,
                    "frequency": 1,
                    "count": 2,
                    "sumExclusiveTime": 6.0,
                    "p50ExclusiveTime": 3.0,
                    "p75ExclusiveTime": 3.0,
                    "p95ExclusiveTime": 3.0,
                    "p99ExclusiveTime": 3.0,
                }
            )

        elif op == "django.view":
            results.update(
                {
                    "projectId": self.project.id,
                    "project": self.project.slug,
                    "transaction": event.transaction,
                    "frequency": 1,
                    "count": 3,
                    "sumExclusiveTime": 3.0,
                    "p50ExclusiveTime": 1.0,
                    "p75ExclusiveTime": 1.0,
                    "p95ExclusiveTime": 1.0,
                    "p99ExclusiveTime": 1.0,
                }
            )

        else:
            assert False, f"Unexpected Op: {op}"

        return results


class OrganizationEventsSpansPerformanceEndpointTest(OrganizationEventsSpansEndpointTestBase):
    URL = "sentry-api-0-organization-events-spans-performance"

    def test_no_feature(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.URL,
            kwargs={"organization_slug": org.slug},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content

    def test_multiple_projects(self):
        project = self.create_project(organization=self.organization)

        # explicitly specify >1 projects
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": [self.project.id, project.id]},
                format="json",
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail("You must specify exactly 1 project.", code="parse_error"),
        }

        # all projects contain >1 projects
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": [-1]},
                format="json",
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail("You must specify exactly 1 project.", code="parse_error"),
        }

        # my projects contain >1 projects
        with self.feature(self.FEATURES):
            response = self.client.get(self.url, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail("You must specify exactly 1 project.", code="parse_error"),
        }

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
            "detail": "Can only order by one of count, avgOccurrence, sumExclusiveTime, p50ExclusiveTime, p75ExclusiveTime, p95ExclusiveTime, p99ExclusiveTime"
        }

    def test_sort_default(self):
        # TODO: remove this and the @pytest.skip once the config
        # is no longer necessary as this can add ~10s to the test
        self.update_snuba_config_ensure({"write_span_columns_projects": f"[{self.project.id}]"})

        event = self.create_event()

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "field": [
                        "percentileArray(spans_exclusive_time, 0.50)",
                        "percentileArray(spans_exclusive_time, 0.75)",
                        "percentileArray(spans_exclusive_time, 0.95)",
                        "percentileArray(spans_exclusive_time, 0.99)",
                        "count()",
                        "count_unique(id)",
                        "sumArray(spans_exclusive_time)",
                    ],
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

        assert mock_raw_snql_query.call_count == 1

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

        assert mock_raw_snql_query.call_count == 1

        # the first call is the get the suspects, and should be using the specified sort
        assert mock_raw_snql_query.call_args_list[0][0][0].orderby == [
            OrderBy(exp=Function("count", [], "count"), direction=Direction.DESC),
            OrderBy(
                exp=Function(
                    "sum",
                    [Function("arrayJoin", [Column("spans.exclusive_time")])],
                    "sumArray_spans_exclusive_time",
                ),
                direction=Direction.DESC,
            ),
        ]
        assert (
            mock_raw_snql_query.call_args_list[0][0][1]
            == "api.organization-events-spans-performance-suspects"
        )

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_sort_avg_occurrence(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {
                "data": [
                    self.suspect_span_group_snuba_results("django.view", event),
                    self.suspect_span_group_snuba_results("django.middleware", event),
                    self.suspect_span_group_snuba_results("http.server", event),
                ],
            },
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "sort": "-avgOccurrence",
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

        assert mock_raw_snql_query.call_count == 1

        # the first call is the get the suspects, and should be using the specified sort
        assert mock_raw_snql_query.call_args_list[0][0][0].orderby == [
            OrderBy(
                exp=Function(
                    "divide",
                    [
                        Function("count", [], "count"),
                        Function(
                            "nullIf", [Function("uniq", [Column("event_id")], "count_unique_id"), 0]
                        ),
                    ],
                    "equation[0]",
                ),
                direction=Direction.DESC,
            ),
            OrderBy(
                exp=Function(
                    "sum",
                    [Function("arrayJoin", [Column("spans.exclusive_time")])],
                    "sumArray_spans_exclusive_time",
                ),
                direction=Direction.DESC,
            ),
        ]
        assert (
            mock_raw_snql_query.call_args_list[0][0][1]
            == "api.organization-events-spans-performance-suspects"
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

            percentile = sort[1:3]

            assert mock_raw_snql_query.call_count == i + 1

            # the first call is the get the suspects, and should be using the specified sort
            assert mock_raw_snql_query.call_args_list[i][0][0].orderby == [
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
                mock_raw_snql_query.call_args_list[i][0][1]
                == "api.organization-events-spans-performance-suspects"
            )

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_op_filter(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {"data": [self.suspect_span_group_snuba_results("django.middleware", event)]},
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "spanOp": "django.middleware",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_suspect_span(
            response.data,
            [self.suspect_span_results("django.middleware", event)],
        )

        assert mock_raw_snql_query.call_count == 1

        # the first call should also contain the additional condition on the span op
        assert (
            Condition(
                lhs=Function("arrayJoin", [Column("spans.op")], "array_join_spans_op"),
                op=Op.IN,
                rhs=Function("tuple", ["django.middleware"]),
            )
            in mock_raw_snql_query.call_args_list[0][0][0].where
        )

    def test_bad_group_filter(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "spanGroup": "cd",
                },
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "spanGroup": [
                ErrorDetail(
                    "spanGroup must be a valid 16 character hex (containing only digits, or a-f characters)",
                    code="invalid",
                )
            ]
        }

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_group_filter(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {"data": [self.suspect_span_group_snuba_results("django.middleware", event)]},
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "spanGroup": "cd" * 8,
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_suspect_span(
            response.data,
            [self.suspect_span_results("django.middleware", event)],
        )

        assert mock_raw_snql_query.call_count == 1

        # the first call should also contain the additional condition on the span op
        assert (
            Condition(
                lhs=Function("arrayJoin", [Column("spans.group")], "array_join_spans_group"),
                op=Op.IN,
                rhs=Function("tuple", ["cd" * 8]),
            )
            in mock_raw_snql_query.call_args_list[0][0][0].where
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

        mock_raw_snql_query.side_effect = [
            {"data": [group_results]},
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


class OrganizationEventsSpansExamplesEndpointTest(OrganizationEventsSpansEndpointTestBase):
    URL = "sentry-api-0-organization-events-spans"

    def test_no_feature(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.URL,
            kwargs={"organization_slug": org.slug},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content

    def test_require_span_param(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"span": [ErrorDetail("This field is required.", code="required")]}

    def test_bad_span_param(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id, "span": ["http.server"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "span": [
                ErrorDetail(
                    "span must consist of of a span op and a valid 16 character hex delimited by a colon (:)",
                    code="invalid",
                )
            ]
        }

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id, "span": ["http.server:ab"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "span": [
                ErrorDetail(
                    "spanGroup must be a valid 16 character hex (containing only digits, or a-f characters)",
                    code="invalid",
                )
            ]
        }

    def test_span_filters(self):
        test_op = "django.middleware"
        test_hash = "cd" * 8
        spans = [
            # span with test_op but different hash
            {
                "same_process_as_parent": True,
                "parent_span_id": "a" * 16,
                "span_id": "b" * 16,
                "start_timestamp": iso_format(self.min_ago + timedelta(seconds=1)),
                "timestamp": iso_format(self.min_ago + timedelta(seconds=4)),
                "op": test_op,
                "description": "middleware span",
                "hash": "ab" * 8,
                "exclusive_time": 3.0,
            },
            # span with test_hash but different op
            {
                "same_process_as_parent": True,
                "parent_span_id": "a" * 16,
                "span_id": "c" * 16,
                "start_timestamp": iso_format(self.min_ago + timedelta(seconds=1)),
                "timestamp": iso_format(self.min_ago + timedelta(seconds=4)),
                "op": "django.view",
                "description": "middleware span",
                "hash": test_hash,
                "exclusive_time": 1.0,
            },
        ]
        self.create_event(spans=spans)

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id, "span": f"{test_op}:{test_hash}"},
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == [{"op": test_op, "group": test_hash, "examples": []}]

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_one_span(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {
                "data": [self.suspect_span_examples_snuba_results("http.server", event)],
            },
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id, "span": f"http.server:{'ab' * 8}"},
                format="json",
            )

        assert response.status_code == 200, response.content
        assert mock_raw_snql_query.call_count == 1

        self.assert_span_examples(response.data, [self.span_example_results("http.server", event)])

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_per_page(self, mock_raw_snql_query):
        event = self.create_event()

        mock_raw_snql_query.side_effect = [
            {
                "data": [
                    self.suspect_span_examples_snuba_results("http.server", event),
                    self.suspect_span_examples_snuba_results("http.server", event),
                ],
            },
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "span": [f"http.server:{'ab' * 8}"],
                    "per_page": 1,
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert mock_raw_snql_query.call_count == 1

        self.assert_span_examples(
            response.data,
            [self.span_example_results("http.server", event)],
        )


class OrganizationEventsSpansStatsEndpointTest(OrganizationEventsSpansEndpointTestBase):
    URL = "sentry-api-0-organization-events-spans-stats"

    def test_no_feature(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_require_span_param(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {"span": [ErrorDetail("This field is required.", code="required")]}

    def test_bad_span_param(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id, "span": ["http.server"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "span": [
                ErrorDetail(
                    "span must consist of of a span op and a valid 16 character hex delimited by a colon (:)",
                    code="invalid",
                )
            ]
        }

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": self.project.id, "span": ["http.server:ab"]},
                format="json",
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "span": [
                ErrorDetail(
                    "spanGroup must be a valid 16 character hex (containing only digits, or a-f characters)",
                    code="invalid",
                )
            ]
        }

    @patch("sentry.api.endpoints.organization_events_spans_performance.raw_snql_query")
    def test_one_span(self, mock_raw_snql_query):
        mock_raw_snql_query.side_effect = [{"data": []}]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": self.project.id,
                    "span": f"http.server:{'ab' * 8}",
                    "yAxis": [
                        "percentileArray(spans_exclusive_time, 0.75)",
                        "percentileArray(spans_exclusive_time, 0.95)",
                        "percentileArray(spans_exclusive_time, 0.99)",
                    ],
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                },
                format="json",
            )

        assert response.status_code == 200, response.content

        # ensure that the result is a proper time series
        data = response.data
        series_names = [
            f"percentileArray(spans_exclusive_time, 0.{percentile})"
            for percentile in ["75", "95", "99"]
        ]
        assert set(data.keys()) == set(series_names)
        for i, series_name in enumerate(series_names):
            series = data[series_name]
            assert series["order"] == i
            assert [attrs for _, attrs in series["data"]] == [
                [{"count": 0}],
                [{"count": 0}],
            ]

        assert mock_raw_snql_query.call_count == 1
        query = mock_raw_snql_query.call_args_list[0][0][0]

        # ensure the specified y axes are in the select
        for percentile in ["75", "95", "99"]:
            assert (
                Function(
                    f"quantile(0.{percentile.rstrip('0')})",
                    [Function("arrayJoin", [Column("spans.exclusive_time")])],
                    f"percentileArray_spans_exclusive_time_0_{percentile}",
                )
                in query.select
            )

        spans_op = Function("arrayJoin", [Column("spans.op")], "array_join_spans_op")
        spans_group = Function("arrayJoin", [Column("spans.group")], "array_join_spans_group")

        # ensure the two span columns are in the group by
        for column in [spans_op, spans_group]:
            assert column in query.groupby

        # ensure there is a condition on the span
        assert (
            Condition(
                Function("tuple", [spans_op, spans_group]),
                Op.IN,
                Function("tuple", [Function("tuple", ["http.server", "ab" * 8])]),
            )
            in query.where
        )
