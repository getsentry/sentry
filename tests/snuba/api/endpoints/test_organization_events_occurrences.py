import uuid
from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.response import Response

from sentry.models.group import Group
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import OccurrenceTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)


class OrganizationEventsOccurrencesDatasetEndpointTest(
    OrganizationEventsEndpointTestBase, OccurrenceTestCase
):
    callsite_name = "api.events.endpoints"

    def setUp(self) -> None:
        super().setUp()

    def request_with_feature_flag(self, payload: dict) -> Response:
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request({**payload, "dataset": "occurrences"})
        assert response.status_code == 200, response.content
        return response

    def test_simple(self) -> None:
        event_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        group = self.create_group(project=self.project)
        occ = self.create_eap_occurrence(
            event_id=event_id,
            group_id=group.id,
            trace_id=trace_id,
            attributes={
                "fingerprint": ["group1"],
            },
            project=self.project,
        )
        self.store_eap_items([occ])

        response = self.request_with_feature_flag(
            {
                "field": ["id", "group_id", "trace"],
                "project": [self.project.id],
            }
        )
        assert len(response.data["data"]) == 1
        row = response.data["data"][0]
        assert row["id"] == event_id
        assert row["trace"] == trace_id
        assert row["group_id"] == group.id

    def test_group_id(self) -> None:
        event_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        group = self.create_group(project=self.project)
        occ = self.create_eap_occurrence(
            event_id=event_id,
            group_id=group.id,
            trace_id=trace_id,
            attributes={
                "fingerprint": ["group1"],
            },
            project=self.project,
        )
        self.store_eap_items([occ])

        response = self.request_with_feature_flag(
            {
                "field": ["count()", "group_id"],
                "statsPeriod": "1h",
                "query": f"project:{group.project.slug} group_id:{group.id}",
            }
        )

        assert response.data["data"][0]["count()"] == 1

    def _request_table_rate(self, field: str):
        """Store two occurrences in a 2h window and request /events/ with the given rate field."""
        group = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                group_id=group.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
        ]
        self.store_eap_items(occurrences)
        return self.request_with_feature_flag(
            {
                "field": [field],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )

    def test_eps_rate_aggregate(self) -> None:
        # 2 events / 7200 seconds (2h).
        response = self._request_table_rate("eps()")
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["eps()"] == pytest.approx(2 / 7200, abs=0.0001)
        meta = response.data["meta"]
        assert meta["fields"]["eps()"] == "rate"
        assert meta["units"]["eps()"] == "1/second"

    def test_epm_rate_aggregate(self) -> None:
        # 2 events / (7200/60) = 2/120 per minute.
        response = self._request_table_rate("epm()")
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["epm()"] == pytest.approx(2 / (7200 / 60), abs=0.001)
        meta = response.data["meta"]
        assert meta["fields"]["epm()"] == "rate"
        assert meta["units"]["epm()"] == "1/minute"

    def test_count_unique(self) -> None:
        group = self.create_group(project=self.project)
        self.store_eap_items(
            [
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    level="error",
                    attributes={"fingerprint": ["a"]},
                ),
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    level="error",
                    attributes={"fingerprint": ["b"]},
                ),
            ]
        )
        response = self.request_with_feature_flag(
            {
                "field": ["count()", "count_unique(level)"],
                "statsPeriod": "1h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 2
        assert data[0]["count_unique(level)"] == 1

    def test_count_if(
        self,
    ) -> None:
        group = self.create_group(project=self.project)
        for _ in range(3):
            self.store_eap_items(
                [
                    self.create_eap_occurrence(
                        group_id=group.id,
                        project=self.project,
                        level="error",
                        attributes={"fingerprint": ["x"]},
                    )
                ]
            )
        for _ in range(2):
            self.store_eap_items(
                [
                    self.create_eap_occurrence(
                        group_id=group.id,
                        project=self.project,
                        level="warning",
                        attributes={"fingerprint": ["x"]},
                    )
                ]
            )

        response = self.request_with_feature_flag(
            {
                "field": [
                    "count()",
                    "count_if(level,equals,error)",
                    "count_if(level,notEquals,error)",
                ],
                "statsPeriod": "1h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 5
        assert data[0]["count_if(level,equals,error)"] == 3
        assert data[0]["count_if(level,notEquals,error)"] == 2

    def test_last_seen_table(
        self,
    ) -> None:
        group = self.create_group(project=self.project)
        base = before_now(hours=1)
        self.store_eap_items(
            [
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    timestamp=base,
                    attributes={"fingerprint": ["a"]},
                ),
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    timestamp=base + timedelta(minutes=10),
                    attributes={"fingerprint": ["a"]},
                ),
            ]
        )

        response = self.request_with_feature_flag(
            {
                "field": ["last_seen()"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )

        data = response.data["data"]
        assert len(data) == 1
        # EAP returns last_seen as Unix timestamp in seconds (float).
        expected_seconds = (base + timedelta(minutes=10)).timestamp()
        assert data[0]["last_seen()"] == pytest.approx(expected_seconds, abs=1)

    def test_issue_filter(self):
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]
        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "query": f"issue:{group1.qualified_short_id}",
                "field": ["group_id", "project", "project.name"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["group_id"] == group1.id

    def test_issue_filter_or_two_short_ids(self) -> None:
        """Several issue: terms should resolve via one primed bulk lookup (not one DB round-trip per OR branch)."""
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]
        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "query": (
                    f"issue:{group1.qualified_short_id} OR issue:{group2.qualified_short_id}"
                ),
                "field": ["group_id", "project", "project.name"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 2
        assert {row["group_id"] for row in data} == {group1.id, group2.id}

    def test_has_filter_on_project(self) -> None:
        group1 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]
        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "query": "has:issue",
                "field": ["group_id", "project", "project.name"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["group_id"] == group1.id

    def test_additional_query_with_logs(self) -> None:
        grp_a = self.create_group(project=self.project)
        grp_b = self.create_group(project=self.project)
        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex
        occurrences = [
            self.create_eap_occurrence(
                group_id=grp_a.id,
                project=self.project,
                tags={"foo": "five"},
                title="baz",
                trace_id=trace_id,
            ),
            self.create_eap_occurrence(
                group_id=grp_b.id,
                project=self.project,
                tags={"foo": "eight"},
                title="baz",
                trace_id=excluded_trace_id,
            ),
        ]
        logs = [
            self.create_ourlog(
                extra_data={"trace_id": trace_id, "body": "foo"},
            ),
            self.create_ourlog(
                extra_data={"trace_id": excluded_trace_id, "body": "bar"},
            ),
        ]
        self.store_eap_items(logs + occurrences)

        response = self.request_with_feature_flag(
            {
                "query": "title:baz",
                "field": ["title", "trace"],
                "project": [self.project.id],
                "logQuery": ["message:foo"],
            }
        )
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["trace"] == trace_id

    def test_sampled_vs_upsampled_eps(self):
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
                client_sample_rate=0.1,
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]

        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "field": ["eps()", "sample_eps()", "group_id"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        data = sorted(data, key=lambda x: x["group_id"])
        group1_data = data[0]
        group2_data = data[1]
        # Group1, sample rate => 0.1 => 10,
        # Group2 no sample rate.
        assert group1_data["sample_eps()"] == pytest.approx(1 / 7200, abs=0.001)
        assert group1_data["eps()"] == pytest.approx(10 / 7200, abs=0.001)

        assert group2_data["sample_eps()"] == pytest.approx(2 / 7200, abs=0.001)
        assert group2_data["eps()"] == pytest.approx(2 / 7200, abs=0.001)

        assert meta["fields"]["eps()"] == "rate"
        assert meta["units"]["eps()"] == "1/second"
        assert meta["fields"]["sample_eps()"] == "rate"
        assert meta["units"]["sample_eps()"] == "1/second"

    def test_sample_vs_upsampled_count(self):
        group1 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
                client_sample_rate=0.1,
            )
        ]

        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "field": ["count()", "sample_count()", "group_id"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 10
        assert data[0]["sample_count()"] == 1
        assert data[0]["group_id"] == group1.id

    def test_three_issue_uses_single_group_table_query(self) -> None:
        """
        Prime + cached map: resolving issue:A OR issue:B OR issue:C must not call
        by_qualified_short_id_bulk once per OR branch (each converter run).
        """
        g1 = self.create_group(project=self.project)
        g2 = self.create_group(project=self.project)
        g3 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=g1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
                client_sample_rate=0.1,
            )
        ]
        self.store_eap_items(occurrences)

        query_string = (
            f"issue:{g1.qualified_short_id} OR issue:{g2.qualified_short_id} OR "
            f"issue:{g3.qualified_short_id}"
        )
        group_table = Group._meta.db_table
        with CaptureQueriesContext(connection) as ctx:
            response = self.request_with_feature_flag(
                {
                    "field": ["count()", "sample_count()", "group_id"],
                    "query": query_string,
                    "statsPeriod": "2h",
                    "project": [self.project.id],
                }
            )
        group_sql_hits = sum(1 for q in ctx.captured_queries if group_table in q["sql"])
        assert group_sql_hits == 1, [
            q["sql"] for q in ctx.captured_queries if group_table in q["sql"]
        ]
        assert len(response.data["data"]) == 1

    def test_issues_field_in_response(self) -> None:
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]
        self.store_eap_items(occurrences)
        with CaptureQueriesContext(connection) as ctx:
            response = self.request_with_feature_flag(
                {
                    "field": ["group_id", "project", "project.name", "issue"],
                    "statsPeriod": "2h",
                    "project": [self.project.id],
                }
            )
        data = sorted(response.data["data"], key=lambda x: x["group_id"])
        assert len(data) == 2
        assert data[0]["issue"] == group1.qualified_short_id
        assert data[1]["issue"] == group2.qualified_short_id

        # Test number of postgres hits
        group_sql_hits = sum(1 for q in ctx.captured_queries if Group._meta.db_table in q["sql"])
        assert group_sql_hits == 1, [
            q["sql"] for q in ctx.captured_queries if Group._meta.db_table in q["sql"]
        ]


