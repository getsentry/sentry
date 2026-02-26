import uuid
from unittest.mock import patch

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.processing_errors.eap.producer import (
    PROCESSING_ERROR_NAMESPACE,
    produce_processing_errors_to_eap,
)
from sentry.testutils.cases import TestCase
from sentry.utils.eap import hex_to_item_id


class ProduceProcessingErrorsToEAPTest(TestCase):
    def _make_event_data(self, **overrides):
        data = {
            "event_id": "a" * 32,
            "timestamp": 1234567890,
            "contexts": {"trace": {"trace_id": "b" * 32}},
        }
        data.update(overrides)
        return data

    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.get_topic_definition")
    def test_basic_error_produces_trace_item(self, mock_get_topic, mock_producer):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}

        event_data = self._make_event_data()
        errors = [
            {"type": "js_no_source", "symbolicator_type": "missing_sourcemap", "url": "/app.js"}
        ]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        mock_producer.produce.assert_called_once()
        call_args = mock_producer.produce.call_args
        topic, payload = call_args[0]

        assert topic.name == "test-eap-items"
        assert payload.key is None
        assert len(payload.value) > 0

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        trace_item = codec.decode(payload.value)

        assert trace_item.organization_id == self.project.organization_id
        assert trace_item.project_id == self.project.id
        assert trace_item.trace_id == "b" * 32
        assert trace_item.timestamp.seconds == 1234567890
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_PROCESSING_ERROR
        assert trace_item.attributes["event_id"].string_value == "a" * 32
        assert trace_item.attributes["error_type"].string_value == "js_no_source"
        assert trace_item.attributes["symbolicator_type"].string_value == "missing_sourcemap"

    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.get_topic_definition")
    def test_multiple_errors_produce_multiple_items(self, mock_get_topic, mock_producer):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}

        event_data = self._make_event_data()
        errors = [
            {"type": "js_no_source", "symbolicator_type": "missing_sourcemap"},
            {"type": "js_invalid_source", "symbolicator_type": "malformed_sourcemap"},
            {"type": "invalid_data"},
        ]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        assert mock_producer.produce.call_count == 3

    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.get_topic_definition")
    def test_deterministic_item_id(self, mock_get_topic, mock_producer):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}
        codec = get_topic_codec(Topic.SNUBA_ITEMS)

        event_data = self._make_event_data()
        errors = [{"type": "js_no_source"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)
        first_payload = mock_producer.produce.call_args[0][1]
        first_item = codec.decode(first_payload.value)

        mock_producer.reset_mock()
        produce_processing_errors_to_eap(self.project, event_data, errors)
        second_payload = mock_producer.produce.call_args[0][1]
        second_item = codec.decode(second_payload.value)

        assert first_item.item_id == second_item.item_id

        expected_id = hex_to_item_id(uuid.uuid5(PROCESSING_ERROR_NAMESPACE, f"{'a' * 32}:0").hex)
        assert first_item.item_id == expected_id

    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.get_topic_definition")
    def test_optional_fields_included_when_present(self, mock_get_topic, mock_producer):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}
        codec = get_topic_codec(Topic.SNUBA_ITEMS)

        event_data = self._make_event_data(
            release="1.0.0",
            environment="production",
            platform="javascript",
            sdk={"name": "sentry.javascript.browser", "version": "7.0.0"},
        )
        errors = [{"type": "js_no_source", "symbolicator_type": "missing_sourcemap"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        payload = mock_producer.produce.call_args[0][1]
        trace_item = codec.decode(payload.value)

        assert trace_item.attributes["release"].string_value == "1.0.0"
        assert trace_item.attributes["environment"].string_value == "production"
        assert trace_item.attributes["platform"].string_value == "javascript"
        assert trace_item.attributes["sdk_name"].string_value == "sentry.javascript.browser"
        assert trace_item.attributes["sdk_version"].string_value == "7.0.0"

    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.get_topic_definition")
    def test_optional_fields_omitted_when_absent(self, mock_get_topic, mock_producer):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}
        codec = get_topic_codec(Topic.SNUBA_ITEMS)

        event_data = self._make_event_data()
        errors = [{"type": "invalid_data"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        payload = mock_producer.produce.call_args[0][1]
        trace_item = codec.decode(payload.value)

        assert "release" not in trace_item.attributes
        assert "environment" not in trace_item.attributes
        assert "platform" not in trace_item.attributes
        assert "sdk_name" not in trace_item.attributes
        assert "sdk_version" not in trace_item.attributes
        assert "symbolicator_type" not in trace_item.attributes

    @patch("sentry.processing_errors.eap.producer.logger")
    @patch("sentry.processing_errors.eap.producer._eap_producer")
    def test_skips_when_no_trace_id(self, mock_producer, mock_logger):
        event_data = self._make_event_data()
        del event_data["contexts"]["trace"]["trace_id"]
        errors = [{"type": "js_no_source"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        mock_producer.produce.assert_not_called()
        mock_logger.debug.assert_called_once_with(
            "Skipping EAP processing error production: missing trace_id"
        )

    @patch("sentry.processing_errors.eap.producer.logger")
    @patch("sentry.processing_errors.eap.producer._eap_producer")
    def test_skips_when_no_contexts(self, mock_producer, mock_logger):
        event_data = self._make_event_data()
        del event_data["contexts"]
        errors = [{"type": "js_no_source"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        mock_producer.produce.assert_not_called()
        mock_logger.debug.assert_called_once_with(
            "Skipping EAP processing error production: missing trace_id"
        )

    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.logger")
    def test_error_handling_does_not_raise(self, mock_logger, mock_producer):
        mock_producer.produce.side_effect = Exception("Kafka error")

        event_data = self._make_event_data()
        errors = [{"type": "js_no_source"}]

        # Should not raise
        produce_processing_errors_to_eap(self.project, event_data, errors)

        mock_logger.exception.assert_called_once_with("Failed to produce processing errors to EAP")

    @patch("sentry.processing_errors.eap.producer.metrics")
    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.get_topic_definition")
    def test_success_metrics(self, mock_get_topic, mock_producer, mock_metrics):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}

        event_data = self._make_event_data()
        errors = [{"type": "js_no_source"}, {"type": "invalid_data"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        mock_metrics.incr.assert_called_with(
            "processing_errors.eap.produced",
            amount=2,
            sample_rate=1.0,
        )

    @patch("sentry.processing_errors.eap.producer.metrics")
    @patch("sentry.processing_errors.eap.producer._eap_producer")
    def test_failure_metrics(self, mock_producer, mock_metrics):
        mock_producer.produce.side_effect = Exception("Kafka error")

        event_data = self._make_event_data()
        errors = [{"type": "js_no_source"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        mock_metrics.incr.assert_called_with(
            "processing_errors.eap.produce_failed",
            sample_rate=1.0,
        )

    @patch("sentry.processing_errors.eap.producer._eap_producer")
    @patch("sentry.processing_errors.eap.producer.get_topic_definition")
    def test_error_type_defaults_to_unknown(self, mock_get_topic, mock_producer):
        mock_get_topic.return_value = {"real_topic_name": "test-eap-items"}
        codec = get_topic_codec(Topic.SNUBA_ITEMS)

        event_data = self._make_event_data()
        errors = [{"not_type": "something"}]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        payload = mock_producer.produce.call_args[0][1]
        trace_item = codec.decode(payload.value)
        assert trace_item.attributes["error_type"].string_value == "unknown"
