from unittest.mock import patch

from sentry.grouping.ingest.seer import maybe_send_seer_for_new_model_training
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.seer.similarity.config import SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE
from sentry.seer.similarity.types import GroupingVersion
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class MaybeSendSeerForNewModelTrainingTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.event = save_new_event({"message": "Dogs are great!"}, self.project)
        self.variants = self.event.get_grouping_variants()
        # save_new_event already creates a grouphash, so retrieve it
        self.grouphash = GroupHash.objects.get(
            hash=self.event.get_primary_hash(), project_id=self.project.id
        )

    def test_training_respects_each_projects_selected_model(self) -> None:
        stable_project = self.create_project()
        stable_event = save_new_event({"message": "Still on the stable model"}, stable_project)
        stable_grouphash = GroupHash.objects.get(
            hash=stable_event.get_primary_hash(), project_id=stable_project.id
        )
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                return_value=([], "v2.1"),
            ) as get_similarity_data,
        ):
            with self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE):
                maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            with self.feature({SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE: False}):
                maybe_send_seer_for_new_model_training(
                    stable_event, stable_grouphash, stable_event.get_grouping_variants()
                )

        get_similarity_data.assert_called_once()
        payload = get_similarity_data.call_args.args[0]
        assert payload["project_id"] == self.project.id
        assert payload["model"] == GroupingVersion.V2_1
        assert payload["training_mode"] is True
        assert payload["skip_fallback"] is False
        assert get_similarity_data.call_args.kwargs["raise_on_error"] is True
        metadata = GroupHashMetadata.objects.get(grouphash=self.grouphash)
        assert metadata.seer_latest_training_model == "v2.1"
        assert metadata.seer_model is None
        assert (
            GroupHashMetadata.objects.get(grouphash=stable_grouphash).seer_latest_training_model
            is None
        )

    def test_does_not_retrain_old_hash_after_promotion(self) -> None:
        metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
        metadata.seer_model = "v1"
        metadata.seer_latest_training_model = "v1"
        metadata.save()

        with (
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer"
            ) as mock_get_similarity_data,
        ):
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_not_called()

        metadata.refresh_from_db()
        assert metadata.seer_model == "v1"
        assert metadata.seer_latest_training_model == "v1"

    def test_training_updates_version_without_changing_grouping_decision(self) -> None:
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                return_value=([], "v2.1"),
            ) as mock_get_similarity_data,
            patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
            self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = "v1"
            metadata.seer_latest_training_model = "v1"
            metadata.save()

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            mock_get_similarity_data.assert_called_once()
            call_args = mock_get_similarity_data.call_args
            assert call_args[0][0]["training_mode"] is True
            assert call_args[1]["raise_on_error"] is True

            # Should update seer_latest_training_model without touching seer_model
            metadata = GroupHashMetadata.objects.get(id=metadata.id)
            assert metadata.seer_latest_training_model == "v2.1"
            assert metadata.seer_model == "v1"

    def test_does_not_send_duplicate_request(self) -> None:
        """Should not send a second training request after a successful one"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                return_value=([], "v2.1"),
            ) as mock_get_similarity_data,
            patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
            self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            assert metadata.seer_latest_training_model is None

            # First call should send the request
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_called_once()

            mock_get_similarity_data.reset_mock()

            # Second call should not send because seer_latest_training_model was updated
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_not_called()

    def test_does_not_send_when_should_call_seer_returns_false(self) -> None:
        """Should not send request when should_call_seer_for_grouping returns False"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=False),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer"
            ) as mock_get_similarity_data,
            patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
            self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            assert metadata.seer_latest_training_model is None

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # Should not be called because should_call_seer_for_grouping returned False
            mock_get_similarity_data.assert_not_called()

    def test_failed_training_is_reported_and_not_marked_complete(self) -> None:
        test_exception = Exception("Seer service unavailable")

        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                side_effect=test_exception,
            ),
            patch("sentry.grouping.ingest.seer.sentry_sdk.capture_exception") as mock_capture,
            patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
            self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            assert metadata.seer_latest_training_model is None

            # Should not raise, exception is caught and handled
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # Should capture the exception with proper tags
            mock_capture.assert_called_once_with(
                test_exception,
                tags={
                    "event": self.event.event_id,
                    "project": self.event.project.id,
                    "grouphash": self.grouphash.hash,
                },
            )
            metadata.refresh_from_db()
            assert metadata.seer_latest_training_model is None
