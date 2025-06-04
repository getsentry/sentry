import unittest
from datetime import timedelta
from typing import Any
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from django.utils import timezone

from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.models.integration import Integration
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.committers import (
    _get_commit_file_changes,
    _match_commits_path,
    dedupe_commits,
    get_frame_paths,
    get_previous_releases,
    get_serialized_event_file_committers,
    score_path_match_length,
    tokenize_path,
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

    def create_commitfilechange(self, commit=None, filename=None, type=None):
        return CommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit=commit or self.create_commit(),
            filename=filename or "foo.bar",
            type=type or "M",
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
        assert get_frame_paths(self.event) == ["data"]

    def test_data_in_exception_values(self):
        self.event.data = {"exception": {"values": [{"stacktrace": {"frames": ["data"]}}]}}
        assert get_frame_paths(self.event) == ["data"]

    def test_data_does_not_match(self):
        self.event.data = {"this does not": "match"}
        assert get_frame_paths(self.event) == []

    def test_no_stacktrace_in_exception_values(self):
        self.event.data = {"exception": {"values": [{"this does not": "match"}]}}
        assert get_frame_paths(self.event) == []


class GetCommitFileChangesTestCase(CommitTestCase):
    def setUp(self):
        super().setUp()
        file_change_1 = self.create_commitfilechange(filename="hello/app.py", type="A")
        file_change_2 = self.create_commitfilechange(filename="hello/templates/app.html", type="A")
        file_change_3 = self.create_commitfilechange(filename="hello/app.py", type="M")

        # ensuring its not just getting all filechanges
        self.create_commitfilechange(filename="goodbye/app.py", type="A")

        self.file_changes = [file_change_1, file_change_2, file_change_3]
        self.commits = [file_change.commit for file_change in self.file_changes]
        self.path_name_set = {file_change.filename for file_change in self.file_changes}

    def test_no_paths(self):
        assert [] == _get_commit_file_changes(self.commits, set())

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
        assert [(file_change.commit, 2)] == _match_commits_path(file_changes, "hello/app.py")

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

        commits = sorted(((fc.commit, 2) for fc in file_changes), key=lambda fc: fc[0].id)
        assert commits == sorted(
            _match_commits_path(file_changes, "hello/app.py"), key=lambda fc: fc[0].id
        )

    def test_path_shorter_than_filechange(self):
        file_changes = [
            self.create_commitfilechange(filename="app.py", type="A"),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="A"),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="M"),
        ]

        assert set(map(lambda x: x[0], _match_commits_path(file_changes, "e/f/g/h/app.py"))) == {
            file_changes[1].commit,
            file_changes[2].commit,
        }

    def test_path_longer_than_filechange(self):
        file_changes = [
            self.create_commitfilechange(filename="app.py", type="A"),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="A"),
            self.create_commitfilechange(filename="c/d/e/f/g/h/app.py", type="M"),
        ]

        assert set(
            map(lambda x: x[0], _match_commits_path(file_changes, "/a/b/c/d/e/f/g/h/app.py"))
        ) == {file_changes[1].commit, file_changes[2].commit}


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
        super().setUp()
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
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

    def test_kotlin_java_sdk_path_mangling(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "java",
                "exception": {
                    "values": [
                        {
                            "type": "RuntimeException",
                            "value": "button clicked",
                            "module": "java.lang",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "main",
                                        "module": "com.android.internal.os.ZygoteInit",
                                        "filename": "ZygoteInit.java",
                                        "abs_path": "ZygoteInit.java",
                                        "lineno": 1003,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "run",
                                        "module": "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
                                        "filename": "RuntimeInit.java",
                                        "abs_path": "RuntimeInit.java",
                                        "lineno": 548,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "invoke",
                                        "module": "java.lang.reflect.Method",
                                        "filename": "Method.java",
                                        "abs_path": "Method.java",
                                        "in_app": False,
                                    },
                                    {
                                        "function": "main",
                                        "module": "android.app.ActivityThread",
                                        "filename": "ActivityThread.java",
                                        "abs_path": "ActivityThread.java",
                                        "lineno": 7842,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "loop",
                                        "module": "android.os.Looper",
                                        "filename": "Looper.java",
                                        "abs_path": "Looper.java",
                                        "lineno": 288,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "loopOnce",
                                        "module": "android.os.Looper",
                                        "filename": "Looper.java",
                                        "abs_path": "Looper.java",
                                        "lineno": 201,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "dispatchMessage",
                                        "module": "android.os.Handler",
                                        "filename": "Handler.java",
                                        "abs_path": "Handler.java",
                                        "lineno": 99,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "handleCallback",
                                        "module": "android.os.Handler",
                                        "filename": "Handler.java",
                                        "abs_path": "Handler.java",
                                        "lineno": 938,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "run",
                                        "module": "android.view.View$PerformClick",
                                        "filename": "View.java",
                                        "abs_path": "View.java",
                                        "lineno": 28810,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "access$3700",
                                        "module": "android.view.View",
                                        "filename": "View.java",
                                        "abs_path": "View.java",
                                        "lineno": 835,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "performClickInternal",
                                        "module": "android.view.View",
                                        "filename": "View.java",
                                        "abs_path": "View.java",
                                        "lineno": 7432,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "performClick",
                                        "module": "com.google.android.material.button.MaterialButton",
                                        "filename": "MaterialButton.java",
                                        "abs_path": "MaterialButton.java",
                                        "lineno": 1119,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "performClick",
                                        "module": "android.view.View",
                                        "filename": "View.java",
                                        "abs_path": "View.java",
                                        "lineno": 7455,
                                        "in_app": False,
                                    },
                                    {
                                        "function": "onClick",
                                        "module": "com.jetbrains.kmm.androidApp.MainActivity$$ExternalSyntheticLambda0",
                                        "lineno": 2,
                                        "in_app": True,
                                    },
                                    {
                                        "function": "$r8$lambda$hGNRcN3pFcj8CSoYZBi9fT_AXd0",
                                        "module": "com.jetbrains.kmm.androidApp.MainActivity",
                                        "lineno": 0,
                                        "in_app": True,
                                    },
                                    {
                                        "function": "onCreate$lambda-1",
                                        "module": "com.jetbrains.kmm.androidApp.MainActivity",
                                        "filename": "MainActivity.kt",
                                        "abs_path": "MainActivity.kt",
                                        "lineno": 55,
                                        "in_app": True,
                                    },
                                ]
                            },
                            "thread_id": 2,
                            "mechanism": {"type": "UncaughtExceptionHandler", "handled": False},
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
                    "patch_set": [
                        {
                            "path": "App/src/main/com/jetbrains/kmm/androidApp/MainActivity.kt",
                            "type": "M",
                        }
                    ],
                }
            ]
        )
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["score"] > 1
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

    def test_cocoa_swift_repo_relative_path(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "cocoa",
                "exception": {
                    "values": [
                        {
                            "type": "RuntimeException",
                            "value": "button clicked",
                            "module": "java.lang",
                            "thread_id": 2,
                            "mechanism": {"type": "UncaughtExceptionHandler", "handled": False},
                            "stacktrace": {
                                "frames": [
                                    {
                                        "in_app": False,
                                        "image_addr": "0x0",
                                        "instruction_addr": "0x1028d5aa4",
                                        "symbol_addr": "0x0",
                                    },
                                    {
                                        "package": "Runner",
                                        "filename": "AppDelegate.swift",
                                        "abs_path": "/Users/denis/Repos/sentry/sentry-mobile/ios/Runner/AppDelegate.swift",
                                        "lineno": 5,
                                        "in_app": True,
                                    },
                                ]
                            },
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
                    "patch_set": [{"path": "Runner/AppDelegate.swift", "type": "M"}],
                }
            ]
        )
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["score"] > 1
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

    def test_react_native_unchanged_frames(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "javascript",
                "exception": {
                    "values": [
                        {
                            "type": "unknown",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "callFunctionReturnFlushedQueue",
                                        "module": "react-native/Libraries/BatchedBridge/MessageQueue",
                                        "filename": "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
                                        "abs_path": "app:///node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
                                        "lineno": 115,
                                        "colno": 5,
                                        "in_app": False,
                                        "data": {"sourcemap": "app:///main.jsbundle.map"},
                                    },
                                    {
                                        "function": "apply",
                                        "filename": "native",
                                        "abs_path": "native",
                                        "in_app": True,
                                    },
                                    {
                                        "function": "onPress",
                                        "module": "src/screens/EndToEndTestsScreen",
                                        "filename": "src/screens/EndToEndTestsScreen.tsx",
                                        "abs_path": "app:///src/screens/EndToEndTestsScreen.tsx",
                                        "lineno": 57,
                                        "colno": 11,
                                        "in_app": True,
                                        "data": {"sourcemap": "app:///main.jsbundle.map"},
                                    },
                                ]
                            },
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
                    "patch_set": [{"path": "src/screens/EndToEndTestsScreen.tsx", "type": "M"}],
                }
            ]
        )
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["score"] == 3
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

    def test_flutter_munged_frames(self):
        event = self.store_event(
            data={
                "platform": "other",
                "sdk": {"name": "sentry.dart.flutter", "version": "1"},
                "exception": {
                    "values": [
                        {
                            "type": "StateError",
                            "value": "Bad state: try catch",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "tryCatchModule",
                                        "package": "sentry_flutter_example",
                                        "filename": "test.dart",
                                        "abs_path": "package:sentry_flutter_example/a/b/test.dart",
                                        "lineno": 8,
                                        "colno": 5,
                                        "in_app": True,
                                    },
                                ]
                            },
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
                    "patch_set": [{"path": "a/b/test.dart", "type": "M"}],
                }
            ]
        )
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["score"] == 3
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

    def test_matching(self):
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": before_now(seconds=1).isoformat(),
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
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

    @patch("sentry.utils.committers.get_frame_paths")
    def test_none_frame(self, mock_get_frame_paths):
        """Test that if a frame is None, we skip over it"""
        frames: list[Any] = [
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
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": before_now(seconds=1).isoformat(),
                "stacktrace": {
                    "frames": frames,
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
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )
        frames.append(None)
        mock_get_frame_paths.return_value = frames
        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

    def test_no_author(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            model = self.create_provider_integration(
                provider="github", external_id="github_external_id", name="getsentry"
            )
            model.add_organization(self.organization, self.user)
        GitHubIntegration(model, self.organization.id)
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": before_now(seconds=1).isoformat(),
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
        commit = self.create_commit()
        ReleaseCommit.objects.create(
            organization_id=self.organization.id, release=self.release, commit=commit, order=1
        )
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=self.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

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
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"

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
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 0

    def test_no_commits(self):
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
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
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        with pytest.raises(Commit.DoesNotExist):
            get_serialized_event_file_committers(self.project, event)

    def test_commit_context_fallback(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            Integration.objects.all().delete()
        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": before_now(seconds=1).isoformat(),
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
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        result = get_serialized_event_file_committers(self.project, event)
        assert len(result) == 1
        assert "commits" in result[0]
        assert len(result[0]["commits"]) == 1
        assert result[0]["commits"][0]["id"] == "a" * 40
        assert result[0]["commits"][0]["suspectCommitType"] == "via commit in release"


class DedupeCommits(CommitTestCase):
    def setUp(self):
        super().setUp()

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
