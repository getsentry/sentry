from __future__ import absolute_import

import six
import unittest

from datetime import timedelta
from django.utils import timezone
from sentry.utils.compat.mock import Mock
from uuid import uuid4

from sentry.models import (
    Commit,
    CommitAuthor,
    CommitFileChange,
    CommitFileLineChange,
    Release,
    Repository,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.committers import (
    _get_commit_file_changes,
    _get_frame_paths,
    _match_commits_path,
    get_serialized_event_file_committers,
    get_previous_releases,
    score_path_match_length,
    tokenize_path,
    dedupe_commits,
)

# TODO(lb): Tests are still needed for _get_committers and _get_event_file_commiters


class CommitTestCase(TestCase):
    def setUp(self):
        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )

    def create_commit(self, author=None):
        return Commit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key=uuid4().hex,
            author=author,
        )

    def create_commit_with_author(self, user=None, commit=None):
        if not user:
            user = self.create_user(name="Sentry", email="sentry@sentry.io")

        author = CommitAuthor.objects.create(
            organization_id=self.organization.id,
            name=user.name,
            email=user.email,
            external_id=user.id,
        )
        if not commit:
            commit = self.create_commit(author)
        return commit

    def create_commitfilechange(self, commit=None, filename=None, type=None):
        return CommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit=commit or self.create_commit(),
            filename=filename or "foo.bar",
            type=type or "M",
        )

    def create_commitfilelinechange(self, start, end, commitfilechange=None, author=None):
        if not commitfilechange:
            commitfilechange = self.create_commitfilechange()

        return CommitFileLineChange.objects.create(
            organization_id=self.organization.id,
            commitfilechange_id=commitfilechange.id,
            author_id=commitfilechange.commit.author_id if author is None else author.id,
            line_start=start,
            line_end=end,
        )


class TokenizePathTestCase(unittest.TestCase):
    def test_forward_slash(self):
        assert list(tokenize_path("foo/bar")) == ["bar", "foo"]

    def test_back_slash(self):
        assert list(tokenize_path("foo\\bar")) == ["bar", "foo"]

    def test_dot_does_not_separate(self):
        assert list(tokenize_path("foo.bar")) == ["foo.bar"]

    def test_additional_slash_in_front(self):
        assert list(tokenize_path("/foo/bar")) == ["bar", "foo"]
        assert list(tokenize_path("\\foo\\bar")) == ["bar", "foo"]

    def test_relative_paths(self):
        assert list(tokenize_path("./")) == ["."]
        assert list(tokenize_path("./../")) == ["..", "."]
        assert list(tokenize_path("./foo/bar")) == ["bar", "foo", "."]
        assert list(tokenize_path(".\\foo\\bar")) == ["bar", "foo", "."]

    def test_path_with_spaces(self):
        assert list(tokenize_path("\\foo bar\\bar")) == ["bar", "foo bar"]

    def test_no_path(self):
        assert list(tokenize_path("/")) == []


class ScorePathMatchLengthTest(unittest.TestCase):
    def test_equal_paths(self):
        assert score_path_match_length("foo/bar/baz", "foo/bar/baz") == 3

    def test_partial_match_paths(self):
        assert score_path_match_length("foo/bar/baz", "bar/baz") == 2
        assert score_path_match_length("foo/bar/baz", "baz") == 1

    def test_prefix_no_score(self):
        assert score_path_match_length("foo/bar/baz", "foo") == 0

    def test_path_with_empty_path_segment(self):
        assert score_path_match_length("./foo/bar/baz", "foo/bar/baz") == 3

    def test_case_insensitive_comparison(self):
        assert score_path_match_length("./Foo/Bar/BAZ", "foo/bar/baz") == 3


