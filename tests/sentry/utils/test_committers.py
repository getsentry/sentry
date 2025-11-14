from typing import int
import unittest
from datetime import timedelta
from unittest.mock import Mock
from uuid import uuid4

from django.utils import timezone

from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.groupowner import GroupOwner, GroupOwnerType, SuspectCommitStrategy
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.utils.committers import (
    _get_commit_file_changes,
    _get_serialized_committers_from_group_owners,
    _match_commits_paths,
    dedupe_commits,
    get_frame_paths,
    get_previous_releases,
    get_serialized_event_file_committers,
    score_path_match_length,
    tokenize_path,
)


class CommitTestCase(TestCase):
    def setUp(self) -> None:
        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )

    def create_commit_author(self, name=None, email=None):
        return CommitAuthor.objects.create(
            organization_id=self.organization.id,
            name=name or f"Test Author {uuid4().hex[:8]}",
            email=email or f"test{uuid4().hex[:8]}@example.com",
        )

    def create_commit(self, author=None):
        return Commit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key=uuid4().hex,
            author=author,
        )

    def create_commitfilechange(self, commit=None, filename=None, type=None):
        return CommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit_id=(commit or self.create_commit()).id,
            filename=filename or "foo.bar",
            type=type or "M",
        )


class TokenizePathTestCase(unittest.TestCase):
    def test_forward_slash(self) -> None:
        assert list(tokenize_path("foo/bar")) == ["bar", "foo"]

    def test_back_slash(self) -> None:
        assert list(tokenize_path("foo\\bar")) == ["bar", "foo"]

    def test_dot_does_not_separate(self) -> None:
        assert list(tokenize_path("foo.bar")) == ["foo.bar"]

    def test_additional_slash_in_front(self) -> None:
        assert list(tokenize_path("/foo/bar")) == ["bar", "foo"]
        assert list(tokenize_path("\\foo\\bar")) == ["bar", "foo"]

    def test_relative_paths(self) -> None:
        assert list(tokenize_path("./")) == ["."]
        assert list(tokenize_path("./../")) == ["..", "."]
        assert list(tokenize_path("./foo/bar")) == ["bar", "foo", "."]
        assert list(tokenize_path(".\\foo\\bar")) == ["bar", "foo", "."]

    def test_path_with_spaces(self) -> None:
        assert list(tokenize_path("\\foo bar\\bar")) == ["bar", "foo bar"]

    def test_no_path(self) -> None:
        assert list(tokenize_path("/")) == []


class ScorePathMatchLengthTest(unittest.TestCase):
    def test_equal_paths(self) -> None:
        assert score_path_match_length("foo/bar/baz", "foo/bar/baz") == 3

    def test_partial_match_paths(self) -> None:
        assert score_path_match_length("foo/bar/baz", "bar/baz") == 2
        assert score_path_match_length("foo/bar/baz", "baz") == 1

    def test_prefix_no_score(self) -> None:
        assert score_path_match_length("foo/bar/baz", "foo") == 0

    def test_path_with_empty_path_segment(self) -> None:
        assert score_path_match_length("./foo/bar/baz", "foo/bar/baz") == 3

    def test_case_insensitive_comparison(self) -> None:
        assert score_path_match_length("./Foo/Bar/BAZ", "foo/bar/baz") == 3


class GetFramePathsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.event = Mock()
        self.event.data = {}

    def test_data_in_stacktrace_frames(self) -> None:
        self.event.data = {"stacktrace": {"frames": ["data"]}}
        assert get_frame_paths(self.event) == ["data"]

    def test_data_in_exception_values(self) -> None:
        self.event.data = {"exception": {"values": [{"stacktrace": {"frames": ["data"]}}]}}
        assert get_frame_paths(self.event) == ["data"]

    def test_data_does_not_match(self) -> None:
        self.event.data = {"this does not": "match"}
        assert get_frame_paths(self.event) == []

    def test_no_stacktrace_in_exception_values(self) -> None:
        self.event.data = {"exception": {"values": [{"this does not": "match"}]}}
        assert get_frame_paths(self.event) == []


class GetCommitFileChangesTestCase(CommitTestCase):
    def setUp(self) -> None:
        super().setUp()
        commit_1 = self.create_commit()
        commit_2 = self.create_commit()
        commit_3 = self.create_commit()
        file_change_1 = self.create_commitfilechange(
            filename="hello/app.py", type="A", commit=commit_1
        )
        file_change_2 = self.create_commitfilechange(
            filename="hello/templates/app.html", type="A", commit=commit_2
        )
        file_change_3 = self.create_commitfilechange(
            filename="hello/app.py", type="M", commit=commit_3
        )

        # ensuring its not just getting all filechanges
        self.create_commitfilechange(filename="goodbye/app.py", type="A")

        self.file_changes = [file_change_1, file_change_2, file_change_3]
        self.commits = [commit_1, commit_2, commit_3]
        self.path_name_set = {file_change.filename for file_change in self.file_changes}

    def test_no_paths(self) -> None:
        assert [] == _get_commit_file_changes(self.commits, set())

    def test_no_valid_paths(self) -> None:
        assert [] == _get_commit_file_changes(self.commits, {"/"})

    def test_simple(self) -> None:
        assert _get_commit_file_changes(self.commits, self.path_name_set) == self.file_changes


