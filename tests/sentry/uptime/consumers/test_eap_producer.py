import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.testutils.cases import TestCase
from sentry.uptime.consumers.eap_converter import convert_uptime_result_to_trace_items
from sentry.uptime.consumers.eap_producer import produce_eap_uptime_result
from sentry.uptime.types import IncidentStatus


class EAPProducerIntegrationTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.subscription = self.create_uptime_subscription(subscription_id=str(uuid.uuid4()))

    def create_check_result(self) -> CheckResult:
        """Create a sample CheckResult for testing."""
        base_time = datetime.now(timezone.utc)
        result: CheckResult = {
            "guid": str(uuid.uuid4()),
            "subscription_id": str(self.subscription.subscription_id),
            "status": "success",
            "status_reason": None,
            "trace_id": str(uuid.uuid4()),
            "span_id": str(uuid.uuid4()),
            "region": "us-east-1",
            "scheduled_check_time_ms": int(base_time.timestamp() * 1000),
            "actual_check_time_ms": int(base_time.timestamp() * 1000) + 1000,
            "duration_ms": 150,
            "request_info": {
                "http_status_code": 200,
                "request_type": "GET",
                "url": "https://example.com",
            },
        }
        return result

    @patch("sentry.uptime.consumers.eap_producer._eap_items_producer")
    @patch("sentry.uptime.consumers.eap_producer.get_topic_definition")
    def test_produce_eap_uptime_result_success(self, mock_get_topic, mock_producer):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}
        mock_producer_instance = MagicMock()
        mock_producer.produce = mock_producer_instance

        result = self.create_check_result()
        metric_tags = {"status": "success", "region": "us-east-1"}

        produce_eap_uptime_result(
            uptime_subscription=self.subscription,
            project=self.project,
            result=result,
            metric_tags=metric_tags,
        )

        mock_producer_instance.assert_called_once()
        call_args = mock_producer_instance.call_args
        topic, payload = call_args[0]

        assert topic.name == "test-eap-items"
        assert payload.key is None
        assert len(payload.value) > 0
        assert payload.headers == []
        expected_trace_items = convert_uptime_result_to_trace_items(
            self.project, result, IncidentStatus.NO_INCIDENT
        )
        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        assert [codec.decode(payload.value)] == expected_trace_items

    @patch("sentry.uptime.consumers.eap_producer._eap_items_producer")
    @patch("sentry.uptime.consumers.eap_producer.logger")
    def test_produce_eap_uptime_result_error_handling(self, mock_logger, mock_producer):
        mock_producer.produce.side_effect = Exception("Kafka error")
        result = self.create_check_result()
        metric_tags = {"status": "success", "region": "us-east-1"}
        produce_eap_uptime_result(
            uptime_subscription=self.subscription,
            project=self.project,
            result=result,
            metric_tags=metric_tags,
        )
        mock_logger.exception.assert_called_once_with(
            "Failed to produce EAP TraceItems for uptime result"
        )

    @patch("sentry.uptime.consumers.eap_producer.metrics")
    @patch("sentry.uptime.consumers.eap_producer._eap_items_producer")
    def test_metrics_tracking(self, mock_producer, mock_metrics):
        result = self.create_check_result()
        metric_tags = {"status": "success", "region": "us-east-1"}
        produce_eap_uptime_result(
            uptime_subscription=self.subscription,
            project=self.project,
            result=result,
            metric_tags=metric_tags,
        )
        mock_metrics.incr.assert_called_with(
            "uptime.result_processor.eap_message_produced",
            sample_rate=1.0,
            tags={**metric_tags, "count": "1"},
        )

    @patch("sentry.uptime.consumers.eap_producer.metrics")
    @patch("sentry.uptime.consumers.eap_producer._eap_items_producer")
    def test_error_metrics_tracking(self, mock_producer, mock_metrics):
        mock_producer.produce.side_effect = Exception("Kafka error")
        result = self.create_check_result()
        metric_tags = {"status": "success", "region": "us-east-1"}
        produce_eap_uptime_result(
            uptime_subscription=self.subscription,
            project=self.project,
            result=result,
            metric_tags=metric_tags,
        )
        mock_metrics.incr.assert_called_with(
            "uptime.result_processor.eap_message_failed",
            sample_rate=1.0,
            tags=metric_tags,
        )
