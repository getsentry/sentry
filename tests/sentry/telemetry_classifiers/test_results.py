from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.constants import DataCategory
from sentry.telemetry_classifiers.results import write_result
from sentry.telemetry_classifiers.types import TelemetryInput
from sentry.testutils.cases import TestCase

SOURCE = TelemetryInput(
    events=[{"role": "user", "content": "This is broken"}],
    truncated=False,
    trace_id="1" * 32,
    timestamp=datetime(2020, 1, 1, 12, tzinfo=UTC),
    client_sample_rate=0.5,
    conversation_id="conversation",
)


@patch("sentry.telemetry_classifiers.results.produce_enrichment_attributes")
class WriteResultTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.classifier = self.create_telemetry_classifier(project=self.project)

    def test_writes_result(self, produce: MagicMock) -> None:
        with patch(
            "sentry.telemetry_classifiers.results.quotas.backend.get_event_retention",
            return_value=45,
        ) as get_event_retention:
            write_result(
                self.classifier,
                "conversation",
                SOURCE,
                {"sentry.enrichment.frustration": 0.9},
                DataCategory.SPAN,
            )

        get_event_retention.assert_called_once_with(
            organization=self.organization, category=DataCategory.SPAN
        )
        produce.assert_called_once_with(
            self.project,
            idempotency_key=f"{self.classifier.id}:conversation:2020-01-01T12:00:00+00:00",
            trace_id="1" * 32,
            timestamp=SOURCE.timestamp,
            retention_days=45,
            attributes={"sentry.enrichment.frustration": 0.9},
            conversation_id="conversation",
            client_sample_rate=0.5,
        )

    def test_defaults_unlimited_retention(self, produce: MagicMock) -> None:
        with patch(
            "sentry.telemetry_classifiers.results.quotas.backend.get_event_retention",
            return_value=None,
        ):
            write_result(self.classifier, "conversation", SOURCE, {}, DataCategory.SPAN)

        assert produce.call_args.kwargs["retention_days"] == 30
