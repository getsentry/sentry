from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.api.endpoints.organization_traces import process_breakdowns
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class OrganizationTracesEndpointTestBase(BaseSpansTestCase, APITestCase):
    view: str
    is_eap: bool = False

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def double_write_segment(
        self,
        *,
        project,
        trace_id,
        transaction_id,
        span_id,
        timestamp,
        duration,
        **kwargs,
    ):
        kwargs.setdefault("measurements", {})
        if "lcp" not in kwargs["measurements"]:
            kwargs["measurements"]["lcp"] = duration
        if "client_sample_rate" not in kwargs["measurements"]:
            kwargs["measurements"]["client_sample_rate"] = 0.1

        # first write to the transactions dataset
        end_timestamp = timestamp + timedelta(microseconds=duration * 1000)
        data = load_data(
            "transaction",
            start_timestamp=timestamp,
            timestamp=end_timestamp,
            trace=trace_id,
            span_id=span_id,
            spans=[],
            event_id=transaction_id,
        )

        for measurement, value in kwargs.get("measurements", {}).items():
            data["measurements"][measurement] = {"value": value}

        if tags := kwargs.get("tags", {}):
            data["tags"] = [[key, val] for key, val in tags.items()]

        self.store_event(
            data=data,
            project_id=project.id,
        )

        self.store_segment(
            project_id=project.id,
            trace_id=trace_id,
            transaction_id=transaction_id,
            span_id=span_id,
            timestamp=timestamp,
            duration=duration,
            organization_id=project.organization.id,
            is_eap=self.is_eap,
            **kwargs,
        )

    def create_mock_traces(self):
        project_1 = self.create_project()
        project_2 = self.create_project()

        # Hack: ensure that no span ids with leading 0s are generated for the test
        span_ids = ["1" + uuid4().hex[:15] for _ in range(13)]
        tags = ["", "bar", "bar", "baz", "", "bar", "baz"]
        timestamps = []

        # move this 3 days into the past to ensure less flakey tests
        now = before_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=3)

        trace_id_1 = uuid4().hex
        timestamps.append(now - timedelta(minutes=10))
        self.double_write_segment(
            project=project_1,
            trace_id=trace_id_1,
            transaction_id=uuid4().hex,
            span_id=span_ids[0],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=60_100,
            exclusive_time=60_100,
            sdk_name="sentry.javascript.node",
        )
        for i in range(1, 4):
            timestamps.append(now - timedelta(minutes=9, seconds=45 - i))
            self.double_write_segment(
                project=project_2,
                trace_id=trace_id_1,
                transaction_id=uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[0],
                timestamp=timestamps[-1],
                transaction="bar",
                duration=30_000 + i,
                exclusive_time=30_000 + i,
                tags={"foo": tags[i]},
                sdk_name="sentry.javascript.node",
            )

        trace_id_2 = uuid4().hex
        txn_id_2 = uuid4().hex
        timestamps.append(now - timedelta(days=1, minutes=20))
        self.double_write_segment(
            project=project_1,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="bar",
            duration=90_123,
            exclusive_time=90_123,
            sdk_name="sentry.javascript.node",
        )
        for i in range(5, 7):
            timestamps.append(now - timedelta(days=1, minutes=19, seconds=55 - i))
            self.double_write_segment(
                project=project_2,
                trace_id=trace_id_2,
                transaction_id=uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[4],
                timestamp=timestamps[-1],
                transaction="baz",
                duration=20_000 + i,
                exclusive_time=20_000 + i,
                tags={"foo": tags[i]},
                sdk_name="sentry.javascript.node",
            )

        timestamps.append(now - timedelta(days=1, minutes=19, seconds=59))
        self.store_indexed_span(
            organization_id=project_1.organization.id,
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[7],
            parent_span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=1_000,
            exclusive_time=1_000,
            op="http.client",
            is_eap=self.is_eap,
        )

        timestamps.append(now - timedelta(days=1, minutes=19, seconds=40))
        self.store_indexed_span(
            organization_id=project_1.organization.id,
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[8],
            parent_span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=3_000,
            exclusive_time=3_000,
            op="db.sql",
            is_eap=self.is_eap,
        )

        timestamps.append(now - timedelta(days=1, minutes=19, seconds=45))
        self.store_indexed_span(
            organization_id=project_1.organization.id,
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[9],
            parent_span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=3,
            exclusive_time=3,
            op="db.sql",
            is_eap=self.is_eap,
        )

        timestamps.append(now - timedelta(days=2, minutes=30))
        trace_id_3 = uuid4().hex
        self.double_write_segment(
            project=project_1,
            trace_id=trace_id_3,
            transaction_id=uuid4().hex,
            span_id=span_ids[10],
            timestamp=timestamps[-1],
            transaction="qux",
            duration=40_000,
            exclusive_time=40_000,
            tags={"foo": "qux"},
            measurements={
                measurement: 40_000
                for i, measurement in enumerate(
                    [
                        "score.total",
                        "score.inp",
                        "score.weight.inp",
                        "http.response_content_length",
                        "http.decoded_response_content_length",
                        "http.response_transfer_size",
                    ]
                )
            },
            store_metrics_summary={
                "d:custom/value@millisecond": [
                    {
                        "min": 40_000,
                        "max": 40_000,
                        "sum": 40_000,
                        "count": 1,
                        "tags": {"foo": "qux"},
                    }
                ]
            },
            sdk_name="sentry.javascript.remix",
        )

        timestamps.append(now - timedelta(days=2, minutes=29, seconds=50))
        self.double_write_segment(
            project=project_1,
            trace_id=trace_id_3,
            transaction_id=uuid4().hex,
            span_id=span_ids[11],
            parent_span_id=span_ids[10],
            timestamp=timestamps[-1],
            transaction="quz",
            duration=10_000,
            tags={"foo": "quz"},
            sdk_name="sentry.javascript.node",
        )

        error_data = load_data("javascript", timestamp=timestamps[0])
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": trace_id_1,
            "span_id": span_ids[0],
        }
        error_data["tags"] = [["transaction", "foo"]]
        self.store_event(error_data, project_id=project_1.id)

        timestamps.append(now - timedelta(days=1, minutes=21, seconds=0))
        self.store_indexed_span(
            organization_id=project_1.organization.id,
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=None,  # mock an INP span
            span_id=span_ids[12],
            parent_span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="",
            duration=1_000,
            exclusive_time=1_000,
            op="ui.navigation.click",
            is_eap=self.is_eap,
        )

        return (
            project_1,
            project_2,
            trace_id_1,
            trace_id_2,
            trace_id_3,
            [int(ts.timestamp() * 1000) for ts in timestamps],
            span_ids,
        )


