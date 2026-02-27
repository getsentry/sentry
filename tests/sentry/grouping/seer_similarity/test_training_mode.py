from unittest.mock import patch

from urllib3.exceptions import TimeoutError

from sentry.grouping.ingest.seer import maybe_send_seer_for_new_model_training
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.seer.similarity.config import SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE
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

    def test_does_nothing_when_feature_not_enabled(self) -> None:
        """Should not send request when feature flag is not enabled"""
        with patch(
            "sentry.grouping.ingest.seer.get_similarity_data_from_seer"
        ) as mock_get_similarity_data:
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_not_called()

    def test_does_nothing_when_no_rollout(self) -> None:
        """Should not send request when no new version is being rolled out"""
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer"
            ) as mock_get_similarity_data,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_not_called()

    def test_does_nothing_when_already_sent_to_new_version(self) -> None:
        """Should not send request when grouphash already has new version embedding"""
        with (
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer"
            ) as mock_get_similarity_data,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Set the metadata to indicate already sent to v2
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = "v2"
            metadata.save()

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_not_called()

    def test_does_nothing_when_training_model_already_sent(self) -> None:
        """Should not send request when seer_latest_training_model already matches new version"""
        with (
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer"
            ) as mock_get_similarity_data,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = "v1"
            metadata.seer_latest_training_model = "v2"
            metadata.save()

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_not_called()

    def test_sends_request_when_never_sent_to_seer(self) -> None:
        """Should send training request when grouphash has no seer_model"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]
            ) as mock_get_similarity_data,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Clear the seer_model to simulate never sent to Seer
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = None
            metadata.save()

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # Should call get_similarity_data_from_seer with training_mode and raise_on_error
            mock_get_similarity_data.assert_called_once()
            call_args = mock_get_similarity_data.call_args
            assert call_args[0][0]["training_mode"] is True
            assert call_args[1]["raise_on_error"] is True

            # Should update seer_latest_training_model without touching seer_model
            metadata.refresh_from_db()
            assert metadata.seer_latest_training_model == "v2"
            assert metadata.seer_model is None

    def test_sends_request_when_sent_to_old_version(self) -> None:
        """Should send training request when grouphash was sent to old version (v0 or v1)"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]
            ) as mock_get_similarity_data,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Test both v0 and v1 behave the same way
            for old_version in ["v0", "v1"]:
                mock_get_similarity_data.reset_mock()

                # Set metadata to old version, reset training model
                metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
                metadata.seer_model = old_version
                metadata.seer_latest_training_model = None
                metadata.save()
                self.grouphash = GroupHash.objects.get(id=self.grouphash.id)

                maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

                # Should call get_similarity_data_from_seer with training_mode and raise_on_error
                mock_get_similarity_data.assert_called_once()
                call_args = mock_get_similarity_data.call_args
                assert call_args[0][0]["training_mode"] is True
                assert call_args[1]["raise_on_error"] is True

                # Should update seer_latest_training_model without touching seer_model
                metadata.refresh_from_db()
                assert metadata.seer_latest_training_model == "v2"
                assert metadata.seer_model == old_version

    def test_does_not_send_duplicate_request(self) -> None:
        """Should not send a second training request after a successful one"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]
            ) as mock_get_similarity_data,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = None
            metadata.save()

            # First call should send the request
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_called_once()

            mock_get_similarity_data.reset_mock()

            # Second call should not send because seer_latest_training_model was updated to v2
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_similarity_data.assert_not_called()

    def test_does_not_update_model_on_exception(self) -> None:
        """Should not update seer_latest_training_model when the Seer request fails"""
        test_exception = Exception("Seer service unavailable")

        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                side_effect=test_exception,
            ),
            patch("sentry.grouping.ingest.seer.sentry_sdk.capture_exception"),
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = None
            metadata.save()

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # seer_latest_training_model should remain None since the request failed
            metadata.refresh_from_db()
            assert metadata.seer_latest_training_model is None

    def test_does_not_update_model_on_seer_error(self) -> None:
        """Should not update seer_latest_training_model when the Seer request fails.

        get_similarity_data_from_seer normally swallows errors and returns [], but in
        training mode it re-raises so the caller knows the embedding was not stored.
        """
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                side_effect=TimeoutError(),
            ),
            patch("sentry.grouping.ingest.seer.sentry_sdk.capture_exception"),
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = "v1"
            metadata.save()

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # seer_latest_training_model should remain None since the request timed out
            metadata.refresh_from_db()
            assert metadata.seer_latest_training_model is None
            assert metadata.seer_model == "v1"

    def test_does_not_send_when_should_call_seer_returns_false(self) -> None:
        """Should not send request when should_call_seer_for_grouping returns False"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=False),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer"
            ) as mock_get_similarity_data,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Clear seer_model to make should_send_new_model_embeddings return True
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = None
            metadata.save()

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # Should not be called because should_call_seer_for_grouping returned False
            mock_get_similarity_data.assert_not_called()

    def test_captures_exception_without_failing(self) -> None:
        """Should capture exceptions from Seer calls without failing the process"""
        test_exception = Exception("Seer service unavailable")

        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_similarity_data_from_seer",
                side_effect=test_exception,
            ),
            patch("sentry.grouping.ingest.seer.sentry_sdk.capture_exception") as mock_capture,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Clear seer_model to trigger sending to new model
            metadata, _ = GroupHashMetadata.objects.get_or_create(grouphash=self.grouphash)
            metadata.seer_model = None
            metadata.save()

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
