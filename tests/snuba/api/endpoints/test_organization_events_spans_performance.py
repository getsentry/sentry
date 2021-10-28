import time
from datetime import timedelta

import pytest
from django.urls import reverse

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

    def suspect_span_results(self, key, event):
        if key == "sum":
            return {
                "projectId": self.project.id,
                "project": self.project.slug,
                "transaction": event.transaction,
                "op": "django.middleware",
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

        if key == "count":
            return {
                "projectId": self.project.id,
                "project": self.project.slug,
                "transaction": event.transaction,
                "op": "django.view",
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

        if key == "percentiles":
            return {
                "projectId": self.project.id,
                "project": self.project.slug,
                "transaction": event.transaction,
                "op": "http.server",
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

    def test_sort_sum(self):
        # TODO: remove this and the @pytest.skip once the config
        # is no longer necessary as this can add ~10s to the test
        self.update_snuba_config_ensure({"write_span_columns_projects": f"[{self.project.id}]"})

        event = self.create_event()

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
                self.suspect_span_results("sum", event),
                self.suspect_span_results("percentiles", event),
                self.suspect_span_results("count", event),
            ],
        )

    @pytest.mark.skip("setting snuba config is too slow")
    def test_sort_count(self):
        event = self.create_event()

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
                self.suspect_span_results("count", event),
                self.suspect_span_results("sum", event),
                self.suspect_span_results("percentiles", event),
            ],
        )

    @pytest.mark.skip("setting snuba config is too slow")
    def test_sort_percentiles(self):
        event = self.create_event()

        for sort in [
            "p50ExclusiveTime",
            "p75ExclusiveTime",
            "p95ExclusiveTime",
            "p99ExclusiveTime",
        ]:
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
                    self.suspect_span_results("percentiles", event),
                    self.suspect_span_results("sum", event),
                    self.suspect_span_results("count", event),
                ],
            )

    @pytest.mark.skip("setting snuba config is too slow")
    def test_op_filters(self):
        event = self.create_event()

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
            [self.suspect_span_results("percentiles", event)],
        )

    @pytest.mark.skip("setting snuba config is too slow")
    def test_pagination_first_page(self):
        self.create_event()

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

    @pytest.mark.skip("setting snuba config is too slow")
    def test_pagination_middle_page(self):
        self.create_event()

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

    @pytest.mark.skip("setting snuba config is too slow")
    def test_pagination_last_page(self):
        self.create_event()

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

    @pytest.mark.skip("setting snuba config is too slow")
    def test_span_group_prefixed_with_zeros(self):
        trace_context = {
            "op": "http.server",
            "hash": "00" + "ab" * 7,
            "exclusive_time": 4.0,
        }

        event = self.create_event(trace_context=trace_context)

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
        results = self.suspect_span_results("percentiles", event)
        results["group"] = "00" + "ab" * 7
        self.assert_suspect_span(response.data, [results])