class GetFramePathsTestCase(unittest.TestCase):
    def setUp(self):
        self.event = Mock()
        self.event.data = {}

    def test_data_in_stacktrace_frames(self):
        self.event.data = {"stacktrace": {"frames": ["data"]}}
        assert ["data"] == _get_frame_paths(self.event)

    def test_data_in_exception_values(self):
        self.event.data = {"exception": {"values": [{"stacktrace": {"frames": ["data"]}}]}}
        assert ["data"] == _get_frame_paths(self.event)

    def test_data_does_not_match(self):
        self.event.data = {"this does not": "match"}
        assert [] == _get_frame_paths(self.event)

    def test_no_stacktrace_in_exception_values(self):
        self.event.data = {"exception": {"values": [{"this does not": "match"}]}}
        assert [] == _get_frame_paths(self.event)


class GetCommitFileChangesTestCase(CommitTestCase):
    def setUp(self):
        super(GetCommitFileChangesTestCase, self).setUp()
        file_change_1 = self.create_commitfilechange(filename="hello/app.py", type="A")
        file_change_2 = self.create_commitfilechange(filename="hello/templates/app.html", type="A")
        file_change_3 = self.create_commitfilechange(filename="hello/app.py", type="M")

        # ensuring its not just getting all filechanges
        self.create_commitfilechange(filename="goodbye/app.py", type="A")

        self.file_changes = [file_change_1, file_change_2, file_change_3]
        self.commits = [file_change.commit for file_change in self.file_changes]
        self.path_name_set = {file_change.filename for file_change in self.file_changes}

    def test_no_paths(self):
        assert [] == _get_commit_file_changes(self.commits, {})

    def test_no_valid_paths(self):
        assert [] == _get_commit_file_changes(self.commits, {"/"})

    def test_simple(self):
        assert _get_commit_file_changes(self.commits, self.path_name_set) == self.file_changes


