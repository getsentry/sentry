from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemsAttributesRankedEndpointTest(
    APITransactionTestCase,
    SnubaTestCase,
    SpanTestCase,
):
    view = "sentry-api-0-organization-trace-item-attributes-ranked"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:performance-spans-suspect-attributes": True,
        }
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.replace(microsecond=0).isoformat()

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-spans-suspect-attributes"]

        if query and "type" not in query.keys():
            query["type"] = "string"

        if query:
            query.setdefault("sampling", "HIGHEST_ACCURACY")

        with self.feature(features):
            response = self.client.get(
                reverse(
                    self.view,
                    kwargs={"organization_id_or_slug": self.organization.slug},
                ),
                query,
                format="json",
                **kwargs,
            )

            return response

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

    def test_no_project(self) -> None:
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == {"rankedAttributes": []}

    def test_no_feature(self) -> None:
        response = self.do_request(features=[])
        assert response.status_code == 404, response.data

    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.compare_distributions")
    def test_distribution_values(self, mock_compare_distributions) -> None:
        mock_compare_distributions.return_value = {
            "results": [
                ("sentry.device", 0.8),
                ("browser", 0.6),
            ]
        }

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

        response = self.do_request(
            query={"query_1": "span.duration:<=100", "query_2": "span.duration:>100"}
        )
        assert response.status_code == 200, response.data
        assert "cohort1Total" in response.data
        assert "cohort2Total" in response.data
        distributions = response.data["rankedAttributes"]
        attribute = next(a for a in distributions if a["attributeName"] == "sentry.device")
        assert attribute
        assert attribute["cohort1"] == [
            {"label": "mobile", "value": 3.0},
            {"label": "desktop", "value": 1.0},
        ]
        assert attribute["cohort2"] == [{"label": "desktop", "value": 2.0}]

        attribute = next(a for a in distributions if a["attributeName"] == "browser")
        assert attribute["attributeName"] == "browser"

        assert mock_compare_distributions.called
        call_args = mock_compare_distributions.call_args
        assert "baseline" in call_args.kwargs
        assert "outliers" in call_args.kwargs
        assert "total_outliers" in call_args.kwargs
        assert "total_baseline" in call_args.kwargs
        assert "config" in call_args.kwargs
        assert "meta" in call_args.kwargs

    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.compare_distributions")
    def test_function_with_multiple_arguments(self, mock_compare_distributions) -> None:
        """Test that functions with multiple arguments work but skip suspect cohort segmentation."""
        mock_compare_distributions.return_value = {
            "results": [
                ("sentry.device", 0.8),
                ("browser", 0.6),
            ]
        }

        tags = [
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "chrome", "device": "mobile"}, 100),
        ]

        for tag, duration in tags:
            self._store_span(tags=tag, duration=duration)

        # Use a function with multiple arguments (e.g., coalesce)
        response = self.do_request(
            query={
                "function": "coalesce(span.duration, span.self_time)",
                "query_1": "span.duration:<=100",
                "query_2": "span.duration:>100",
            }
        )

        # Should succeed (not return 400 error)
        assert response.status_code == 200, response.data

        assert "cohort1Total" in response.data
        assert "cohort2Total" in response.data

        # Should have ranking info but no function value since segmentation was skipped
        assert "rankingInfo" in response.data
        assert response.data["rankingInfo"]["function"] == "coalesce(span.duration, span.self_time)"
        assert response.data["rankingInfo"]["value"] == "N/A"  # No segmentation performed

        # Should still return ranked attributes based on the queries
        assert "rankedAttributes" in response.data

    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.compare_distributions")
    def test_baseline_distribution_consistency(self, mock_compare_distributions) -> None:
        """Test that cohort_2 distribution passed to scoring matches the response data.

        This specifically tests the case where certain attribute values exist in the
        baseline (all spans) but NOT in the suspect cohort.
        """
        mock_compare_distributions.return_value = {
            "results": [
                ("sentry.device", 0.8),
                ("browser", 0.6),
            ]
        }

        tags = [
            # Suspect spans (duration <= 100): only chrome and safari
            ({"browser": "chrome", "device": "mobile"}, 100),
            ({"browser": "safari", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "desktop"}, 100),
            # Baseline spans (duration > 100): chrome, safari, AND edge
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "safari", "device": "desktop"}, 500),
            ({"browser": "edge", "device": "desktop"}, 500),  # Only in baseline!
            ({"browser": "edge", "device": "tablet"}, 600),  # Only in baseline!
        ]

        for tag, duration in tags:
            self._store_span(tags=tag, duration=duration)

        response = self.do_request(query={"query_1": "span.duration:<=100", "query_2": ""})

        assert response.status_code == 200, response.data

        # Get the baseline distribution that was passed to compare_distributions
        call_args = mock_compare_distributions.call_args
        baseline_distribution = call_args.kwargs["baseline"]

        # Convert baseline list to dict for easier comparison
        baseline_dict = {}
        for attr_name, label, value in baseline_distribution:
            if attr_name not in baseline_dict:
                baseline_dict[attr_name] = {}
            baseline_dict[attr_name][label] = value

        # Verify response cohort2 matches the baseline distribution
        distributions = response.data["rankedAttributes"]

        for attribute in distributions:
            attr_name = attribute["attributeName"]
            # Map back from public to internal name
            if attr_name == "browser":
                internal_name = "browser"
            elif attr_name == "sentry.device":
                internal_name = "sentry.device"
            else:
                internal_name = attr_name

            response_cohort2 = attribute["cohort2"]

            # Verify each bucket in the response exists in baseline_distribution
            for bucket in response_cohort2:
                label = bucket["label"]
                value = bucket["value"]

                assert (
                    internal_name in baseline_dict
                ), f"Attribute {internal_name} missing from baseline distribution"
                assert (
                    label in baseline_dict[internal_name]
                ), f"Label {label} for {internal_name} missing from baseline distribution"
                assert baseline_dict[internal_name][label] == value, (
                    f"Value mismatch for {internal_name}.{label}: "
                    f"response={value}, baseline={baseline_dict[internal_name][label]}"
                )

            # Verify all baseline buckets are in the response
            if internal_name in baseline_dict:
                for label, value in baseline_dict[internal_name].items():
                    response_bucket = next(
                        (b for b in response_cohort2 if b["label"] == label), None
                    )
                    assert (
                        response_bucket is not None
                    ), f"Baseline bucket {internal_name}.{label} missing from response"
                    assert response_bucket["value"] == value, (
                        f"Value mismatch for {internal_name}.{label}: "
                        f"response={response_bucket['value']}, baseline={value}"
                    )

        # Specifically verify that "edge" browser exists in baseline
        # (it's only in the all spans, not in suspect)
        browser_attr = next(a for a in distributions if a["attributeName"] == "browser")
        edge_bucket = next((b for b in browser_attr["cohort2"] if b["label"] == "edge"), None)
        assert edge_bucket is not None, "Edge browser should exist in baseline distribution"
        assert edge_bucket["value"] > 0, "Edge browser should have non-zero count in baseline"
