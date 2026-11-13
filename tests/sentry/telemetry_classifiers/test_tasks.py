from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call, patch

import pytest

from sentry.constants import DataCategory
from sentry.exceptions import InvalidSearchQuery
from sentry.telemetry_classifiers.definitions import resolve_prebuilt_definition
from sentry.telemetry_classifiers.inference import ClassifierExecutionError
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.tasks import (
    classify_entity,
    schedule_classifiers,
    select_entities,
)
from sentry.telemetry_classifiers.types import (
    Dataset,
    TelemetryClassifierStatus,
    TelemetryInput,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import cell_silo_test

NOW = datetime(2020, 1, 1, 12, 7, 31, tzinfo=UTC)
LATER = datetime(2020, 1, 1, 12, 12, 31, tzinfo=UTC)


class ClassifierTaskTestCase(TestCase):
    dataset: MagicMock

    @pytest.fixture(autouse=True)
    def mock_dataset(self) -> Generator[None]:
        self.dataset = MagicMock(data_category=DataCategory.SPAN)
        with patch.dict(
            "sentry.telemetry_classifiers.tasks.DATASETS", {Dataset.CONVERSATION: self.dataset}
        ):
            yield

    def create_prebuilt_classifier(self, **kwargs: object) -> TelemetryClassifier:
        return self.create_telemetry_classifier(
            project=self.project,
            prebuilt_classifier_key="conversation_user_frustration",
            natural_language_prompt=None,
            compiled_prompt=None,
            output_type=None,
            **kwargs,
        )


@cell_silo_test
class ScheduleClassifiersTest(TestCase):
    @patch("sentry.telemetry_classifiers.tasks.select_entities.delay")
    def test_selects_enabled_classifiers(self, mock_select: MagicMock) -> None:
        enabled = self.create_telemetry_classifier(project=self.project)
        self.create_telemetry_classifier(
            project=self.project, status=TelemetryClassifierStatus.DISABLED
        )

        schedule_classifiers()

        mock_select.assert_called_once_with(enabled.id)


@cell_silo_test
class SelectEntitiesTest(ClassifierTaskTestCase):
    @pytest.fixture(autouse=True)
    def mock_classify_entity(self) -> Generator[None]:
        with patch("sentry.telemetry_classifiers.tasks.classify_entity.delay") as mock:
            self.classify_entity = mock
            yield

    def test_selects_recent_entities_once(self) -> None:
        classifier = self.create_telemetry_classifier(project=self.project, filter_query="a:b")
        # Windows overlap, so the second selection finds "one" again.
        self.dataset.select.side_effect = [["one"], ["two", "one"]]

        with freeze_time(NOW):
            select_entities(classifier.id)
        with freeze_time(LATER):
            select_entities(classifier.id)

        assert self.dataset.select.call_args_list == [
            call(self.project, "a:b", NOW - timedelta(minutes=15), NOW, 100, 0),
            call(self.project, "a:b", LATER - timedelta(minutes=15), LATER, 100, 0),
        ]
        assert self.classify_entity.call_args_list == [
            call(classifier_id=classifier.id, entity_id="one"),
            call(classifier_id=classifier.id, entity_id="two"),
        ]

    @override_options({"telemetry-classifiers.select-limit": 2})
    def test_pages_past_entities_already_enqueued(self) -> None:
        classifier = self.create_telemetry_classifier(project=self.project)
        self.dataset.select.side_effect = [["one", "two"], ["one", "two"], ["three"]]

        select_entities(classifier.id)
        select_entities(classifier.id)

        assert [c.args[4:] for c in self.dataset.select.call_args_list] == [(2, 0), (2, 0), (2, 2)]
        assert self.classify_entity.call_args_list == [
            call(classifier_id=classifier.id, entity_id="one"),
            call(classifier_id=classifier.id, entity_id="two"),
            call(classifier_id=classifier.id, entity_id="three"),
        ]

    @override_options({"telemetry-classifiers.select-limit": 2})
    @patch("sentry.telemetry_classifiers.tasks.metrics.incr")
    def test_entities_already_enqueued_dont_count_toward_the_limit(
        self, mock_incr: MagicMock
    ) -> None:
        classifier = self.create_telemetry_classifier(project=self.project)
        self.dataset.select.side_effect = [["one"], ["one", "two"], ["three", "four"]]

        select_entities(classifier.id)
        select_entities(classifier.id)

        assert self.classify_entity.call_args_list == [
            call(classifier_id=classifier.id, entity_id="one"),
            call(classifier_id=classifier.id, entity_id="two"),
            call(classifier_id=classifier.id, entity_id="three"),
        ]
        mock_incr.assert_any_call(
            "telemetry_classifiers.select",
            tags={"dataset": Dataset.CONVERSATION, "outcome": "limit_reached"},
        )

    def test_retries_skip_entities_already_enqueued(self) -> None:
        classifier = self.create_telemetry_classifier(project=self.project)
        self.dataset.select.return_value = ["one", "two"]
        self.classify_entity.side_effect = [None, ConnectionError("broker unavailable")]

        with pytest.raises(ConnectionError):
            select_entities(classifier.id)
        self.classify_entity.side_effect = None
        select_entities(classifier.id)

        # "two" failed to enqueue, so only it is enqueued again.
        assert self.classify_entity.call_args_list == [
            call(classifier_id=classifier.id, entity_id="one"),
            call(classifier_id=classifier.id, entity_id="two"),
            call(classifier_id=classifier.id, entity_id="two"),
        ]

    def test_skips_disabled_classifiers(self) -> None:
        classifier = self.create_telemetry_classifier(
            project=self.project, status=TelemetryClassifierStatus.DISABLED
        )

        select_entities(classifier.id)

        self.dataset.select.assert_not_called()

    def test_skips_invalid_filters(self) -> None:
        classifier = self.create_telemetry_classifier(project=self.project)
        self.dataset.select.side_effect = InvalidSearchQuery("invalid")

        select_entities(classifier.id)

        self.classify_entity.assert_not_called()


@cell_silo_test
class ClassifyEntityTest(ClassifierTaskTestCase):
    @pytest.fixture(autouse=True)
    def mock_pipeline(self) -> Generator[None]:
        with (
            patch("sentry.telemetry_classifiers.tasks.classify") as mock_classify,
            patch("sentry.telemetry_classifiers.tasks.write_result") as mock_write,
        ):
            self.classify = mock_classify
            self.write_result = mock_write
            yield

    def setUp(self) -> None:
        super().setUp()
        self.source = TelemetryInput(
            events=[{"role": "user", "content": "This is broken"}],
            truncated=False,
            trace_id="a" * 32,
            timestamp=datetime(2020, 1, 1, 12, 0, tzinfo=UTC),
            client_sample_rate=1.0,
            conversation_id="conversation",
        )
        self.dataset.load.return_value = self.source
        self.classify.return_value = {"type": "predicate", "name": "match", "probability": 0.8}

    def test_writes_result(self) -> None:
        classifier = self.create_prebuilt_classifier(result_attribute="user_frustration")

        classify_entity(classifier_id=classifier.id, entity_id="conversation")

        self.dataset.load.assert_called_once_with(self.project, "conversation")
        self.classify.assert_called_once_with(
            resolve_prebuilt_definition("conversation_user_frustration", Dataset.CONVERSATION),
            ({"role": "user", "content": "This is broken"},),
            self.organization,
        )
        self.write_result.assert_called_once_with(
            classifier,
            "conversation",
            self.source,
            {"sentry.enrichment.user_frustration": 0.8},
            DataCategory.SPAN,
        )

    def test_skips_disabled_classifiers(self) -> None:
        classifier = self.create_prebuilt_classifier(status=TelemetryClassifierStatus.DISABLED)

        classify_entity(classifier_id=classifier.id, entity_id="conversation")

        self.dataset.load.assert_not_called()

    def test_skips_classifiers_that_cant_run(self) -> None:
        # Custom classifiers can't run yet.
        classifier = self.create_telemetry_classifier(project=self.project)

        classify_entity(classifier_id=classifier.id, entity_id="conversation")

        self.dataset.load.assert_not_called()

    def test_skips_entities_without_telemetry(self) -> None:
        classifier = self.create_prebuilt_classifier()
        self.dataset.load.return_value = None

        classify_entity(classifier_id=classifier.id, entity_id="conversation")

        self.classify.assert_not_called()

    def test_drops_results_that_cant_succeed(self) -> None:
        classifier = self.create_prebuilt_classifier()
        self.classify.side_effect = ClassifierExecutionError("invalid_response", retryable=False)

        classify_entity(classifier_id=classifier.id, entity_id="conversation")

        self.write_result.assert_not_called()

    def test_raises_retryable_errors(self) -> None:
        classifier = self.create_prebuilt_classifier()
        self.classify.side_effect = ClassifierExecutionError("seer_unavailable", retryable=True)

        with pytest.raises(ClassifierExecutionError):
            classify_entity(classifier_id=classifier.id, entity_id="conversation")

        self.write_result.assert_not_called()