class MatchCommitsPathTestCase(CommitTestCase):
    def test_simple(self) -> None:
        commit = self.create_commit()
        file_change = self.create_commitfilechange(filename="hello/app.py", type="A", commit=commit)
        file_changes = [
            file_change,
            self.create_commitfilechange(filename="goodbye/app.js", type="A"),
        ]
        assert [(commit, 2)] == _match_commits_paths(file_changes, {"hello/app.py"})["hello/app.py"]

    def test_skip_one_score_match_longer_than_one_token(self) -> None:
        file_changes = [
            self.create_commitfilechange(filename="hello/app.py", type="A"),
            self.create_commitfilechange(filename="hello/world/app.py", type="A"),
            self.create_commitfilechange(filename="hello/world/template/app.py", type="A"),
        ]
        assert [] == _match_commits_paths(file_changes, {"app.py"})["app.py"]

    def test_similar_paths(self) -> None:
        commits = [self.create_commit(), self.create_commit(), self.create_commit()]
        file_changes = [
            self.create_commitfilechange(filename="hello/app.py", type="A", commit=commits[0]),
            self.create_commitfilechange(
                filename="world/hello/app.py", type="A", commit=commits[1]
            ),
            self.create_commitfilechange(
                filename="template/hello/app.py", type="A", commit=commits[2]
            ),
        ]
        assert [(c, 2) for c in commits] == sorted(
            _match_commits_paths(file_changes, {"hello/app.py"})["hello/app.py"],
            key=lambda fc: fc[0].id,
        )

    def test_path_shorter_than_filechange(self) -> None:
        commit_1 = self.create_commit()
        commit_2 = self.create_commit()
        file_changes = [
            self.create_commitfilechange(filename="app.py", type="A"),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="A", commit=commit_1),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="M", commit=commit_2),
        ]

        assert set(
            map(
                lambda x: x[0],
                _match_commits_paths(file_changes, {"e/f/g/h/app.py"})["e/f/g/h/app.py"],
            )
        ) == {
            commit_1,
            commit_2,
        }

    def test_path_longer_than_filechange(self) -> None:
        commit_1 = self.create_commit()
        commit_2 = self.create_commit()
        file_changes = [
            self.create_commitfilechange(filename="app.py", type="A"),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="A", commit=commit_1),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="M", commit=commit_2),
        ]

        assert set(
            map(
                lambda x: x[0],
                _match_commits_paths(file_changes, {"/a/b/c/d/e/f/g/h/app.py"})[
                    "/a/b/c/d/e/f/g/h/app.py"
                ],
            )
        ) == {commit_1, commit_2}


class GetPreviousReleasesTestCase(TestCase):
    def test_simple(self) -> None:
        current_datetime = timezone.now()

        org = self.create_organization()
        project = self.create_project(organization=org, name="foo")

        release1 = Release.objects.create(
            organization=org, version="a" * 40, date_released=current_datetime - timedelta(days=2)
        )

        release1.add_project(project)

        release2 = Release.objects.create(
            organization=org, version="b" * 40, date_released=current_datetime - timedelta(days=1)
        )

        release2.add_project(project)

        # this shouldn't be included
        release3 = Release.objects.create(
            organization=org, version="c" * 40, date_released=current_datetime
        )

        release3.add_project(project)

        releases = list(get_previous_releases(project, release2.version))

        assert len(releases) == 2
        assert releases[0] == release2
        assert releases[1] == release1


