from typing import int
from dataclasses import replace
from hashlib import md5

import pytest

from sentry.issues.group import get_group_by_occurrence_fingerprint
from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class GetGroupByOccurrenceFingerprintTest(OccurrenceTestMixin, TestCase):
    def test_simple_fingerprint(self) -> None:
        group = self.create_group(project=self.project)
        fingerprint = "test-fingerprint-1"
        hashed_fingerprint = hash_fingerprint([fingerprint])

        GroupHash.objects.create(
            project=self.project,
            group=group,
            hash=hashed_fingerprint[0],
        )

        result = get_group_by_occurrence_fingerprint(self.project.id, fingerprint)
        assert result.id == group.id

    def test_multiple_part_fingerprint(self) -> None:
        group = self.create_group(project=self.project)
        fingerprints = ["error", "type", "location"]
        hashed_fingerprint = hash_fingerprint(fingerprints)

        for part in hashed_fingerprint:
            GroupHash.objects.create(
                project=self.project,
                group=group,
                hash=part,
            )

        for part in fingerprints:
            result = get_group_by_occurrence_fingerprint(self.project.id, part)
            assert result.id == group.id

    def test_group_not_found(self) -> None:
        fingerprint = "non-existent-fingerprint"

        with pytest.raises(Group.DoesNotExist):
            get_group_by_occurrence_fingerprint(self.project.id, fingerprint)

    def test_empty_fingerprint(self) -> None:
        group = self.create_group(project=self.project)

        hashed_empty = md5(b"").hexdigest()
        GroupHash.objects.create(
            project=self.project,
            group=group,
            hash=hashed_empty,
        )

        result = get_group_by_occurrence_fingerprint(self.project.id, "")
        assert result.id == group.id

    @with_feature("organizations:profile-file-io-main-thread-ingest")
    @requires_snuba
    def test_group_created_via_issue_platform(self) -> None:
        fingerprint = "issue-platform-fingerprint"
        event = self.store_event(data=load_data("transaction"), project_id=self.project.id)
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            project_id=self.project.id,
            fingerprint=[fingerprint],
            type=ProfileFileIOGroupType.type_id,
            issue_title="File I/O Issue",
            subtitle="High file I/O detected",
        )
        # Override the fingerprint to be unhashed since produce_occurrence_to_kafka expects
        # unhashed fingerprints (it will hash them during processing)
        occurrence = replace(occurrence, fingerprint=[fingerprint])
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
        )
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence is not None

        result = get_group_by_occurrence_fingerprint(self.project.id, fingerprint)
        assert result.title == "File I/O Issue"

    def test_same_fingerprint_different_projects(self) -> None:
        project1 = self.project
        project2 = self.create_project(organization=self.organization)

        group1 = self.create_group(project=project1, message="Group 1")
        group2 = self.create_group(project=project2, message="Group 2")

        fingerprint = "shared-fingerprint"
        hashed_fingerprint = hash_fingerprint([fingerprint])[0]

        GroupHash.objects.create(
            project=project1,
            group=group1,
            hash=hashed_fingerprint,
        )
        GroupHash.objects.create(
            project=project2,
            group=group2,
            hash=hashed_fingerprint,
        )

        result1 = get_group_by_occurrence_fingerprint(project1.id, fingerprint)
        result2 = get_group_by_occurrence_fingerprint(project2.id, fingerprint)

        assert result1.id == group1.id
        assert result2.id == group2.id