class MatchCommitsPathTestCase(CommitTestCase):
    def test_simple(self):
        file_change = self.create_commitfilechange(filename="hello/app.py", type="A")
        file_changes = [
            file_change,
            self.create_commitfilechange(filename="goodbye/app.js", type="A"),
        ]
        score_reason = "Commited file `%s` matches the run time path `%s`." % (
            "hello/app.py",
            "hello/app.py",
        )
        assert [(file_change.commit, 2, score_reason, "Low")] == _match_commits_path(
            file_changes, "hello/app.py"
        )

    def test_skip_one_score_match_longer_than_one_token(self):
        file_changes = [
            self.create_commitfilechange(filename="hello/app.py", type="A"),
            self.create_commitfilechange(filename="hello/world/app.py", type="A"),
            self.create_commitfilechange(filename="hello/world/template/app.py", type="A"),
        ]
        assert [] == _match_commits_path(file_changes, "app.py")

    def test_similar_paths(self):
        file_changes = [
            self.create_commitfilechange(filename="hello/app.py", type="A"),
            self.create_commitfilechange(filename="world/hello/app.py", type="A"),
            self.create_commitfilechange(filename="template/hello/app.py", type="A"),
        ]

        score_reason = "Commited file `%s` matches the run time path `hello/app.py`."

        commits = sorted(
            [(fc.commit, 2, score_reason % fc.filename, "Low") for fc in file_changes],
            key=lambda fc: fc[0].id,
        )
        assert commits == sorted(
            _match_commits_path(file_changes, "hello/app.py"), key=lambda fc: fc[0].id
        )

    def test_similar_paths_with_line_range(self):
        user2 = self.create_user(name="Sentry2", email="sentry2@sentry.io")
        user3 = self.create_user(name="Sentry3", email="sentry3@sentry.io")

        for user in {user2, user3}:
            CommitAuthor.objects.create(
                organization_id=self.organization.id,
                name=user.name,
                email=user.email,
                external_id=user.id,
            )

        file_changes = [
            self.create_commitfilechange(filename="hello/app.py", type="A"),
            self.create_commitfilechange(filename="world/hello/app.py", type="A"),
            self.create_commitfilechange(filename="template/hello/app.py", type="A"),
            self.create_commitfilechange(filename="hello/app.py", type="M"),
        ]

        for file_change in file_changes[:-1]:
            file_change.commit.update(author=CommitAuthor.objects.get(email=user2.email))

        file_changes[-1].commit.update(author=CommitAuthor.objects.get(email=user3.email))

        self.create_commitfilelinechange(5, 10, commitfilechange=file_changes[-1])

        score_reason = (
            "Commit modified `%s` from lines %d-%d which matches the run time path `%s:%d`."
            % ("hello/app.py", 5, 10, "hello/app.py", 6,)
        )

        commits = sorted(
            [(fc.commit, 3, score_reason, "Medium") for fc in file_changes[-1:]],
            key=lambda fc: fc[0].id,
        )
        assert commits == sorted(
            _match_commits_path(file_changes, "hello/app.py", lineno=6), key=lambda fc: fc[0].id
        )

    def test_similar_paths_with_exact_line_range(self):
        user2 = self.create_user(name="Sentry2", email="sentry2@sentry.io")
        user3 = self.create_user(name="Sentry3", email="sentry3@sentry.io")

        for user in {user2, user3}:
            CommitAuthor.objects.create(
                organization_id=self.organization.id,
                name=user.name,
                email=user.email,
                external_id=user.id,
            )

        file_changes = [
            self.create_commitfilechange(filename="hello/app.py", type="A"),
            self.create_commitfilechange(filename="world/hello/app.py", type="A"),
            self.create_commitfilechange(filename="template/hello/app.py", type="A"),
            self.create_commitfilechange(filename="hello/app.py", type="M"),
            self.create_commitfilechange(filename="hello/app.py", type="M"),
            self.create_commitfilechange(filename="world/hello/app.py", type="M"),
            self.create_commitfilechange(filename="template/hello/app.py", type="M"),
        ]

        for file_change in file_changes[:-1]:
            file_change.commit.update(author=CommitAuthor.objects.get(email=user2.email))

        file_changes[-1].commit.update(author=CommitAuthor.objects.get(email=user3.email))

        self.create_commitfilelinechange(5, 10, commitfilechange=file_changes[-3])
        self.create_commitfilelinechange(6, 6, commitfilechange=file_changes[-4])

        score_reason = (
            "Commit modified `%s` on line %d which matches the run time path `%s:%d`."
            % ("hello/app.py", 6, "hello/app.py", 6,)
        )

        commits = sorted(
            [(fc.commit, 8, score_reason, "High") for fc in file_changes[-4:-3]],
            key=lambda fc: fc[0].id,
        )

        assert commits == sorted(
            _match_commits_path(file_changes, "hello/app.py", lineno=6), key=lambda fc: fc[0].id
        )

        # Later commit also modifies the exact same line
        file_changes.extend([self.create_commitfilechange(filename="hello/app.py", type="M")])

        file_changes[-1].commit.update(author=CommitAuthor.objects.get(email=user2.email))

        self.create_commitfilelinechange(6, 6, commitfilechange=file_changes[-1])

        commits = sorted(
            [(fc.commit, 13, score_reason, "High") for fc in file_changes[-1:]],
            key=lambda fc: fc[0].id,
        )

        assert commits == sorted(
            _match_commits_path(file_changes, "hello/app.py", lineno=6), key=lambda fc: fc[0].id
        )


class GetPreviousReleasesTestCase(TestCase):
    def test_simple(self):
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