class GetSerializedEventFileCommitters(CommitTestCase):
    """Tests for the GroupOwner-based committers functionality."""

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project, message="Kaboom!")

    def test_with_scm_based_groupowner(self) -> None:
        """Test that SCM-based GroupOwner returns expected commit data."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )
        assert event.group is not None

        # Create commit author and commit with SCM strategy
        author = self.create_commit_author()
        commit = self.create_commit(author=author)
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={
                "commitId": commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
            },
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == commit.key
        assert result[0]["commits"][0]["suspectCommitType"] == "via SCM integration"

        group_owner = GroupOwner.objects.get(
            group_id=event.group.id, type=GroupOwnerType.SUSPECT_COMMIT.value
        )
        assert result[0]["group_owner_id"] == group_owner.id

    def test_with_release_based_groupowner(self) -> None:
        """Test that release-based GroupOwner returns expected commit data."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )
        assert event.group is not None

        # Create commit author and commit with release strategy
        author = self.create_commit_author()
        commit = self.create_commit(author=author)
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={
                "commitId": commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.RELEASE_BASED,
            },
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == commit.key
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

        group_owner = GroupOwner.objects.get(
            group_id=event.group.id, type=GroupOwnerType.SUSPECT_COMMIT.value
        )
        assert result[0]["group_owner_id"] == group_owner.id

    def test_with_multiple_groupowners(self) -> None:
        """Test that multiple GroupOwners return the most recent one only."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )
        assert event.group is not None

        # Create multiple commits with authors
        author1 = self.create_commit_author()
        author2 = self.create_commit_author()
        commit1 = self.create_commit(author=author1)
        commit2 = self.create_commit(author=author2)

        # Create first GroupOwner (older)
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={"commitId": commit1.id},
            date_added=timezone.now() - timedelta(hours=2),
        )

        # Create second GroupOwner (newer)
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={"commitId": commit2.id},
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_serialized_event_file_committers(self.project, event)
        # Should return the most recent one only
        assert len(result) == 1
        assert result[0]["commits"][0]["id"] == commit2.key

        # Check group_owner_id matches the most recent GroupOwner
        most_recent_group_owner = (
            GroupOwner.objects.filter(
                group_id=event.group.id, type=GroupOwnerType.SUSPECT_COMMIT.value
            )
            .order_by("-date_added")
            .first()
        )
        assert most_recent_group_owner is not None
        assert result[0]["group_owner_id"] == most_recent_group_owner.id

    def test_no_groupowners(self) -> None:
        """Test that no GroupOwners returns empty list."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_groupowner_without_commit_id(self) -> None:
        """Test that GroupOwner without commitId returns empty list."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )
        assert event.group is not None

        # Create GroupOwner without commitId in context
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={"someOtherData": "value"},
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_groupowner_with_nonexistent_commit(self) -> None:
        """Test that GroupOwner with non-existent commit returns empty list."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )
        assert event.group is not None

        # Create GroupOwner with non-existent commit ID
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={"commitId": 99999},  # Non-existent commit ID
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_groupowner_with_commit_without_author(self) -> None:
        """Test that GroupOwner with commit that has no author returns empty list."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )
        assert event.group is not None

        # Create commit without author
        commit = self.create_commit(author=None)
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
            context={"commitId": commit.id},
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_event_without_group_id(self) -> None:
        """Test that event without group_id returns empty list."""
        event = Mock()
        event.group_id = None

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_non_suspect_commit_groupowners_ignored(self) -> None:
        """Test that non-suspect-commit GroupOwners are ignored."""
        event = self.store_event(
            data={"message": "Kaboom!", "platform": "python"}, project_id=self.project.id
        )
        assert event.group is not None

        # Create GroupOwner with different type (ownership rule)
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user_id=self.user.id,
            context={"rule": "path:*.py"},
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_display_logic_with_no_user_groupowner(self) -> None:
        """Test _get_serialized_committers_from_group_owners handles user_id=None correctly."""
        group = self.create_group(project=self.project)
        # Create commit with external author (no Sentry user)
        author = self.create_commit_author(name="External Dev", email="external@example.com")
        commit = self.create_commit(author=author)

        # Create GroupOwner with user_id=None
        GroupOwner.objects.create(
            group_id=group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=None,  # No Sentry user mapping
            context={
                "commitId": commit.id,
                "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
            },
        )

        result = _get_serialized_committers_from_group_owners(self.project, group.id)

        assert result is not None
        assert len(result) == 1

        # Should use commit author data, not Sentry user data
        author = result[0]["author"]
        assert author is not None
        assert author["email"] == "external@example.com"
        assert author["name"] == "External Dev"
        assert "username" not in author  # No Sentry user data
        assert "id" not in author  # No Sentry user data
        assert result[0]["commits"][0]["id"] == commit.key
        assert result[0]["commits"][0]["suspectCommitType"] == "via SCM integration"

        group_owner = GroupOwner.objects.get(
            group_id=group.id, type=GroupOwnerType.SUSPECT_COMMIT.value
        )
        assert result[0]["group_owner_id"] == group_owner.id


class DedupeCommits(CommitTestCase):
    def setUp(self) -> None:
        super().setUp()

    def test_dedupe_with_same_commit(self) -> None:
        commit = self.create_commit().__dict__
        commits = [commit, commit, commit]
        result = dedupe_commits(commits)
        assert len(result) == 1

    def test_dedupe_with_different_commit(self) -> None:
        same_commit = self.create_commit().__dict__
        diff_commit = self.create_commit().__dict__
        commits = [same_commit, diff_commit, same_commit]
        result = dedupe_commits(commits)
        assert len(result) == 2