class OrganizationEventsOccurrencesArrayQueryTest(
    OrganizationEventsEndpointTestBase, OccurrenceTestCase
):
    callsite_name = "api.events.endpoints"

    def request_with_feature_flag(self, payload: dict) -> Response:
        # Array attributes are behind `organizations:trace-item-details-array-fields`.
        features = {
            "organizations:discover-basic": True,
            "organizations:trace-item-details-array-fields": True,
        }
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request({**payload, "dataset": "occurrences"}, features=features)
        assert response.status_code == 200, response.content
        return response

    def _create_occurrence_with_arrays(self, occurrence_count: int = 1) -> tuple[list, list[dict]]:
        occurrences = []
        expected: list[dict] = []
        for i in range(occurrence_count):
            filenames = [f"sentry/module_{i}/urls.py", f"django/views_{i}/base.py"]
            http_url = f"https://example.com/items/{i}"
            col_nums = [12 + i, i]
            in_app = True if i % 2 else False
            event_id = uuid.uuid4().hex
            trace_id = uuid.uuid4().hex
            group = self.create_group(project=self.project)
            occ = self.create_eap_occurrence(
                event_id=event_id,
                group_id=group.id,
                trace_id=trace_id,
                project=self.project,
                attributes={
                    "fingerprint": [f"exception-stack-array-{i}"],
                    "request": {"url": http_url},
                    "exception": {
                        "values": [
                            {
                                "type": "ValueError",
                                "value": "bad value",
                                "mechanism": {"type": "generic", "handled": True},
                                "stacktrace": {
                                    "frames": [
                                        {
                                            "abs_path": f"/app/{filenames[0]}",
                                            "filename": filenames[0],
                                            "module": f"sentry.module_{i}.urls",
                                            "function": "dispatch",
                                            "in_app": in_app,
                                            "lineno": 45,
                                            "colno": col_nums[0],
                                        },
                                        {
                                            "abs_path": f"/usr/lib/{filenames[1]}",
                                            "filename": filenames[1],
                                            "module": f"django.views_{i}.base",
                                            "function": "handler",
                                            "in_app": in_app,
                                            "lineno": 200,
                                            "colno": col_nums[1],
                                        },
                                    ]
                                },
                            }
                        ]
                    },
                },
                tags={"array_tags": ["eap_items", "occurrences"]},
            )
            occurrences.append(occ)
            expected.append(
                {
                    "filenames": filenames,
                    "http_url": http_url,
                    "col_nums": col_nums,
                    "event_id": event_id,
                    "group_id": group.id,
                    "in_app": in_app,
                }
            )
        self.store_eap_items(occurrences)

        return occurrences, expected

    def test_eap_occurrence_stores_exception_stack_as_array_attributes(self) -> None:
        occurrences, expected = self._create_occurrence_with_arrays(occurrence_count=1)
        occ = occurrences[0]
        expected_filenames = expected[0]["filenames"]
        expected_http_url = expected[0]["http_url"]
        expected_col_nums = expected[0]["col_nums"]
        event_id = expected[0]["event_id"]

        assert occ.attributes["http_url"].WhichOneof("value") == "string_value"
        assert occ.attributes["http_url"].string_value == expected_http_url

        assert "frame_filenames" in occ.attributes
        filenames_attr = occ.attributes["frame_filenames"]
        assert filenames_attr.WhichOneof("value") == "array_value"
        decoded_filenames = [
            v.string_value
            for v in filenames_attr.array_value.values
            if v.WhichOneof("value") == "string_value"
        ]
        assert decoded_filenames == expected_filenames

        response = self.request_with_feature_flag(
            {
                "field": ["id", "stack.filename", "http.url", "stack.colno"],
                "statsPeriod": "1h",
                "project": [self.project.id],
            }
        )
        data = response.data.get("data", [])
        assert len(data) == 1
        assert data[0]["id"] == event_id

        api_fn = data[0].get("stack.filename")
        assert api_fn == expected_filenames
        assert data[0].get("http.url") == expected_http_url
        assert data[0].get("stack.colno") == expected_col_nums

    def test_array_includes_equality_and_inequality_across_attribute_types(self) -> None:
        # Two occurrences:
        #   i=0  filenames: ["sentry/module_0/urls.py", ...]  colnos: [12, 0]  in_app: [False, False]
        #   i=1  filenames: ["sentry/module_1/urls.py", ...]  colnos: [13, 1]  in_app: [True,  True]
        # Each query below uniquely matches exactly one of the two occurrences.
        self._create_occurrence_with_arrays(occurrence_count=2)
        cases = [
            # (description, query, field, value, must_contain)
            (
                "string =",
                'stack.filename[*]:"sentry/module_0/urls.py"',
                "stack.filename",
                "sentry/module_0/urls.py",
                True,
            ),
            (
                "string !=",
                '!stack.filename[*]:"sentry/module_0/urls.py"',
                "stack.filename",
                "sentry/module_0/urls.py",
                False,
            ),
            ("number =", "stack.colno[*]:12", "stack.colno", 12, True),
            ("number !=", "!stack.colno[*]:12", "stack.colno", 12, False),
            ("boolean =", "stack.in_app[*]:true", "stack.in_app", True, True),
            ("boolean !=", "!stack.in_app[*]:true", "stack.in_app", True, False),
        ]
        for description, query, field, value, must_contain in cases:
            response = self.request_with_feature_flag(
                {
                    "field": ["id", field],
                    "query": query,
                    "statsPeriod": "1h",
                    "project": [self.project.id],
                }
            )
            data = response.data.get("data", [])
            assert len(data) == 1, (
                f"{description}: query={query!r} returned {len(data)} rows, expected 1"
            )
            array_values = [item for item in data[0][field]]
            is_present = value in array_values
            assert is_present == must_contain, (
                f"{description}: query={query!r} matched row with {field}={data[0][field]!r}; "
                f"value {value!r} present={is_present}, expected present={must_contain}"
            )

    def test_array_includes_substring_matching(self) -> None:
        # i=0  filenames: ["sentry/module_0/urls.py", "django/views_0/base.py"]
        # i=1  filenames: ["sentry/module_1/urls.py", "django/views_1/base.py"]
        self._create_occurrence_with_arrays(occurrence_count=2)
        field = "stack.filename"
        substring = "module_0"
        cases = [
            # (description, query, must_contain_substring_in_match)
            ("substring =", f"{field}[*]:*{substring}*", True),
            ("substring !=", f"!{field}[*]:*{substring}*", False),
        ]
        for description, query, must_contain in cases:
            response = self.request_with_feature_flag(
                {
                    "field": ["id", field],
                    "query": query,
                    "statsPeriod": "1h",
                    "project": [self.project.id],
                }
            )
            data = response.data.get("data", [])
            assert len(data) == 1, (
                f"{description}: query={query!r} returned {len(data)} rows, expected 1"
            )
            joined = " ".join(data[0][field])
            is_present = substring in joined
            assert is_present == must_contain, (
                f"{description}: query={query!r} matched row with {field}={data[0][field]!r}; "
                f"substring {substring!r} present={is_present}, expected present={must_contain}"
            )

    @pytest.mark.xfail(
        reason=(
            "EAP TYPE_ARRAY ComparisonFilter only accepts EQUALS / NOT_EQUALS / LIKE / NOT_LIKE. "
            "Comparison operators (>, <, >=, <=) are wired through Sentry but rejected by Snuba."
        ),
    )
    def test_array_includes_comparison_operators_for_numbers(self) -> None:
        # i=0 colnos: [12, 0]
        # i=1 colnos: [13, 1]
        self._create_occurrence_with_arrays(occurrence_count=2)
        field = "stack.colno"
        cases = [
            # (description, query, expected_count)
            (">12 (only i=1 has 13)", f"{field}[*]:>12", 1),
            ("<=0 (only i=0 has 0)", f"{field}[*]:<=0", 1),
        ]
        for description, query, expected_count in cases:
            response = self.request_with_feature_flag(
                {
                    "field": ["id", field],
                    "query": query,
                    "statsPeriod": "1h",
                    "project": [self.project.id],
                }
            )
            data = response.data.get("data", [])
            assert len(data) == expected_count, (
                f"{description}: query={query!r} returned {len(data)} rows, expected {expected_count}"
            )

    def test_array_includes_equality_and_inequality_for_tag_types(self) -> None:
        # Both occurrences share the same tag-array fixture:
        #   tags[array_tags] = ["eap_items", "occurrences"]
        self._create_occurrence_with_arrays(occurrence_count=2)
        field = "tags[array_tags, array]"
        cases = [
            # (description, query, value, expected_count, must_contain_in_each_match)
            ("present value =", f"{field}[*]:eap_items", "eap_items", 2, True),
            ("present value !=", f"!{field}[*]:eap_items", "eap_items", 0, False),
            ("absent value =", f"{field}[*]:nonexistent", "nonexistent", 0, True),
            ("absent value !=", f"!{field}[*]:nonexistent", "nonexistent", 2, False),
        ]
        for description, query, value, expected_count, must_contain in cases:
            response = self.request_with_feature_flag(
                {
                    "field": ["id", field],
                    "query": query,
                    "statsPeriod": "1h",
                    "project": [self.project.id],
                }
            )
            data = response.data.get("data", [])
            assert len(data) == expected_count, (
                f"{description}: query={query!r} returned {len(data)} rows, expected {expected_count}"
            )
            for row in data:
                array_values = [item for item in row[field]]
                is_present = value in array_values
                assert is_present == must_contain, (
                    f"{description}: query={query!r} matched row with {field}={row[field]!r}; "
                    f"value {value!r} present={is_present}, expected present={must_contain}"
                )

    def test_array_fields_dropped_when_feature_flag_off(self) -> None:
        _, expected = self._create_occurrence_with_arrays(occurrence_count=1)
        event_id = expected[0]["event_id"]
        expected_http_url = expected[0]["http_url"]

        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request(
                {
                    "field": ["id", "stack.filename", "http.url", "stack.colno"],
                    "statsPeriod": "1h",
                    "project": [self.project.id],
                    "dataset": "occurrences",
                },
            )
        assert response.status_code == 200, response.content

        data = response.data.get("data", [])
        assert len(data) == 1
        assert data[0]["id"] == event_id
        # Scalar field is still returned.
        assert data[0].get("http.url") == expected_http_url
        # Array-typed fields are silently dropped when the flag is off.
        assert "stack.filename" not in data[0]
        assert "stack.colno" not in data[0]
