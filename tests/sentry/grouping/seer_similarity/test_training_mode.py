from unittest.mock import patch

from sentry.grouping.ingest.seer import maybe_send_seer_for_new_model_training
from sentry.models.grouphash import GroupHash
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
            "sentry.grouping.ingest.seer.get_seer_similar_issues"
        ) as mock_get_seer_similar_issues:
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_seer_similar_issues.assert_not_called()

    def test_does_nothing_when_no_rollout(self) -> None:
        """Should not send request when no new version is being rolled out"""
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None),
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues"
            ) as mock_get_seer_similar_issues,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_seer_similar_issues.assert_not_called()

    def test_does_nothing_when_already_sent_to_new_version(self) -> None:
        """Should not send request when grouphash already has new version embedding"""
        with (
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues"
            ) as mock_get_seer_similar_issues,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Set the metadata to indicate already sent to v2
            metadata = self.grouphash.metadata or {}
            metadata.update(seer_model="v2")
            self.grouphash.metadata = metadata

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)
            mock_get_seer_similar_issues.assert_not_called()

    def test_sends_request_when_never_sent_to_seer(self) -> None:
        """Should send training request when grouphash has no seer_model"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues"
            ) as mock_get_seer_similar_issues,
            patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]),
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Clear the seer_model to simulate never sent to Seer
            metadata = self.grouphash.metadata or {}
            metadata.update(seer_model=None)
            self.grouphash.metadata = metadata

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # Should be called with training_mode=True
            mock_get_seer_similar_issues.assert_called_once()
            call_args = mock_get_seer_similar_issues.call_args
            assert call_args[1]["training_mode"] is True

    def test_sends_request_when_sent_to_old_version(self) -> None:
        """Should send training request when grouphash was sent to old version (v0 or v1)"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=True),
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues"
            ) as mock_get_seer_similar_issues,
            patch("sentry.grouping.ingest.seer.get_similarity_data_from_seer", return_value=[]),
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Test both v0 and v1 behave the same way
            for old_version in ["v0", "v1"]:
                mock_get_seer_similar_issues.reset_mock()

                # Set metadata to old version
                metadata = self.grouphash.metadata or {}
                metadata.update(seer_model=old_version)
                self.grouphash.metadata = metadata

                maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

                # Should be called with training_mode=True for both versions
                mock_get_seer_similar_issues.assert_called_once()
                call_args = mock_get_seer_similar_issues.call_args
                assert call_args[1]["training_mode"] is True

    def test_does_not_send_when_should_call_seer_returns_false(self) -> None:
        """Should not send request when should_call_seer_for_grouping returns False"""
        with (
            patch("sentry.grouping.ingest.seer.should_call_seer_for_grouping", return_value=False),
            patch(
                "sentry.grouping.ingest.seer.get_seer_similar_issues"
            ) as mock_get_seer_similar_issues,
            self.feature(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE),
        ):
            # Clear seer_model to make should_send_new_model_embeddings return True
            metadata = self.grouphash.metadata or {}
            metadata.update(seer_model=None)
            self.grouphash.metadata = metadata

            maybe_send_seer_for_new_model_training(self.event, self.grouphash, self.variants)

            # Should not be called because should_call_seer_for_grouping returned False
            mock_get_seer_similar_issues.assert_not_called()
