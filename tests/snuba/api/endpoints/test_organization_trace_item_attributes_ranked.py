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
    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.trace_item_stats_rpc")
    @patch("sentry.api.endpoints.organization_trace_item_attributes_ranked.attribute_names_rpc")
    def test_filters_out_internal_and_private_attributes(
        self, mock_attribute_names_rpc, mock_trace_item_stats_rpc, mock_compare_distributions
    ) -> None:
        """Test that internal and private attributes are filtered from the response.

        Attributes that should be filtered:
        - Private attributes (marked with private=True, e.g., sentry.links)
        - Meta attributes (prefixed with sentry._meta)
        - Internal attributes (prefixed with __sentry_internal or sentry._internal.)
        """
        from unittest.mock import MagicMock

        from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
            AttributeDistributions,
            TraceItemStatsResponse,
        )

        # Create mock RPC responses with both public and private attributes
        def create_mock_response():
            mock_response = MagicMock(spec=TraceItemStatsResponse)
            mock_result = MagicMock()

            # Create attribute distributions with a mix of public and internal attributes
            mock_attribute_distributions = MagicMock(spec=AttributeDistributions)

            # Attribute that maps to a valid public alias (not starting with tags[ or sentry.)
            # sentry.release maps to "release" which doesn't have sentry. prefix
            valid_attr = MagicMock()
            valid_attr.attribute_name = "sentry.release"
            valid_bucket = MagicMock()
            valid_bucket.label = "1.0.0"
            valid_bucket.value = 10.0
            valid_attr.buckets = [valid_bucket]

            # Attribute that maps to public alias starting with "sentry." (should be filtered)
            # environment maps to "sentry.environment" which has sentry. prefix
            sentry_prefixed_attr = MagicMock()
            sentry_prefixed_attr.attribute_name = "environment"
            sentry_bucket = MagicMock()
            sentry_bucket.label = "production"
            sentry_bucket.value = 8.0
            sentry_prefixed_attr.buckets = [sentry_bucket]

            # Exception: sentry.normalized_description should NOT be filtered
            normalized_desc_attr = MagicMock()
            normalized_desc_attr.attribute_name = "sentry.normalized_description"
            normalized_desc_bucket = MagicMock()
            normalized_desc_bucket.label = "GET /api/*"
            normalized_desc_bucket.value = 6.0
            normalized_desc_attr.buckets = [normalized_desc_bucket]

            # Attribute that maps to tags[...] format (should be filtered)
            tags_attr = MagicMock()
            tags_attr.attribute_name = "custom_tag"  # Would map to tags[custom_tag,string]
            tags_bucket = MagicMock()
            tags_bucket.label = "value1"
            tags_bucket.value = 7.0
            tags_attr.buckets = [tags_bucket]

            # Private attribute (marked with private=True in definitions)
            private_attr = MagicMock()
            private_attr.attribute_name = "sentry.links"
            private_bucket = MagicMock()
            private_bucket.label = "link1"
            private_bucket.value = 5.0
            private_attr.buckets = [private_bucket]

            # Meta attribute (starts with sentry._meta)
            meta_attr = MagicMock()
            meta_attr.attribute_name = "sentry._meta.fields.attributes.browser"
            meta_bucket = MagicMock()
            meta_bucket.label = "metadata"
            meta_bucket.value = 3.0
            meta_attr.buckets = [meta_bucket]

            # Internal attribute (starts with sentry._internal.)
            internal_attr = MagicMock()
            internal_attr.attribute_name = "sentry._internal.some_metric"
            internal_bucket = MagicMock()
            internal_bucket.label = "internal"
            internal_bucket.value = 7.0
            internal_attr.buckets = [internal_bucket]

            # Another internal attribute (starts with __sentry_internal)
            internal_attr2 = MagicMock()
            internal_attr2.attribute_name = "__sentry_internal.debug_info"
            internal_bucket2 = MagicMock()
            internal_bucket2.label = "debug"
            internal_bucket2.value = 2.0
            internal_attr2.buckets = [internal_bucket2]

            mock_attribute_distributions.attributes = [
                valid_attr,
                sentry_prefixed_attr,
                normalized_desc_attr,
                tags_attr,
                private_attr,
                meta_attr,
                internal_attr,
                internal_attr2,
            ]

            mock_result.attribute_distributions = mock_attribute_distributions
            mock_response.results = [mock_result]
            return mock_response

        # Both cohorts return the same attributes
        mock_trace_item_stats_rpc.return_value = create_mock_response()

        # Mock the attribute names RPC to return all the attribute names (including internal ones)
        mock_attr_names_response = MagicMock()
        mock_attributes = []
        for attr_name in [
            "sentry.release",
            "environment",
            "sentry.normalized_description",
            "custom_tag",
            "sentry.links",
            "sentry._meta.fields.attributes.browser",
            "sentry._internal.some_metric",
            "__sentry_internal.debug_info",
        ]:
            attr = MagicMock()
            attr.name = attr_name
            mock_attributes.append(attr)
        mock_attr_names_response.attributes = mock_attributes
        mock_attribute_names_rpc.return_value = mock_attr_names_response

        mock_compare_distributions.return_value = {
            "results": [
                ("sentry.release", 0.9),
                ("environment", 0.85),
                ("sentry.normalized_description", 0.8),
                ("custom_tag", 0.75),
            ]
        }

        # Store a simple span
        self._store_span(tags={"custom_tag": "value1"}, duration=100)

        response = self.do_request(query={"query_1": "span.duration:<=100", "query_2": ""})

        assert response.status_code == 200, response.data

        # Get all attribute names from the response
        attribute_names = [attr["attributeName"] for attr in response.data["rankedAttributes"]]

        # Verify that valid attributes appear (those not starting with tags[ or sentry.)
        assert (
            "release" in attribute_names
        ), "Valid attribute 'release' (from sentry.release) should be in response (doesn't start with tags[ or sentry.)"

        # Verify that sentry.normalized_description appears (exception to sentry. filtering)
        assert (
            "sentry.normalized_description" in attribute_names
        ), "sentry.normalized_description should appear (exception to sentry.* filtering)"

        # Verify that attributes with public_alias starting with "sentry." are filtered
        assert (
            "sentry.environment" not in attribute_names
        ), "Attribute 'sentry.environment' (from environment) should be filtered out (public alias starts with sentry.)"

        # Verify that attributes with public_alias starting with "tags[" are filtered
        assert not any(
            name.startswith("tags[") for name in attribute_names
        ), "Attributes with public aliases starting with 'tags[' should be filtered out"

        # Verify that private/internal attributes are filtered out
        assert (
            "sentry.links" not in attribute_names
        ), "Private attribute 'sentry.links' should be filtered out"
        assert not any(
            "sentry._meta" in name for name in attribute_names
        ), "Meta attributes should be filtered out"
        assert not any(
            "sentry._internal" in name for name in attribute_names
        ), "Internal attributes with 'sentry._internal.' prefix should be filtered out"
        assert not any(
            "__sentry_internal" in name for name in attribute_names
        ), "Internal attributes with '__sentry_internal' prefix should be filtered out"

        # Also verify the distribution maps don't contain filtered attributes
        for attr in response.data["rankedAttributes"]:
            assert not attr["attributeName"].startswith(
                "tags["
            ), f"Attribute {attr['attributeName']} should not start with tags["
            assert not (
                attr["attributeName"].startswith("sentry.")
                and attr["attributeName"] != "sentry.normalized_description"
            ), f"Attribute {attr['attributeName']} should not start with sentry. (except sentry.normalized_description)"
            assert not attr["attributeName"].startswith(
                "sentry._meta"
            ), f"Attribute {attr['attributeName']} should not start with sentry._meta"
            assert not attr["attributeName"].startswith(
                "sentry._internal"
            ), f"Attribute {attr['attributeName']} should not start with sentry._internal"
            assert not attr["attributeName"].startswith(
                "__sentry_internal"
            ), f"Attribute {attr['attributeName']} should not start with __sentry_internal"