class OrganizationTracesEndpointTest(OrganizationTracesEndpointTestBase):
    view = "sentry-api-0-organization-traces"

    def do_request(self, query, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer", "organizations:global-views"]

        if self.is_eap:
            if query is None:
                query = {}
            query["dataset"] = "spans"

        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_id_or_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self):
        response = self.do_request({}, features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request({})
        assert response.status_code == 404, response.data

    def test_bad_params_too_many_per_page(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "per_page": 1000,
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": ErrorDetail(
                string="Invalid per_page value. Cannot exceed 100.", code="parse_error"
            ),
        }

    def test_unsupported_mri(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "maxSpansPerTrace": 1,
            "mri": "d:spans/made_up@none",
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": ErrorDetail(
                string="Unsupported MRI: d:spans/made_up@none", code="parse_error"
            ),
        }

    def test_no_traces(self):
        query = {
            "project": [self.project.id],
            "field": ["id", "parent_span"],
            "maxSpansPerTrace": 1,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert response.data == {
            "data": [],
            "meta": {
                "dataset": "unknown",
                "datasetReason": "unchanged",
                "fields": {},
                "isMetricsData": False,
                "isMetricsExtractedData": False,
                "tips": {},
                "units": {},
            },
        }

    def test_query_not_required(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "maxSpansPerTrace": 1,
            "query": [""],
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

    @patch("sentry_sdk.capture_exception")
    @patch("sentry.api.endpoints.organization_traces.process_breakdowns")
    def test_process_breakdown_error(self, mock_process_breakdowns, mock_capture_exception):
        exception = Exception()

        mock_process_breakdowns.side_effect = exception

        (
            project_1,
            project_2,
            trace_id_1,
            trace_id_2,
            _,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        query = {
            "project": [],
            "field": ["id", "parent_span", "span.duration"],
            "query": "foo:[bar, baz]",
            "maxSpansPerTrace": 3,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

        assert response.data["meta"] == {
            "dataset": "unknown",
            "datasetReason": "unchanged",
            "fields": {},
            "isMetricsData": False,
            "isMetricsExtractedData": False,
            "tips": {},
            "units": {},
        }

        result_data = sorted(response.data["data"], key=lambda trace: trace["duration"])

        assert result_data == [
            {
                "trace": trace_id_1,
                "numErrors": 1,
                "numOccurrences": 0,
                "numSpans": 4,
                "matchingSpans": 3,
                "project": project_1.slug,
                "name": "foo",
                "duration": 60_100,
                "start": timestamps[0],
                "end": timestamps[0] + 60_100,
                "rootDuration": 60_100,
                "breakdowns": [],
            },
            {
                "trace": trace_id_2,
                "numErrors": 0,
                "numOccurrences": 0,
                "numSpans": 6,
                "matchingSpans": 2,
                "project": project_1.slug,
                "name": "bar",
                "duration": 90_123,
                "start": timestamps[4],
                "end": timestamps[4] + 90_123,
                "rootDuration": 90_123,
                "breakdowns": [],
            },
        ]

        mock_capture_exception.assert_called_with(
            exception, contexts={"bad_traces": {"traces": list(sorted([trace_id_1, trace_id_2]))}}
        )

    def test_use_first_span_for_name(self):
        trace_id = uuid4().hex
        span_id = "1" + uuid4().hex[:15]
        parent_span_id = "1" + uuid4().hex[:15]
        now = before_now().replace(hour=0, minute=0, second=0, microsecond=0)
        ts = now - timedelta(minutes=10)

        self.double_write_segment(
            project=self.project,
            trace_id=trace_id,
            transaction_id=uuid4().hex,
            span_id=span_id,
            parent_span_id=parent_span_id,
            timestamp=ts,
            transaction="foo",
            duration=60_100,
            exclusive_time=60_100,
            sdk_name="sentry.javascript.node",
            op="bar",
        )

        timestamp = int(ts.timestamp() * 1000)

        query = {
            "project": [],
            "field": ["id", "parent_span", "span.duration"],
            "query": "",
            "maxSpansPerTrace": 3,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

        assert response.data["data"] == [
            {
                "breakdowns": [
                    {
                        "duration": 60_100,
                        "start": timestamp,
                        "end": timestamp + 60_100,
                        "sliceStart": 0,
                        "sliceEnd": 40,
                        "sliceWidth": 40,
                        "isRoot": False,
                        "kind": "project",
                        "project": self.project.slug,
                        "sdkName": "sentry.javascript.node",
                    },
                ],
                "duration": 60_100,
                "end": timestamp + 60_100,
                "name": "foo",
                "numErrors": 0,
                "numOccurrences": 0,
                "numSpans": 1,
                "matchingSpans": 1,
                "project": self.project.slug,
                "start": timestamp,
                "trace": trace_id,
                "rootDuration": 60_100,
            },
        ]

    def test_use_root_span_for_name(self):
        trace_id = uuid4().hex
        span_id_1 = "1" + uuid4().hex[:15]
        span_id_2 = "1" + uuid4().hex[:15]
        now = before_now().replace(hour=0, minute=0, second=0, microsecond=0)
        ts = now - timedelta(minutes=10)

        self.double_write_segment(
            project=self.project,
            trace_id=trace_id,
            transaction_id=uuid4().hex,
            span_id=span_id_1,
            timestamp=ts,
            transaction="foo",
            duration=60_000,
            exclusive_time=60_000,
            sdk_name="sentry.javascript.remix",
        )

        self.double_write_segment(
            project=self.project,
            trace_id=trace_id,
            transaction_id=uuid4().hex,
            span_id=span_id_2,
            parent_span_id=span_id_1,
            timestamp=ts,
            transaction="foo",
            duration=15_000,
            exclusive_time=15_000,
            sdk_name="sentry.javascript.node",
            op="pageload",
        )

        timestamp = int(ts.timestamp() * 1000)

        query = {
            "project": [],
            "field": ["id", "parent_span", "span.duration"],
            "query": "",
            "maxSpansPerTrace": 3,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

        assert response.data["data"] == [
            {
                "breakdowns": [
                    {
                        "duration": 60_000,
                        "start": timestamp,
                        "end": timestamp + 60_000,
                        "sliceStart": 0,
                        "sliceEnd": 40,
                        "sliceWidth": 40,
                        "isRoot": False,
                        "kind": "project",
                        "project": self.project.slug,
                        "sdkName": "sentry.javascript.remix",
                    },
                    {
                        "duration": 15_000,
                        "start": timestamp,
                        "end": timestamp + 15_000,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "isRoot": False,
                        "kind": "project",
                        "project": self.project.slug,
                        "sdkName": "sentry.javascript.node",
                    },
                ],
                "duration": 60_000,
                "end": timestamp + 60_000,
                "name": "foo",
                "numErrors": 0,
                "numOccurrences": 0,
                "numSpans": 2,
                "matchingSpans": 2,
                "project": self.project.slug,
                "start": timestamp,
                "trace": trace_id,
                "rootDuration": 60_000,
            },
        ]

    def test_use_pageload_for_name(self):
        trace_id = uuid4().hex
        span_id = "1" + uuid4().hex[:15]
        parent_span_id = "1" + uuid4().hex[:15]
        now = before_now().replace(hour=0, minute=0, second=0, microsecond=0)
        ts = now - timedelta(minutes=10)

        self.double_write_segment(
            project=self.project,
            trace_id=trace_id,
            transaction_id=uuid4().hex,
            span_id=span_id,
            parent_span_id=parent_span_id,
            timestamp=ts,
            transaction="foo",
            duration=60_100,
            exclusive_time=60_100,
            sdk_name="sentry.javascript.node",
            op="pageload",
        )

        timestamp = int(ts.timestamp() * 1000)

        query = {
            "project": [],
            "field": ["id", "parent_span", "span.duration"],
            "query": "",
            "maxSpansPerTrace": 3,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

        assert response.data["data"] == [
            {
                "breakdowns": [
                    {
                        "duration": 60_100,
                        "start": timestamp,
                        "end": timestamp + 60_100,
                        "sliceStart": 0,
                        "sliceEnd": 40,
                        "sliceWidth": 40,
                        "isRoot": False,
                        "kind": "project",
                        "project": self.project.slug,
                        "sdkName": "sentry.javascript.node",
                    },
                ],
                "duration": 60_100,
                "end": timestamp + 60_100,
                "name": "foo",
                "numErrors": 0,
                "numOccurrences": 0,
                "numSpans": 1,
                "matchingSpans": 1,
                "project": self.project.slug,
                "start": timestamp,
                "trace": trace_id,
                "rootDuration": 60_100,
            },
        ]

    def test_use_separate_referrers(self):
        from sentry.api.endpoints.organization_traces import TracesExecutor
        from sentry.snuba.referrer import Referrer
        from sentry.utils.snuba import _snuba_query

        now = before_now().replace(hour=0, minute=0, second=0, microsecond=0)
        start = now - timedelta(days=2)
        end = now - timedelta(days=1)
        trace_id = uuid4().hex

        with (
            patch.object(
                TracesExecutor,
                "get_traces_matching_conditions",
                return_value=(start, end, trace_id),
            ),
            patch("sentry.utils.snuba._snuba_query", wraps=_snuba_query) as mock_snuba_query,
        ):
            query = {
                "project": [self.project.id],
                "field": ["id", "parent_span", "span.duration"],
            }

            response = self.do_request(query)
            assert response.status_code == 200, response.data

            actual_referrers = {
                call[0][0][2].headers["referer"] for call in mock_snuba_query.call_args_list
            }

        assert {
            Referrer.API_TRACE_EXPLORER_TRACES_BREAKDOWNS.value,
            Referrer.API_TRACE_EXPLORER_TRACES_META.value,
            Referrer.API_TRACE_EXPLORER_TRACES_ERRORS.value,
            Referrer.API_TRACE_EXPLORER_TRACES_OCCURRENCES.value,
        } == actual_referrers

    def test_matching_tag(self):
        (
            project_1,
            project_2,
            trace_id_1,
            trace_id_2,
            _,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        for q in [
            ["foo:[bar, baz]"],
            ["foo:bar span.duration:>10s", "foo:baz"],
            [
                "(foo:bar AND span.duration:>10s) OR (foo:bar AND span.duration:<10m)",
                "foo:baz",
            ],
        ]:
            for features in [
                None,  # use the default features
                ["organizations:performance-trace-explorer"],
            ]:
                query = {
                    # only query for project_2 but expect traces to start from project_1
                    "project": [project_2.id],
                    "field": ["id", "parent_span", "span.duration"],
                    "query": q,
                    "maxSpansPerTrace": 4,
                }

                response = self.do_request(query, features=features)
                assert response.status_code == 200, response.data

                assert response.data["meta"] == {
                    "dataset": "unknown",
                    "datasetReason": "unchanged",
                    "fields": {},
                    "isMetricsData": False,
                    "isMetricsExtractedData": False,
                    "tips": {},
                    "units": {},
                }

                result_data = sorted(response.data["data"], key=lambda trace: trace["duration"])

                assert result_data == [
                    {
                        "trace": trace_id_1,
                        "numErrors": 1,
                        "numOccurrences": 0,
                        "numSpans": 4,
                        "matchingSpans": 3,
                        "project": project_1.slug,
                        "name": "foo",
                        "duration": 60_100,
                        "start": timestamps[0],
                        "end": timestamps[0] + 60_100,
                        "rootDuration": 60_100,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "sdkName": "sentry.javascript.node",
                                "isRoot": False,
                                "start": timestamps[0],
                                "end": timestamps[0] + 60_100,
                                "sliceStart": 0,
                                "sliceEnd": 40,
                                "sliceWidth": 40,
                                "kind": "project",
                                "duration": 60_100,
                            },
                            {
                                "project": project_2.slug,
                                "sdkName": "sentry.javascript.node",
                                "isRoot": False,
                                "start": timestamps[1] + 522,
                                "end": timestamps[3] + 30_003 + 61,
                                "sliceStart": 11,
                                "sliceEnd": 32,
                                "sliceWidth": 21,
                                "kind": "project",
                                "duration": timestamps[3] - timestamps[1] + 30_003,
                            },
                        ],
                    },
                    {
                        "trace": trace_id_2,
                        "numErrors": 0,
                        "numOccurrences": 0,
                        "numSpans": 6,
                        "matchingSpans": 2,
                        "project": project_1.slug,
                        "name": "bar",
                        "duration": 90_123,
                        "start": timestamps[4],
                        "end": timestamps[4] + 90_123,
                        "rootDuration": 90_123,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "sdkName": "sentry.javascript.node",
                                "isRoot": False,
                                "start": timestamps[4],
                                "end": timestamps[4] + 90_123,
                                "sliceStart": 0,
                                "sliceEnd": 40,
                                "sliceWidth": 40,
                                "kind": "project",
                                "duration": 90_123,
                            },
                            {
                                "project": project_2.slug,
                                "sdkName": "sentry.javascript.node",
                                "isRoot": False,
                                "start": timestamps[5] - 988,
                                "end": timestamps[6] + 20_006 + 536,
                                "sliceStart": 4,
                                "sliceEnd": 14,
                                "sliceWidth": 10,
                                "kind": "project",
                                "duration": timestamps[6] - timestamps[5] + 20_006,
                            },
                        ],
                    },
                ]

    def test_matching_tag_metrics(self):
        (
            project_1,
            _,
            _,
            _,
            trace_id_3,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        for mri, op in [
            (TransactionMRI.DURATION.value, "count"),
            ("d:transactions/measurements.lcp@millisecond", "max"),
            (SpanMRI.DURATION.value, "min"),
            (SpanMRI.SELF_TIME.value, "avg"),
            ("d:spans/webvital.score.total@ratio", "count"),
            ("d:spans/webvital.score.inp@ratio", "max"),
            ("d:spans/webvital.score.weight.inp@ratio", "min"),
            ("d:spans/http.response_content_length@byte", "avg"),
            ("d:spans/http.decoded_response_content_length@byte", "count"),
            ("d:spans/http.response_transfer_size@byte", "max"),
            ("d:custom/value@millisecond", "min"),
        ]:
            for user_query in ["foo:qux", None]:
                query = {
                    "mri": mri,
                    "metricsMin": 30_000,
                    "metricsMax": 50_000,
                    "metricsOp": op,
                    "metricsQuery": ["foo:qux"],
                    "project": [],
                    "field": ["id", "parent_span", "span.duration"],
                    "maxSpansPerTrace": 3,
                    "per_page": 1,
                }
                if user_query:
                    query["query"] = user_query

                response = self.do_request(query)
                assert response.status_code == 200, (mri, response.data)

                result_data = sorted(response.data["data"], key=lambda trace: trace["trace"])

                assert result_data == [
                    {
                        "trace": trace_id_3,
                        "numErrors": 0,
                        "numOccurrences": 0,
                        "numSpans": 2,
                        "matchingSpans": 1 if user_query else 2,
                        "project": project_1.slug,
                        "name": "qux",
                        "duration": 40_000,
                        "start": timestamps[10],
                        "end": timestamps[10] + 40_000,
                        "rootDuration": 40_000,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "sdkName": "sentry.javascript.remix",
                                "isRoot": False,
                                "start": timestamps[10],
                                "end": timestamps[10] + 40_000,
                                "sliceStart": 0,
                                "sliceEnd": 40,
                                "sliceWidth": 40,
                                "kind": "project",
                                "duration": 40_000,
                            },
                            {
                                "project": project_1.slug,
                                "sdkName": "sentry.javascript.node",
                                "isRoot": False,
                                "start": timestamps[11],
                                "end": timestamps[11] + 10_000,
                                "sliceStart": 10,
                                "sliceEnd": 20,
                                "sliceWidth": 10,
                                "kind": "project",
                                "duration": 10_000,
                            },
                        ],
                    },
                ], (mri, user_query)

    def test_matching_tag_metrics_but_no_matching_spans(self):
        for mri in [
            TransactionMRI.DURATION.value,
            "d:transactions/measurements.lcp@millisecond",
            SpanMRI.DURATION.value,
            SpanMRI.SELF_TIME.value,
            "d:spans/webvital.score.total@ratio",
            "d:spans/webvital.score.inp@ratio",
            "d:spans/webvital.score.weight.inp@ratio",
            "d:spans/http.response_content_length@byte",
            "d:spans/http.decoded_response_content_length@byte",
            "d:spans/http.response_transfer_size@byte",
            "d:custom/value@millisecond",
        ]:
            for user_query in ["foo:qux", None]:
                query = {
                    "mri": mri,
                    "metricsQuery": ["foo:qux"],
                    "project": [self.project.id],
                    "field": ["id", "parent_span", "span.duration"],
                    "query": "foo:foobar",
                    "maxSpansPerTrace": 3,
                }

                response = self.do_request(query)
                assert response.status_code == 200, (mri, response.data)
                assert response.data == {
                    "data": [],
                    "meta": {
                        "dataset": "unknown",
                        "datasetReason": "unchanged",
                        "fields": {},
                        "isMetricsData": False,
                        "isMetricsExtractedData": False,
                        "tips": {},
                        "units": {},
                    },
                }


class OrganizationTraceSpansEndpointTest(OrganizationTracesEndpointTestBase):
    view = "sentry-api-0-organization-trace-spans"

    def do_request(self, trace_id, query, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer", "organizations:global-views"]

        if self.is_eap:
            if query is None:
                query = {}
            query["dataset"] = "spans"

        with self.feature(features):
            return self.client.get(
                reverse(
                    self.view,
                    kwargs={
                        "organization_id_or_slug": self.organization.slug,
                        "trace_id": trace_id,
                    },
                ),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self):
        query = {
            "project": [self.project.id],
        }
        response = self.do_request(uuid4().hex, query, features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request(uuid4().hex, {})
        assert response.status_code == 404, response.data

    def test_bad_params_missing_field(self):
        query = {
            "project": [self.project.id],
        }
        response = self.do_request(uuid4().hex, query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "field": [
                ErrorDetail(string="This field is required.", code="required"),
            ],
        }

    def test_get_spans_for_trace(self):
        (
            project_1,
            project_2,
            trace_id,
            _,
            _,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        query = {
            "project": [],
            "field": ["id"],
            "sort": "id",
        }

        response = self.do_request(trace_id, query)
        assert response.status_code == 200, response.data
        assert response.data["meta"] == {
            "dataset": "unknown",
            "datasetReason": "unchanged",
            "fields": {
                "id": "string",
            },
            "isMetricsData": False,
            "isMetricsExtractedData": False,
            "tips": {},
            "units": {
                "id": None,
            },
        }
        assert response.data["data"] == [{"id": span_id} for span_id in sorted(span_ids[:4])]

    def test_get_spans_for_trace_matching_tags(self):
        (
            project_1,
            project_2,
            trace_id,
            _,
            _,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        for user_query in [
            ["foo:bar", "foo:baz"],
            ["foo:[bar, baz]"],
        ]:
            query = {
                "project": [],
                "field": ["id"],
                "sort": "id",
                "query": user_query,
            }

            response = self.do_request(trace_id, query)
            assert response.status_code == 200, response.data
            assert response.data["meta"] == {
                "dataset": "unknown",
                "datasetReason": "unchanged",
                "fields": {
                    "id": "string",
                },
                "isMetricsData": False,
                "isMetricsExtractedData": False,
                "tips": {},
                "units": {
                    "id": None,
                },
            }
            assert response.data["data"] == [{"id": span_id} for span_id in sorted(span_ids[1:4])]

    def test_get_spans_for_trace_matching_tags_metrics(self):
        (
            project_1,
            project_2,
            _,
            _,
            trace_id,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        for mri, op in [
            (TransactionMRI.DURATION.value, "count"),
            ("d:transactions/measurements.lcp@millisecond", "max"),
            (SpanMRI.DURATION.value, "min"),
            (SpanMRI.SELF_TIME.value, "avg"),
            ("d:spans/webvital.score.total@ratio", "count"),
            ("d:spans/webvital.score.inp@ratio", "max"),
            ("d:spans/webvital.score.weight.inp@ratio", "min"),
            ("d:spans/http.response_content_length@byte", "avg"),
            ("d:spans/http.decoded_response_content_length@byte", "count"),
            ("d:spans/http.response_transfer_size@byte", "max"),
            ("d:custom/value@millisecond", "min"),
        ]:
            for user_query in ["foo:qux", None]:
                query = {
                    "mri": mri,
                    "metricsMin": 30_000,
                    "metricsMax": 50_000,
                    "metricsOp": op,
                    "metricsQuery": ["foo:qux"],
                    "project": [],
                    "field": ["id"],
                    "sort": "id",
                }
                if user_query:
                    query["query"] = user_query

                response = self.do_request(trace_id, query)
                assert response.status_code == 200, response.data
                assert response.data["meta"] == {
                    "dataset": "unknown",
                    "datasetReason": "unchanged",
                    "fields": {
                        "id": "string",
                    },
                    "isMetricsData": False,
                    "isMetricsExtractedData": False,
                    "tips": {},
                    "units": {
                        "id": None,
                    },
                }
                assert response.data["data"] == [{"id": span_ids[10]}]


class OrganizationTracesStatsEndpointTest(OrganizationTracesEndpointTestBase):
    view = "sentry-api-0-organization-traces-stats"

    def do_request(self, query, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer", "organizations:global-views"]

        if self.is_eap:
            if query is None:
                query = {}
            query["dataset"] = "spans"

        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_id_or_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self):
        response = self.do_request({}, features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request({})
        assert response.status_code == 404, response.data

    def test_bad_params_missing_y_axis(self):
        response = self.do_request(
            {
                "project": [self.project.id],
            }
        )
        assert response.status_code == 400, response.data
        assert response.data == {
            "yAxis": [
                ErrorDetail(string="This field is required.", code="required"),
            ],
        }

    def test_span_duration_filter(self):
        for q in [
            ["span.duration:>100"],
        ]:
            query = {
                "yAxis": ["count()"],
                "query": q,
                "project": [self.project.id],
            }

            response = self.do_request(query)
            assert response.status_code == 200, response.data

    def test_stats(self):
        project_1 = self.create_project()
        project_2 = self.create_project()

        timestamp = before_now()
        timestamp = timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
        timestamp = timestamp - timedelta(minutes=10)

        self.double_write_segment(
            project=project_1,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            timestamp=timestamp,
            transaction="foo",
            duration=100,
            exclusive_time=100,
        )

        self.double_write_segment(
            project=project_1,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            timestamp=timestamp,
            transaction="bar",
            duration=100,
            exclusive_time=100,
        )

        self.double_write_segment(
            project=project_2,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            timestamp=timestamp,
            transaction="bar",
            duration=100,
            exclusive_time=100,
        )

        for q in [
            [f"project:{project_1.slug}"],
            [
                f"project:{project_1.slug} transaction:bar",
                f"project:{project_2.slug} transaction:bar",
            ],
        ]:
            query = {
                "yAxis": ["count()"],
                "query": q,
                "project": [],
            }

            response = self.do_request(query)
            assert response.status_code == 200, response.data

        if self.is_eap:
            # When using EAP, this is extrapolated
            assert sum(bucket[0]["count"] for _, bucket in response.data["data"]) == 20
        else:
            assert sum(bucket[0]["count"] for _, bucket in response.data["data"]) == 2


@pytest.mark.parametrize(
    ["data", "traces_range", "expected"],
    [
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100, 10)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": False,
                    },
                ],
            },
            id="single transaction",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 100, 20)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 20,
                        "sliceWidth": 20,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 25,
                        "end": 75,
                        "sliceStart": 5,
                        "sliceEnd": 15,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                ],
            },
            id="two transactions different project nested",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.075,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "baz1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100, 20)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 50,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 25,
                        "end": 75,
                        "sliceStart": 5,
                        "sliceEnd": 15,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                    {
                        "project": "baz",
                        "sdkName": "sentry.javascript.node",
                        "start": 50,
                        "end": 100,
                        "sliceStart": 10,
                        "sliceEnd": 20,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                ],
            },
            id="three transactions different project overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.025,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 75, 15)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 25,
                        "sliceStart": 0,
                        "sliceEnd": 5,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 25,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 50,
                        "end": 75,
                        "sliceStart": 10,
                        "sliceEnd": 15,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 25,
                        "isRoot": False,
                    },
                ],
            },
            id="two transactions different project non overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo2",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 100, 10)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": False,
                    },
                ],
            },
            id="two transactions same project nested",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.075,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo2",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100, 10)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": False,
                    },
                ],
            },
            id="two transactions same project overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.025,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo2",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 75, 15)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 25,
                        "sliceStart": 0,
                        "sliceEnd": 5,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 25,
                        "isRoot": False,
                    },
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 50,
                        "end": 75,
                        "sliceStart": 10,
                        "sliceEnd": 15,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 25,
                        "isRoot": False,
                    },
                ],
            },
            id="two transactions same project non overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.02,
                    "precise.finish_ts": 0.08,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "baz1",
                    "precise.start_ts": 0.04,
                    "precise.finish_ts": 0.06,
                },
            ],
            {"a" * 32: (0, 100, 10)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 20,
                        "end": 80,
                        "sliceStart": 2,
                        "sliceEnd": 8,
                        "sliceWidth": 6,
                        "kind": "project",
                        "duration": 60,
                        "isRoot": False,
                    },
                    {
                        "project": "baz",
                        "sdkName": "sentry.javascript.node",
                        "start": 40,
                        "end": 60,
                        "sliceStart": 4,
                        "sliceEnd": 6,
                        "sliceWidth": 2,
                        "kind": "project",
                        "duration": 20,
                        "isRoot": False,
                    },
                ],
            },
            id="three transactions different project nested",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "project": "baz",
                    "transaction": "baz1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 100, 20)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 20,
                        "sliceWidth": 20,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 25,
                        "end": 50,
                        "sliceStart": 5,
                        "sliceEnd": 10,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 25,
                        "isRoot": False,
                    },
                    {
                        "project": "baz",
                        "sdkName": "sentry.javascript.node",
                        "start": 50,
                        "end": 75,
                        "sliceStart": 10,
                        "sliceEnd": 15,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 25,
                        "isRoot": False,
                    },
                ],
            },
            id="three transactions different project 2 overlap the first",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.02,
                    "precise.finish_ts": 0.03,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "baz1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 75, 15)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 50,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 20,
                        "end": 30,
                        "sliceStart": 4,
                        "sliceEnd": 6,
                        "sliceWidth": 2,
                        "kind": "project",
                        "duration": 10,
                        "isRoot": False,
                    },
                    {
                        "project": "baz",
                        "sdkName": "sentry.javascript.node",
                        "start": 50,
                        "end": 75,
                        "sliceStart": 10,
                        "sliceEnd": 15,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 25,
                        "isRoot": False,
                    },
                ],
            },
            id="three transactions different project 1 overlap the first and other non overlap",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.02,
                    "precise.finish_ts": 0.03,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "baz1",
                    "precise.start_ts": 0.04,
                    "precise.finish_ts": 0.06,
                },
            ],
            {"a" * 32: (0, 60, 6)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 50,
                        "sliceStart": 0,
                        "sliceEnd": 5,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 20,
                        "end": 30,
                        "sliceStart": 2,
                        "sliceEnd": 3,
                        "sliceWidth": 1,
                        "kind": "project",
                        "duration": 10,
                        "isRoot": False,
                    },
                    {
                        "project": "baz",
                        "sdkName": "sentry.javascript.node",
                        "start": 40,
                        "end": 60,
                        "sliceStart": 4,
                        "sliceEnd": 6,
                        "sliceWidth": 2,
                        "kind": "project",
                        "duration": 20,
                        "isRoot": False,
                    },
                ],
            },
            id="three transactions different project 2 overlap and second extend past parent",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.01,
                    "precise.finish_ts": 0.02,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.03,
                    "precise.finish_ts": 0.04,
                },
            ],
            {"a" * 32: (0, 50, 10)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 50,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 10,
                        "end": 20,
                        "sliceStart": 2,
                        "sliceEnd": 4,
                        "sliceWidth": 2,
                        "kind": "project",
                        "duration": 10,
                        "isRoot": False,
                    },
                ],
            },
            id="three transactions same project with another project between",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 50, 5)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 50,
                        "sliceStart": 0,
                        "sliceEnd": 5,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                ],
            },
            id="clips intervals to be within trace",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
            ],
            {"a" * 32: (0, 100, 5)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 40,
                        "sliceStart": 0,
                        "sliceEnd": 2,
                        "sliceWidth": 2,
                        "kind": "project",
                        "duration": 50,
                        "isRoot": False,
                    },
                ],
            },
            id="adds other interval at end",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.012,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.013,
                    "precise.finish_ts": 0.024,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.032,
                    "precise.finish_ts": 0.040,
                },
            ],
            {"a" * 32: (0, 40, 4)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 20,
                        "sliceStart": 0,
                        "sliceEnd": 2,
                        "sliceWidth": 2,
                        "kind": "project",
                        "duration": 23,
                        "isRoot": False,
                    },
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 30,
                        "end": 40,
                        "sliceStart": 3,
                        "sliceEnd": 4,
                        "sliceWidth": 1,
                        "kind": "project",
                        "duration": 8,
                        "isRoot": False,
                    },
                ],
            },
            id="merge quantized spans",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.002,
                    "precise.finish_ts": 0.044,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.007,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100, 5)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 5,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": False,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 40,
                        "sliceStart": 0,
                        "sliceEnd": 2,
                        "sliceWidth": 2,
                        "kind": "project",
                        "duration": 42,
                        "isRoot": False,
                    },
                ],
            },
            id="resorts spans after quantizing",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.051,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.069,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100, 5)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 5,
                        "sliceWidth": 5,
                        "kind": "project",
                        "duration": 82,
                        "isRoot": False,
                    },
                ],
            },
            id="merges nearby spans",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.remix",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar",
                    "precise.start_ts": 0.02,
                    "precise.finish_ts": 0.06,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.remix",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.03,
                    "precise.finish_ts": 0.07,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "bar1",
                    "precise.start_ts": 0.04,
                    "precise.finish_ts": 0.08,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.remix",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.07,
                },
            ],
            {"a" * 32: (0, 100, 10)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.remix",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 100,
                        "isRoot": True,
                    },
                    {
                        "project": "bar",
                        "sdkName": "sentry.javascript.node",
                        "start": 20,
                        "end": 80,
                        "sliceStart": 2,
                        "sliceEnd": 8,
                        "sliceWidth": 6,
                        "kind": "project",
                        "duration": 60,
                        "isRoot": False,
                    },
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.remix",
                        "start": 30,
                        "end": 70,
                        "sliceStart": 3,
                        "sliceEnd": 7,
                        "sliceWidth": 4,
                        "kind": "project",
                        "duration": 40,
                        "isRoot": False,
                    },
                ],
            },
            id="merges spans at different depths",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.003,
                    "precise.finish_ts": 0.097,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.remix",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.002,
                    "precise.finish_ts": 0.098,
                },
            ],
            {"a" * 32: (0, 100, 10)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.remix",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 96,
                        "isRoot": False,
                    },
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 100,
                        "sliceStart": 0,
                        "sliceEnd": 10,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": 94,
                        "isRoot": False,
                    },
                ],
            },
            id="orders spans by precise timestamps",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.003,
                    "precise.finish_ts": 0.097,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.remix",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.002,
                    "precise.finish_ts": 0.098,
                },
            ],
            {"a" * 32: (0, 100, 1000)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.remix",
                        "start": 2,
                        "end": 98,
                        "sliceStart": 20,
                        "sliceEnd": 980,
                        "sliceWidth": 960,
                        "kind": "project",
                        "duration": 96,
                        "isRoot": False,
                    },
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 3,
                        "end": 97,
                        "sliceStart": 30,
                        "sliceEnd": 970,
                        "sliceWidth": 940,
                        "kind": "project",
                        "duration": 94,
                        "isRoot": False,
                    },
                ],
            },
            id="trace shorter than slices",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 1,
                    "precise.finish_ts": 1,
                },
            ],
            {"a" * 32: (1, 1, 40)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 1,
                        "end": 1,
                        "sliceStart": 0,
                        "sliceEnd": 40,
                        "sliceWidth": 40,
                        "kind": "project",
                        "duration": 0,
                        "isRoot": False,
                    },
                ],
            },
            id="zero duration trace",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.remix",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.0,
                    "precise.finish_ts": 0.04,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.000,
                    "precise.finish_ts": 0.001,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.029,
                    "precise.finish_ts": 0.031,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "sdk.name": "sentry.javascript.node",
                    "parent_span": "a" * 16,
                    "transaction": "foo1",
                    "precise.start_ts": 0.039,
                    "precise.finish_ts": 0.040,
                },
            ],
            {"a" * 32: (0, 40, 4)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.remix",
                        "start": 0,
                        "end": 40,
                        "sliceStart": 0,
                        "sliceEnd": 4,
                        "sliceWidth": 4,
                        "kind": "project",
                        "duration": 40,
                        "isRoot": False,
                    },
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 0,
                        "end": 10,
                        "sliceStart": 0,
                        "sliceEnd": 1,
                        "sliceWidth": 1,
                        "kind": "project",
                        "duration": 1,
                        "isRoot": False,
                    },
                    {
                        "project": "foo",
                        "sdkName": "sentry.javascript.node",
                        "start": 30,
                        "end": 40,
                        "sliceStart": 3,
                        "sliceEnd": 4,
                        "sliceWidth": 1,
                        "kind": "project",
                        "duration": 2,
                        "isRoot": False,
                    },
                ],
            },
            id="expand narrow slice",
        ),
    ],
)
def test_process_breakdowns(data, traces_range, expected):
    traces_range = {
        trace: {
            "start": trace_start,
            "end": trace_end,
            "slices": trace_slices,
        }
        for trace, (trace_start, trace_end, trace_slices) in traces_range.items()
    }
    result = process_breakdowns(data, traces_range)
    assert result == expected


