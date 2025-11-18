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
                {
                    "description": description or "foo",
                    "sentry_tags": tags,
                    "measurements": {"client_sample_rate": {"value": 0.5}},
                },
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

        response = self.do_request(query={"query_1": "span.duration:<=100"})
        assert response.status_code == 200, response.data
        assert response.data["cohort1Total"] == 4
        assert response.data["cohort2Total"] == 3

        # Verify filtering: no attributes should start with "tags[" or "sentry." (except sentry.normalized_description)
        for attr in response.data["rankedAttributes"]:
            assert not attr["attributeName"].startswith("tags[")
            assert not (
                attr["attributeName"].startswith("sentry.")
                and attr["attributeName"] != "sentry.normalized_description"
            )

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
    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.keyed_rrf_score")
    def test_baseline_distribution_includes_baseline_only_buckets(
        self, mock_keyed_rrf_score, mock_compare_distributions
    ) -> None:
        """Test that buckets existing only in baseline (not in suspect) are included in scoring.

        This specifically tests the fix for the bug where attribute values that exist
        in all spans but NOT in the suspect cohort were missing from the baseline
        distribution passed to scoring algorithms.
        """
        # Capture what's passed to the scoring functions
        captured_baseline = None

        def capture_baseline(*args, **kwargs):
            nonlocal captured_baseline
            captured_baseline = kwargs.get("baseline")
            # Return results matching the actual internal attribute names
            return [("sentry.browser", 1.0), ("sentry.device", 0.8)]

        def capture_compare(*args, **kwargs):
            return {"results": [("sentry.browser", 0.9), ("sentry.device", 0.7)]}

        mock_keyed_rrf_score.side_effect = capture_baseline
        mock_compare_distributions.side_effect = capture_compare

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

        # Convert baseline list to dict for easier verification
        baseline_dict: dict[str, dict[str, float]] = {}
        assert captured_baseline is not None
        for attr_name, label, value in captured_baseline:
            if attr_name not in baseline_dict:
                baseline_dict[attr_name] = {}
            baseline_dict[attr_name][label] = value

        # Verify that "edge" browser exists in the baseline distribution sent to scoring
        # This is the key test: edge exists in all spans but NOT in suspect spans
        # Note: Internal attribute name is "sentry.browser"
        assert (
            "sentry.browser" in baseline_dict
        ), "sentry.browser attribute should be in baseline distribution"
        assert (
            "edge" in baseline_dict["sentry.browser"]
        ), "edge browser should be in baseline (it exists in all spans but not in suspect)"
        assert (
            baseline_dict["sentry.browser"]["edge"] > 0
        ), "edge count should be positive in baseline"

        # Also verify edge appears in the response (public name is "browser")
        browser_attr = next(
            (a for a in response.data["rankedAttributes"] if a["attributeName"] == "browser"),
            None,
        )
        assert browser_attr is not None, "browser attribute should be in response"
        edge_bucket = next((b for b in browser_attr["cohort2"] if b["label"] == "edge"), None)
        assert edge_bucket is not None, "edge browser should be in response cohort2 (baseline)"
        assert edge_bucket["value"] > 0, "edge count should be positive in response"

        # Verify tablet device exists (also only in baseline)
        assert (
            "sentry.device" in baseline_dict
        ), "sentry.device attribute should be in baseline distribution"
        assert (
            "tablet" in baseline_dict["sentry.device"]
        ), "tablet device should be in baseline (exists in all spans but not in suspect)"
        assert (
            baseline_dict["sentry.device"]["tablet"] > 0
        ), "tablet count should be positive in baseline"

    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.compare_distributions")
    def test_filters_out_internal_and_private_attributes(self, mock_compare_distributions) -> None:
        """Test that internal/private attributes and certain public aliases are filtered from the response.

        The endpoint filters:
        - Public aliases starting with "tags["
        - Public aliases starting with "sentry." (EXCEPT sentry.normalized_description)
        - Internal attributes (sentry._internal.*, __sentry_internal*)
        - Meta attributes (containing sentry._meta)
        - Private attributes (marked with private=True in definitions)
        """
        # Mock the scoring algorithm to return arbitrary scores
        # The actual attributes will come from real span data
        mock_compare_distributions.return_value = {"results": []}

        # Store spans with tags to generate attribute data
        self._store_span(tags={"custom_tag": "value1", "browser": "chrome"}, duration=100)
        self._store_span(tags={"custom_tag": "value2", "browser": "firefox"}, duration=200)

        response = self.do_request(query={"query_1": "span.duration:<=150", "query_2": ""})

        assert response.status_code == 200, response.data

        # Verify filtering: all returned attributes must NOT have these prefixes/patterns
        for attr in response.data["rankedAttributes"]:
            attr_name = attr["attributeName"]
            # Public alias filtering
            assert not attr_name.startswith(
                "tags["
            ), f"Attribute '{attr_name}' should be filtered (starts with tags[)"
            assert not (
                attr_name.startswith("sentry.") and attr_name != "sentry.normalized_description"
            ), f"Attribute '{attr_name}' should be filtered (starts with sentry.* but is not sentry.normalized_description)"

            # Internal/private attribute filtering
            assert not attr_name.startswith(
                "sentry._internal."
            ), f"Attribute '{attr_name}' should be filtered (internal attribute with sentry._internal. prefix)"
            assert not attr_name.startswith(
                "__sentry_internal"
            ), f"Attribute '{attr_name}' should be filtered (internal attribute with __sentry_internal prefix)"
            assert (
                "sentry._meta" not in attr_name
            ), f"Attribute '{attr_name}' should be filtered (meta attribute)"

    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.compare_distributions")
    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.keyed_rrf_score")
    @patch(
        "sentry.api.endpoints.organization_trace_item_attributes_ranked.translate_internal_to_public_alias"
    )
    def test_includes_user_defined_attributes_when_translate_returns_none(
        self, mock_translate, mock_keyed_rrf_score, mock_compare_distributions
    ) -> None:
        """Test that user-defined attributes are included when translate_internal_to_public_alias returns None.

        When translate_internal_to_public_alias returns (None, None, None), it indicates a user-defined
        attribute that should be kept as-is and included in the response (unless it starts with forbidden prefixes).
        """

        # Mock translate function to return None for user-defined attributes
        def mock_translate_func(attr, *_):
            if attr == "custom_user_attr":
                return (None, None, None)  # User-defined attribute
            elif attr == "tags[filtered_tag]":
                return (None, None, None)  # Should be filtered due to tags[ prefix
            else:
                return (attr, None, None)  # Regular attributes

        mock_translate.side_effect = mock_translate_func

        # Mock primary scoring (keyed_rrf_score) to include our test attributes
        mock_keyed_rrf_score.return_value = [
            ("custom_user_attr", 0.9),
            ("tags[filtered_tag]", 0.8),
            ("regular_attr", 0.7),
        ]

        # Mock secondary scoring for RRR ordering
        mock_compare_distributions.return_value = {
            "results": [
                ("custom_user_attr", 0.9),
                ("tags[filtered_tag]", 0.8),
                ("regular_attr", 0.7),
            ]
        }

        # Store spans to generate some data
        self._store_span(tags={"browser": "chrome"}, duration=100)
        self._store_span(tags={"browser": "firefox"}, duration=200)

        response = self.do_request(query={"query_1": "span.duration:<=150", "query_2": ""})

        assert response.status_code == 200, response.data

        # Extract attribute names from response
        returned_attrs = [attr["attributeName"] for attr in response.data["rankedAttributes"]]

        # User-defined attribute should be included with original name
        assert (
            "custom_user_attr" in returned_attrs
        ), "User-defined attributes should be included when translate returns None"

        # Filtered attribute should NOT be included even if translate returns None
        assert (
            "tags[filtered_tag]" not in returned_attrs
        ), "Attributes with forbidden prefixes should be filtered even when translate returns None"

        # Regular attribute should be included
        assert "regular_attr" in returned_attrs, "Regular attributes should be included"
