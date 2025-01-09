from typing import Any

import pytest

from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.types import (
    IncompleteSeerDataError,
    RawSeerSimilarIssueData,
    SeerSimilarIssueData,
    SimilarHashMissingGroupError,
    SimilarHashNotFoundError,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class SeerSimilarIssueDataTest(TestCase):
    def test_from_raw_simple(self):
        similar_event = save_new_event({"message": "Dogs are great!"}, self.project)
        raw_similar_issue_data: RawSeerSimilarIssueData = {
            "parent_hash": similar_event.get_primary_hash(),
            "should_group": True,
            "stacktrace_distance": 0.01,
        }

        similar_issue_data = {
            **raw_similar_issue_data,
            "parent_group_id": similar_event.group_id,
        }

        assert SeerSimilarIssueData.from_raw(
            self.project.id, raw_similar_issue_data
        ) == SeerSimilarIssueData(
            **similar_issue_data  # type:ignore[arg-type]
        )

    def test_from_raw_unexpected_data(self):
        similar_event = save_new_event({"message": "Dogs are great!"}, self.project)
        raw_similar_issue_data = {
            "parent_hash": similar_event.get_primary_hash(),
            "should_group": True,
            "stacktrace_distance": 0.01,
            "something": "unexpected",
        }

        expected_similar_issue_data = {
            "parent_hash": similar_event.get_primary_hash(),
            "should_group": True,
            "stacktrace_distance": 0.01,
            "parent_group_id": similar_event.group_id,
        }

        # Everything worked fine, in spite of the extra data
        assert SeerSimilarIssueData.from_raw(
            self.project.id, raw_similar_issue_data
        ) == SeerSimilarIssueData(
            **expected_similar_issue_data  # type:ignore[arg-type]
        )

    def test_from_raw_missing_data(self):
        similar_event = save_new_event({"message": "Dogs are great!"}, self.project)

        with pytest.raises(
            IncompleteSeerDataError,
            match="Seer similar issues response entry missing key 'parent_hash'",
        ):
            raw_similar_issue_data: Any = {
                # missing `parent_hash`
                "should_group": True,
                "stacktrace_distance": 0.01,
            }

            SeerSimilarIssueData.from_raw(self.project.id, raw_similar_issue_data)

        with pytest.raises(
            IncompleteSeerDataError,
            match="Seer similar issues response entry missing key 'stacktrace_distance'",
        ):
            raw_similar_issue_data = {
                "parent_hash": similar_event.get_primary_hash(),
                "should_group": True,
                # missing `stacktrace_distance`
            }

            SeerSimilarIssueData.from_raw(self.project.id, raw_similar_issue_data)

    def test_from_raw_nonexistent_grouphash(self):
        with pytest.raises(SimilarHashNotFoundError):
            raw_similar_issue_data = {
                "parent_hash": "not a real hash",
                "should_group": True,
                "stacktrace_distance": 0.01,
            }

            SeerSimilarIssueData.from_raw(self.project.id, raw_similar_issue_data)

    def test_from_raw_grouphash_with_no_group(self):
        existing_grouphash = GroupHash.objects.create(hash="dogs are great", project=self.project)
        assert existing_grouphash.group_id is None

        with pytest.raises(SimilarHashMissingGroupError):
            raw_similar_issue_data = {
                "parent_hash": "dogs are great",
                "should_group": True,
                "stacktrace_distance": 0.01,
            }

            SeerSimilarIssueData.from_raw(self.project.id, raw_similar_issue_data)
