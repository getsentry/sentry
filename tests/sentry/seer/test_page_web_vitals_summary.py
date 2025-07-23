import datetime
from unittest.mock import patch

from sentry.api.endpoints.organization_trace import SerializedSpan
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.seer.models import PageWebVitalsInsight, SummarizePageWebVitalsResponse
from sentry.seer.page_web_vitals_summary import get_page_web_vitals_summary
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:performance-web-vitals-seer-suggestions")
class PageWebVitalsSummaryTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(self.user)

        self.trace_id = "trace123"
        self.trace_tree = [
            SerializedSpan(
                description="connect",
                name="browser",
                event_id="span1",
                event_type="span",
                project_id=1,
                project_slug="test-project",
                start_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 0),
                transaction="test_transaction",
                children=[],
                errors=[],
                occurrences=[],
                duration=100.0,
                end_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 1),
                measurements={},
                op="browser",
                parent_span_id=None,
                profile_id="",
                profiler_id="",
                sdk_name="test_sdk",
                is_transaction=False,
                transaction_id="1" * 32,
            ),
            SerializedSpan(
                description="Main UI thread blocked",
                name="ui.long-task",
                event_id="span2",
                event_type="span",
                project_id=1,
                project_slug="test-project",
                start_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 0),
                transaction="test_transaction",
                children=[],
                errors=[],
                occurrences=[],
                duration=50.0,
                end_timestamp=datetime.datetime(2023, 1, 1, 0, 0, 1),
                measurements={},
                op="ui.long-task",
                parent_span_id=None,
                profile_id="",
                profiler_id="",
                sdk_name="test_sdk",
                is_transaction=False,
                transaction_id="1" * 32,
            ),
        ]

        self.mock_summary_response = SummarizePageWebVitalsResponse(
            trace_ids=[self.trace_id],
            suggested_investigations=[
                PageWebVitalsInsight(
                    explanation="Long task is blocking the main thread.",
                    span_id="1" * 18,
                    span_op="ui.long-task",
                    trace_id=self.trace_id,
                    suggestions=["Optimize."],
                    reference_url="https://web.dev/",
                ),
            ],
        )

        cache.clear()

    def tearDown(self):
        super().tearDown()
        # Clear the cache with the correct key format
        cache.delete("ai-page-web-vitals-summary:" + str([self.trace_id]))

    @patch("sentry.features.has")
    def test_get_page_web_vitals_summary_feature_flag_disabled(self, mock_has_feature):
        mock_has_feature.return_value = False

        summary_data, status_code = get_page_web_vitals_summary(
            traceSlugs=[self.trace_id],
            traceTrees=[self.trace_tree],
            organization=self.organization,
            user=self.user,
        )

        assert status_code == 400
        assert summary_data == {"detail": "Feature flag not enabled"}
        mock_has_feature.assert_called_once_with(
            "organizations:performance-web-vitals-seer-suggestions",
            self.organization,
            actor=self.user,
        )

    @patch("sentry.features.has")
    @patch("sentry.seer.page_web_vitals_summary.cache.get")
    @patch("sentry.seer.page_web_vitals_summary._call_seer")
    @patch("sentry.seer.page_web_vitals_summary.cache.set")
    def test_get_page_web_vitals_summary_success(
        self, mock_cache_set, mock_call_seer, mock_cache_get, mock_has_feature
    ):
        mock_has_feature.return_value = True
        mock_cache_get.return_value = None
        mock_call_seer.return_value = self.mock_summary_response

        summary_data, status_code = get_page_web_vitals_summary(
            traceSlugs=[self.trace_id],
            traceTrees=[self.trace_tree],
            organization=self.organization,
            user=self.user,
        )

        assert status_code == 200
        assert summary_data == convert_dict_key_case(
            self.mock_summary_response.dict(), snake_to_camel_case
        )
        mock_has_feature.assert_called_once()
        mock_cache_get.assert_called_once()
        mock_call_seer.assert_called_once_with([self.trace_id], [self.trace_tree])
        mock_cache_set.assert_called_once()

    @patch("sentry.seer.page_web_vitals_summary._call_seer")
    def test_get_page_web_vitals_summary_cache_hit(self, mock_call_seer):
        cached_summary = self.mock_summary_response.dict()

        cache.set(
            "ai-page-web-vitals-summary:" + str([self.trace_id]),
            cached_summary,
            timeout=60 * 60 * 24 * 7,
        )

        summary_data, status_code = get_page_web_vitals_summary(
            traceSlugs=[self.trace_id],
            traceTrees=[self.trace_tree],
            organization=self.organization,
            user=self.user,
        )

        assert status_code == 200
        assert summary_data == convert_dict_key_case(cached_summary, snake_to_camel_case)
        mock_call_seer.assert_not_called()