class GetEventFileCommitters(CommitTestCase):
    def setUp(self):
        super(GetEventFileCommitters, self).setUp()
        self.release = self.create_release(project=self.project, version="v12")
        self.group = self.create_group(
            project=self.project, message="Kaboom!", first_release=self.release
        )

    def test_java_sdk_path_mangling(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "java",
                "stacktrace": {
                    "frames": [
                        {
                            "function": "invoke0",
                            "abs_path": "NativeMethodAccessorImpl.java",
                            "in_app": False,
                            "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
                            "filename": "NativeMethodAccessorImpl.java",
                        },
                        {
                            "function": "home",
                            "abs_path": "Application.java",
                            "module": "io.sentry.example.Application",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "Application.java",
                        },
                        {
                            "function": "handledError",
                            "abs_path": "Application.java",
                            "module": "io.sentry.example.Application",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "Application.java",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [
                        {"path": "src/main/java/io/sentry/example/Application.java", "type": "M"}
                    ],
                }
            ]
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40

    def test_matching(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                }
            ]
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40

    def test_matching_no_line_blames(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                },
                {
                    "id": "b" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                },
                {
                    "id": "c" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob2@example.com",
                    "author_name": "Bob2",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                },
            ]
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 2
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "c" * 40

    def test_matching_by_line(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [
                        {
                            "path": "src/sentry/models/release.py",
                            "type": "M",
                            "blame": {
                                "ranges": [
                                    {
                                        "commit": {
                                            "author": {"name": "Bob", "email": "bob@example.com"},
                                        },
                                        "age": 10,
                                        "startingLine": 30,
                                        "endingLine": 75,
                                    },
                                ]
                            },
                        }
                    ],
                },
                {
                    "id": "b" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [
                        {
                            "path": "src/sentry/models/release.py",
                            "type": "M",
                            "blame": {
                                "ranges": [
                                    {
                                        "commit": {
                                            "author": {"name": "Bob", "email": "bob@example.com"},
                                        },
                                        "age": 10,
                                        "startingLine": 38,
                                        "endingLine": 40,
                                    },
                                ]
                            },
                        }
                    ],
                },
                {
                    "id": "c" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob2@example.com",
                    "author_name": "Bob2",
                    "message": "i fixed a bug",
                    "patch_set": [
                        {
                            "path": "src/sentry/models/release.py",
                            "type": "M",
                            "blame": {
                                "ranges": [
                                    {
                                        "commit": {
                                            "author": {"name": "Bob2", "email": "bob2@example.com"},
                                        },
                                        "age": 10,
                                        "startingLine": 50,
                                        "endingLine": 60,
                                    },
                                ]
                            },
                        }
                    ],
                },
            ]
        )

        result = get_serialized_event_file_committers(self.project, event)

        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "b" * 40
        assert result[0]["commits"][0]["scoreReason"] == (
            six.binary_type(
                "Commit modified `%s` from lines %d-%d which matches the run time path `%s:%d`."
                % ("src/sentry/models/release.py", 38, 40, "sentry/models/release.py", 39)
            )
        )
        assert result[0]["commits"][0]["scoreConfidence"] == six.binary_type("Medium")

    def test_matching_case_insensitive(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "csp",
                "stacktrace": {
                    "frames": [
                        {
                            "function": "roar",
                            "abs_path": "/usr/src/app/TigerMachine.cpp",
                            "module": "",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "app/TigerMachine.cpp",
                        }
                    ]
                },
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "app/tigermachine.cpp", "type": "M"}],
                }
            ]
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40

    def test_not_matching(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )
        self.release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "some/other/path.py", "type": "M"}],
                }
            ]
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_no_commits(self):
        event = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=1)),
                "message": "Kaboom!",
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
            },
            project_id=self.project.id,
        )

        with self.assertRaises(Commit.DoesNotExist):
            get_serialized_event_file_committers(self.project, event)


class DedupeCommits(CommitTestCase):
    def setUp(self):
        super(DedupeCommits, self).setUp()

    def test_dedupe_with_same_commit(self):
        commit = self.create_commit().__dict__
        commits = [commit, commit, commit]
        result = dedupe_commits(commits)
        assert len(result) == 1

    def test_dedupe_with_different_commit(self):
        same_commit = self.create_commit().__dict__
        diff_commit = self.create_commit().__dict__
        commits = [same_commit, diff_commit, same_commit]
        result = dedupe_commits(commits)
        assert len(result) == 2