@patch("sentry_sdk.capture_exception")
@patch("sentry.api.endpoints.organization_traces.quantize_range")
def test_quantize_range_error(mock_quantize_range, mock_capture_exception):
    exception = Exception()

    mock_quantize_range.side_effect = exception

    data = [
        {
            "trace": "a" * 32,
            "project": "foo",
            "sdk.name": "sentry.javascript.node",
            "parent_span": "a" * 16,
            "transaction": "foo1",
            "precise.start_ts": 0,
            "precise.finish_ts": 0.1,
        },
    ]
    traces_range = {
        "a"
        * 32: {
            "start": 0,
            "end": 100,
            "slices": 0,
        }
    }
    result = process_breakdowns(data, traces_range)
    assert result == {"a" * 32: []}

    mock_capture_exception.assert_called_with(
        exception, contexts={"bad_trace": {"trace": "a" * 32}}
    )


@patch("sentry_sdk.capture_exception")
@patch("sentry.api.endpoints.organization_traces.new_trace_interval")
def test_build_breakdown_error(mock_new_trace_interval, mock_capture_exception):
    exception = Exception()

    mock_new_trace_interval.side_effect = exception

    data = [
        {
            "trace": "a" * 32,
            "project": "foo",
            "sdk.name": "sentry.javascript.node",
            "parent_span": "a" * 16,
            "transaction": "foo1",
            "precise.start_ts": 0,
            "precise.finish_ts": 0.1,
        },
    ]
    traces_range = {
        "a"
        * 32: {
            "start": 0,
            "end": 100,
            "slices": 10,
        }
    }
    result = process_breakdowns(data, traces_range)
    assert result == {"a" * 32: []}

    mock_capture_exception.assert_called_with(
        exception, contexts={"bad_trace": {"trace": "a" * 32}}
    )


