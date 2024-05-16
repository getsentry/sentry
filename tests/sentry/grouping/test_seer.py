from sentry.eventstore.models import Event
from sentry.grouping.ingest.seer import should_call_seer_for_grouping
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.features import with_feature


class ShouldCallSeerTest(TestCase):
    # TODO: Add tests for rate limits, killswitches, etc once those are in place

    def test_obeys_seer_similarity_flags(self):
        for metadata_flag, grouping_flag, expected_result in [
            (False, False, False),
            (True, False, True),
            (False, True, True),
            (True, True, True),
        ]:
            with Feature(
                {
                    "projects:similarity-embeddings-metadata": metadata_flag,
                    "projects:similarity-embeddings-grouping": grouping_flag,
                }
            ):
                assert (
                    should_call_seer_for_grouping(
                        Event(
                            project_id=self.project.id,
                            event_id="11212012123120120415201309082013",
                            data={"title": "Dogs are great!"},
                        ),
                        self.project,
                    )
                    is expected_result
                ), f"Case ({metadata_flag}, {grouping_flag}) failed."

    @with_feature("projects:similarity-embeddings-grouping")
    def test_says_no_for_garbage_event(self):
        assert (
            should_call_seer_for_grouping(
                Event(
                    project_id=self.project.id,
                    event_id="11212012123120120415201309082013",
                    data={"title": "<untitled>"},
                ),
                self.project,
            )
            is False
        )