class OrganizationTracesEAPEndpointTest(OrganizationTracesEndpointTest):
    is_eap: bool = True

    @pytest.mark.skip(reason="no support for metrics so not back porting this feature")
    def test_matching_tag_metrics(self):
        pass

    def test_invalid_sort(self):
        for sort in ["foo", "-foo"]:
            query = {
                "project": [self.project.id],
                "field": ["id", "parent_span"],
                "sort": sort,
            }

            response = self.do_request(query)
            assert response.status_code == 400, response.data
            assert response.data == {
                "detail": ErrorDetail(string=f"Unsupported sort: {sort}", code="parse_error"),
            }

    def test_sort_by_timestamp(self):
        (
            project_1,
            project_2,
            trace_id_1,
            trace_id_2,
            _,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        expected = [
            {
                "trace": trace_id_1,
                "numErrors": 1,
                "numOccurrences": 0,
                "numSpans": 4,
                "matchingSpans": 3,
                "project": project_1.slug,
                "name": "foo",
                "duration": 60_100,
                "start": timestamps[0],
                "end": timestamps[0] + 60_100,
                "rootDuration": 60_100,
                "breakdowns": [
                    {
                        "project": project_1.slug,
                        "sdkName": "sentry.javascript.node",
                        "isRoot": False,
                        "start": timestamps[0],
                        "end": timestamps[0] + 60_100,
                        "sliceStart": 0,
                        "sliceEnd": 40,
                        "sliceWidth": 40,
                        "kind": "project",
                        "duration": 60_100,
                    },
                    {
                        "project": project_2.slug,
                        "sdkName": "sentry.javascript.node",
                        "isRoot": False,
                        "start": timestamps[1] + 522,
                        "end": timestamps[3] + 30_003 + 61,
                        "sliceStart": 11,
                        "sliceEnd": 32,
                        "sliceWidth": 21,
                        "kind": "project",
                        "duration": timestamps[3] - timestamps[1] + 30_003,
                    },
                ],
            },
            {
                "trace": trace_id_2,
                "numErrors": 0,
                "numOccurrences": 0,
                "numSpans": 6,
                "matchingSpans": 2,
                "project": project_1.slug,
                "name": "bar",
                "duration": 90_123,
                "start": timestamps[4],
                "end": timestamps[4] + 90_123,
                "rootDuration": 90_123,
                "breakdowns": [
                    {
                        "project": project_1.slug,
                        "sdkName": "sentry.javascript.node",
                        "isRoot": False,
                        "start": timestamps[4],
                        "end": timestamps[4] + 90_123,
                        "sliceStart": 0,
                        "sliceEnd": 40,
                        "sliceWidth": 40,
                        "kind": "project",
                        "duration": 90_123,
                    },
                    {
                        "project": project_2.slug,
                        "sdkName": "sentry.javascript.node",
                        "isRoot": False,
                        "start": timestamps[5] - 988,
                        "end": timestamps[6] + 20_006 + 536,
                        "sliceStart": 4,
                        "sliceEnd": 14,
                        "sliceWidth": 10,
                        "kind": "project",
                        "duration": timestamps[6] - timestamps[5] + 20_006,
                    },
                ],
            },
        ]

        for descending in [False, True]:
            for q in [
                ["foo:[bar, baz]"],
                ["foo:bar span.duration:>10s", "foo:baz"],
            ]:
                expected = sorted(
                    expected,
                    key=lambda trace: trace["start"],
                    reverse=descending,
                )

                query = {
                    # only query for project_2 but expect traces to start from project_1
                    "project": [str(project_2.id)],
                    "field": ["id", "parent_span", "span.duration"],
                    "query": q,
                    "sort": "-timestamp" if descending else "timestamp",
                    "per_page": "1",
                }
                response = self.do_request(query)
                assert response.status_code == 200, response.data
                assert response.data["data"] == [expected[0]]

                links = parse_link_header(response.headers["Link"])
                prev_link = next(link for link in links.values() if link["rel"] == "previous")
                assert prev_link["results"] == "false"
                next_link = next(link for link in links.values() if link["rel"] == "next")
                assert next_link["results"] == "true"
                assert next_link["cursor"]

                query = {
                    # only query for project_2 but expect traces to start from project_1
                    "project": [str(project_2.id)],
                    "field": ["id", "parent_span", "span.duration"],
                    "query": q,
                    "sort": "-timestamp" if descending else "timestamp",
                    "per_page": "1",
                    "cursor": next_link["cursor"],
                }
                response = self.do_request(query)
                assert response.status_code == 200, response.data
                assert response.data["data"] == [expected[1]]

                links = parse_link_header(response.headers["Link"])
                prev_link = next(link for link in links.values() if link["rel"] == "previous")
                assert prev_link["results"] == "true"
                next_link = next(link for link in links.values() if link["rel"] == "next")
                assert next_link["results"] == "false"


class OrganizationTraceSpansEAPEndpointTest(OrganizationTraceSpansEndpointTest):
    is_eap: bool = True

    @pytest.mark.skip(reason="no support for metrics so not back porting this feature")
    def test_get_spans_for_trace_matching_tags_metrics(self):
        pass


class OrganizationTracesStatsEAPEndpointTest(OrganizationTracesStatsEndpointTest):
    is_eap: bool = True
