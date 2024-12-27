from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from time import time
from typing import Any
from unittest import mock
from unittest.mock import MagicMock, patch

import pytest
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition, Topic
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from sentry import eventstore, nodestore, tsdb
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.constants import MAX_VERSION_LENGTH, DataCategory
from sentry.dynamic_sampling import (
    ExtendedBoostedRelease,
    Platform,
    ProjectBoostedReleases,
    get_redis_client_for_ds,
)
from sentry.event_manager import (
    EventManager,
    _get_event_instance,
    get_event_type,
    has_pending_commit_resolution,
    materialize_metadata,
    save_grouphash_and_group,
)
from sentry.eventstore.models import Event
from sentry.exceptions import HashDiscarded
from sentry.grouping.api import GroupingConfig, load_grouping_config
from sentry.grouping.types import ErrorGroupType
from sentry.grouping.utils import hash_from_values
from sentry.ingest.inbound_filters import FilterStatKeys
from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.grouptype import (
    GroupCategory,
    PerformanceNPlusOneGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphash import GroupHash
from sentry.models.grouplink import GroupLink
from sentry.models.grouprelease import GroupRelease
from sentry.models.groupresolution import GroupResolution
from sentry.models.grouptombstone import GroupTombstone
from sentry.models.pullrequest import PullRequest, PullRequestCommit
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.options import set
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.spans.grouping.utils import hash_values
from sentry.testutils.asserts import assert_mock_called_once_with_partial
from sentry.testutils.cases import (
    PerformanceIssueTestCase,
    SnubaTestCase,
    TestCase,
    TransactionTestCase,
)
from sentry.testutils.helpers import apply_feature_flag_on_cls, override_options
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba
from sentry.tsdb.base import TSDBModel
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.usage_accountant import accountant
from sentry.utils import json
from sentry.utils.cache import cache_key_for_event
from sentry.utils.eventuser import EventUser
from sentry.utils.outcomes import Outcome
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


def make_event(**kwargs: Any) -> dict[str, Any]:
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


class EventManagerTestMixin:
    def make_release_event(self, release_name: str, project_id: int) -> Event:
        manager = EventManager(make_event(release=release_name))
        manager.normalize()
        event = manager.save(project_id)
        return event


class EventManagerTest(TestCase, SnubaTestCase, EventManagerTestMixin, PerformanceIssueTestCase):
    def test_ephemeral_interfaces_removed_on_save(self) -> None:
        manager = EventManager(make_event(platform="python"))
        manager.normalize()
        event = manager.save(self.project.id)

        group = event.group
        assert group is not None
        assert group.platform == "python"
        assert event.platform == "python"

    @mock.patch("sentry.event_manager.eventstream.backend.insert")
    def test_dupe_message_id(self, eventstream_insert: mock.MagicMock) -> None:
        # Saves the latest event to nodestore and eventstream
        project_id = self.project.id
        event_id = "a" * 32
        node_id = Event.generate_node_id(project_id, event_id)

        manager = EventManager(make_event(event_id=event_id, message="first"))
        manager.normalize()
        manager.save(project_id)
        assert nodestore.backend.get(node_id)["logentry"]["formatted"] == "first"

        manager = EventManager(make_event(event_id=event_id, message="second"))
        manager.normalize()
        manager.save(project_id)
        assert nodestore.backend.get(node_id)["logentry"]["formatted"] == "second"

        assert eventstream_insert.call_count == 2

    def test_materialze_metadata_simple(self) -> None:
        manager = EventManager(make_event(transaction="/dogs/are/great/"))
        event = manager.save(self.project.id)

        event_type = get_event_type(event.data)
        event_metadata = event_type.get_metadata(event.data)

        assert materialize_metadata(event.data, event_type, event_metadata) == {
            "type": "default",
            "culprit": "/dogs/are/great/",
            "metadata": {"title": "<unlabeled event>"},
            "title": "<unlabeled event>",
            "location": None,
        }

    def test_materialze_metadata_preserves_existing_metadata(self) -> None:
        manager = EventManager(make_event())
        event = manager.save(self.project.id)

        event.data.setdefault("metadata", {})
        event.data["metadata"]["dogs"] = "are great"  # should not get clobbered

        event_type = get_event_type(event.data)
        event_metadata_from_type = event_type.get_metadata(event.data)
        materialized = materialize_metadata(event.data, event_type, event_metadata_from_type)

        assert materialized["metadata"] == {"title": "<unlabeled event>", "dogs": "are great"}

    def test_react_error_picks_cause_error_title_subtitle(self) -> None:
        cause_error_value = "Load failed"
        # React 19 hydration error include the hydration error and a cause
        # If we derive the title from the cause error the developer will more easily distinguish them
        manager = EventManager(
            make_event(
                exception={
                    "values": [
                        {
                            "type": "TypeError",
                            "value": cause_error_value,
                            "mechanism": {
                                "type": "onerror",
                                "handled": False,
                                "source": "cause",
                                "exception_id": 1,
                                "parent_id": 0,
                            },
                        },
                        {
                            "type": "Error",
                            "value": "There was an error during concurrent rendering but React was able to recover by instead synchronously rendering the entire root.",
                            "mechanism": {
                                "type": "generic",
                                "handled": True,
                                "exception_id": 0,
                            },
                        },
                    ]
                },
            )
        )
        event = manager.save(self.project.id)
        assert event.data["metadata"]["value"] == cause_error_value
        assert event.data["metadata"]["type"] == "TypeError"
        assert event.group is not None
        assert event.group.title == f"TypeError: {cause_error_value}"

    def test_react_hydration_error_picks_cause_error_title_subtitle(self) -> None:
        cause_error_value = "Cannot read properties of undefined (reading 'nodeName')"
        # React 19 hydration error include the hydration error and a cause
        # If we derive the title from the cause error the developer will more easily distinguish them
        manager = EventManager(
            make_event(
                exception={
                    "values": [
                        {
                            "type": "TypeError",
                            "value": cause_error_value,
                            "mechanism": {
                                "type": "chained",
                                "source": "cause",
                                "exception_id": 1,
                                "parent_id": 0,
                            },
                        },
                        {
                            "type": "Error",
                            "value": "There was an error while hydrating but React was able to recover by instead client rendering from the nearest Suspense boundary.",
                            "mechanism": {
                                "type": "generic",
                                "exception_id": 0,
                            },
                        },
                    ]
                },
            )
        )
        event = manager.save(self.project.id)
        assert event.data["metadata"]["value"] == cause_error_value
        assert event.data["metadata"]["type"] == "TypeError"
        assert event.group is not None
        assert event.group.title == f"TypeError: {cause_error_value}"

    @mock.patch("sentry.signals.issue_unresolved.send_robust")
    def test_unresolves_group(self, send_robust: mock.MagicMock) -> None:
        ts = time() - 300

        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1.
        manager = EventManager(make_event(event_id="a" * 32, checksum="a" * 32, timestamp=ts))
        with self.tasks():
            event = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save()
        assert group.is_resolved()

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 50))
        event2 = manager.save(self.project.id)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert not group.is_resolved()
        assert send_robust.called

    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_does_not_unresolve_group(self, plugin_is_regression: mock.MagicMock) -> None:
        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1.
        plugin_is_regression.return_value = False

        manager = EventManager(
            make_event(event_id="a" * 32, checksum="a" * 32, timestamp=1403007314)
        )
        with self.tasks():
            manager.normalize()
            event = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save()
        assert group.is_resolved()

        manager = EventManager(
            make_event(event_id="b" * 32, checksum="a" * 32, timestamp=1403007315)
        )
        manager.normalize()
        event2 = manager.save(self.project.id)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert group.is_resolved()

    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_marks_as_unresolved_with_new_release(
        self,
        plugin_is_regression: mock.MagicMock,
        mock_send_activity_notifications_delay: mock.MagicMock,
    ) -> None:
        plugin_is_regression.return_value = True

        old_release = Release.objects.create(
            version="a",
            organization_id=self.project.organization_id,
            date_added=timezone.now() - timedelta(minutes=30),
        )
        old_release.add_project(self.project)

        manager = EventManager(
            make_event(
                event_id="a" * 32,
                checksum="a" * 32,
                timestamp=time() - 50000,  # need to work around active_at
                release=old_release.version,
            )
        )
        event = manager.save(self.project.id)

        assert event.group is not None
        group = event.group

        group.update(status=GroupStatus.RESOLVED, substatus=None)

        resolution = GroupResolution.objects.create(release=old_release, group=group)
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution.id,
            data={"version": ""},
        )

        manager = EventManager(
            make_event(
                event_id="b" * 32, checksum="a" * 32, timestamp=time(), release=old_release.version
            )
        )
        event = manager.save(self.project.id)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data["version"] == ""

        assert GroupResolution.objects.filter(group=group).exists()

        manager = EventManager(
            make_event(event_id="c" * 32, checksum="a" * 32, timestamp=time(), release="b")
        )
        event = manager.save(self.project.id)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data["version"] == "b"

        assert not GroupResolution.objects.filter(group=group).exists()

        activity = Activity.objects.get(group=group, type=ActivityType.SET_REGRESSION.value)

        mock_send_activity_notifications_delay.assert_called_once_with(activity.id)

    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_that_release_in_latest_activity_prior_to_regression_is_not_overridden(
        self,
        plugin_is_regression: mock.MagicMock,
        mock_send_activity_notifications_delay: mock.MagicMock,
    ) -> None:
        """
        Test that ensures in the case where a regression occurs, the release prior to the latest
        activity to that regression is not overridden.
        It should only be overridden if the activity was awaiting the upcoming release
        """
        plugin_is_regression.return_value = True

        # Create a release and a group associated with it
        old_release = self.create_release(
            version="foobar", date_added=timezone.now() - timedelta(minutes=30)
        )
        manager = EventManager(
            make_event(
                event_id="a" * 32,
                checksum="a" * 32,
                timestamp=time() - 50000,  # need to work around active_at
                release=old_release.version,
            )
        )
        event = manager.save(self.project.id)
        assert event.group is not None
        group = event.group
        group.update(status=GroupStatus.RESOLVED, substatus=None)

        # Resolve the group in old_release
        resolution = GroupResolution.objects.create(release=old_release, group=group)
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution.id,
            data={"version": "foobar"},
        )

        # Create a regression
        manager = EventManager(
            make_event(event_id="c" * 32, checksum="a" * 32, timestamp=time(), release="b")
        )
        event = manager.save(self.project.id)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data["version"] == "foobar"

        regressed_activity = Activity.objects.get(
            group=group, type=ActivityType.SET_REGRESSION.value
        )
        assert regressed_activity.data["version"] == "b"
        assert regressed_activity.data["follows_semver"] is False

        mock_send_activity_notifications_delay.assert_called_once_with(regressed_activity.id)

    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_current_release_version_in_latest_activity_prior_to_regression_is_not_overridden(
        self,
        plugin_is_regression: mock.MagicMock,
        mock_send_activity_notifications_delay: mock.MagicMock,
    ) -> None:
        """
        Test that ensures in the case where a regression occurs, the release prior to the latest
        activity to that regression is overridden with the release regression occurred in but the
        value of `current_release_version` used for semver is not lost in the update.
        """
        plugin_is_regression.return_value = True

        # Create a release and a group associated with it
        old_release = self.create_release(
            version="a", date_added=timezone.now() - timedelta(minutes=30)
        )
        manager = EventManager(
            make_event(
                event_id="a" * 32,
                checksum="a" * 32,
                timestamp=time() - 50000,  # need to work around active_at
                release=old_release.version,
            )
        )
        event = manager.save(self.project.id)
        assert event.group is not None
        group = event.group
        group.update(status=GroupStatus.RESOLVED, substatus=None)

        # Resolve the group in old_release
        resolution = GroupResolution.objects.create(release=old_release, group=group)
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution.id,
            data={"version": "", "current_release_version": "pre foobar"},
        )

        # Create a regression
        manager = EventManager(
            make_event(event_id="c" * 32, checksum="a" * 32, timestamp=time(), release="b")
        )
        event = manager.save(self.project.id)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data["version"] == "b"
        assert activity.data["current_release_version"] == "pre foobar"

        regressed_activity = Activity.objects.get(
            group=group, type=ActivityType.SET_REGRESSION.value
        )
        assert regressed_activity.data["version"] == "b"

        mock_send_activity_notifications_delay.assert_called_once_with(regressed_activity.id)

    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_resolved_in_release_regression_activity_follows_semver(
        self, plugin_is_regression: mock.MagicMock
    ) -> None:
        """
        Issue was marked resolved in 1.0.0, regression occurred in 2.0.0.
        If the project follows semver then the regression activity should have `follows_semver` set.
        We should also record which version the issue was resolved in as `resolved_in_version`.

        This allows the UI to say the issue was resolved in 1.0.0, regressed in 2.0.0 and
        the versions were compared using semver.
        """
        plugin_is_regression.return_value = True

        # Create a release and a group associated with it
        old_release = self.create_release(
            version="foo@1.0.0", date_added=timezone.now() - timedelta(minutes=30)
        )
        manager = EventManager(
            make_event(
                event_id="a" * 32,
                checksum="a" * 32,
                timestamp=time() - 50000,  # need to work around active_at
                release=old_release.version,
            )
        )
        event = manager.save(self.project.id)
        assert event.group is not None
        group = event.group
        group.update(status=GroupStatus.RESOLVED, substatus=None)

        # Resolve the group in old_release
        resolution = GroupResolution.objects.create(release=old_release, group=group)
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution.id,
            data={"version": "foo@1.0.0"},
        )

        # Create a regression
        manager = EventManager(
            make_event(event_id="c" * 32, checksum="a" * 32, timestamp=time(), release="foo@2.0.0")
        )
        event = manager.save(self.project.id)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data["version"] == "foo@1.0.0"

        regressed_activity = Activity.objects.get(
            group=group, type=ActivityType.SET_REGRESSION.value
        )
        assert regressed_activity.data["version"] == "foo@2.0.0"
        assert regressed_activity.data["follows_semver"] is True
        assert regressed_activity.data["resolved_in_version"] == "foo@1.0.0"

    def test_has_pending_commit_resolution(self) -> None:
        project_id = self.project.id
        event = self.make_release_event("1.0", project_id)

        group = event.group
        assert group is not None
        assert group.first_release is not None
        assert group.first_release.version == "1.0"
        assert not has_pending_commit_resolution(group)

        # Add a commit with no associated release
        repo = self.create_repo(project=group.project)
        commit = Commit.objects.create(
            organization_id=group.project.organization_id, repository_id=repo.id, key="a" * 40
        )
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
            relationship=GroupLink.Relationship.resolves,
        )

        assert has_pending_commit_resolution(group)

    def test_multiple_pending_commit_resolution(self) -> None:
        project_id = self.project.id
        event = self.make_release_event("1.0", project_id)
        group = event.group
        assert group is not None
        assert group.first_release is not None

        # Add a few commits with no associated release
        repo = self.create_repo(project=group.project)
        for key in ["a", "b", "c"]:
            commit = Commit.objects.create(
                organization_id=group.project.organization_id,
                repository_id=repo.id,
                key=key * 40,
            )
            GroupLink.objects.create(
                group_id=group.id,
                project_id=group.project_id,
                linked_type=GroupLink.LinkedType.commit,
                linked_id=commit.id,
                relationship=GroupLink.Relationship.resolves,
            )

        pending = has_pending_commit_resolution(group)
        assert pending

        # Most recent commit has been associated with a release
        latest_commit = Commit.objects.create(
            organization_id=group.project.organization_id, repository_id=repo.id, key="d" * 40
        )
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=latest_commit.id,
            relationship=GroupLink.Relationship.resolves,
        )
        ReleaseCommit.objects.create(
            organization_id=group.project.organization_id,
            release=group.first_release,
            commit=latest_commit,
            order=0,
        )

        pending = has_pending_commit_resolution(group)
        assert pending is False

    def test_has_pending_commit_resolution_issue_regression(self) -> None:
        project_id = self.project.id
        event = self.make_release_event("1.0", project_id)
        group = event.group
        assert group is not None
        repo = self.create_repo(project=group.project)

        # commit that resolved the issue is part of a PR, but all commits within the PR are unreleased
        commit = Commit.objects.create(
            organization_id=group.project.organization_id, repository_id=repo.id, key="a" * 40
        )

        second_commit = Commit.objects.create(
            organization_id=group.project.organization_id, repository_id=repo.id, key="b" * 40
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
            relationship=GroupLink.Relationship.resolves,
        )

        pr = PullRequest.objects.create(
            organization_id=group.project.organization_id,
            repository_id=repo.id,
            key="1",
        )

        PullRequestCommit.objects.create(pull_request_id=pr.id, commit_id=commit.id)
        PullRequestCommit.objects.create(pull_request_id=pr.id, commit_id=second_commit.id)

        assert PullRequestCommit.objects.filter(pull_request_id=pr.id, commit_id=commit.id).exists()
        assert PullRequestCommit.objects.filter(
            pull_request_id=pr.id, commit_id=second_commit.id
        ).exists()

        assert not ReleaseCommit.objects.filter(commit__pullrequestcommit__id=commit.id).exists()
        assert not ReleaseCommit.objects.filter(
            commit__pullrequestcommit__id=second_commit.id
        ).exists()

        pending = has_pending_commit_resolution(group)
        assert pending

    def test_has_pending_commit_resolution_issue_regression_released_commits(self) -> None:
        project_id = self.project.id
        event = self.make_release_event("1.0", project_id)
        group = event.group
        assert group is not None
        release = self.create_release(project=self.project, version="1.1")

        repo = self.create_repo(project=group.project)

        # commit 1 is part of the PR, it resolves the issue in the commit message, and is unreleased
        commit = Commit.objects.create(
            organization_id=group.project.organization_id, repository_id=repo.id, key="a" * 38
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
            relationship=GroupLink.Relationship.resolves,
        )

        # commit 2 is part of the PR, but does not resolve the issue, and is released
        released_commit = Commit.objects.create(
            organization_id=group.project.organization_id, repository_id=repo.id, key="b" * 38
        )

        # commit 3 is part of the PR, but does not resolve the issue, and is unreleased
        unreleased_commit = Commit.objects.create(
            organization_id=group.project.organization_id, repository_id=repo.id, key="c" * 38
        )

        pr = PullRequest.objects.create(
            organization_id=group.project.organization_id,
            repository_id=repo.id,
            key="19",
        )

        PullRequestCommit.objects.create(pull_request_id=pr.id, commit_id=commit.id)

        released_pr_commit = PullRequestCommit.objects.create(
            pull_request_id=pr.id, commit_id=released_commit.id
        )

        unreleased_pr_commit = PullRequestCommit.objects.create(
            pull_request_id=pr.id, commit_id=unreleased_commit.id
        )

        ReleaseCommit.objects.create(
            organization_id=group.project.organization_id,
            release=release,
            commit=released_commit,
            order=1,
        )

        assert Commit.objects.all().count() == 3
        assert PullRequestCommit.objects.filter(pull_request_id=pr.id, commit_id=commit.id).exists()
        assert PullRequestCommit.objects.filter(
            pull_request_id=pr.id, commit_id=released_commit.id
        ).exists()
        assert PullRequestCommit.objects.filter(commit__id=unreleased_pr_commit.commit.id).exists()
        assert ReleaseCommit.objects.filter(
            commit__pullrequestcommit__id=released_pr_commit.id
        ).exists()

        pending = has_pending_commit_resolution(group)
        assert pending is False

    @mock.patch("sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound")
    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_marks_as_unresolved_with_new_release_with_integration(
        self,
        plugin_is_regression: mock.MagicMock,
        mock_send_activity_notifications_delay: mock.MagicMock,
        mock_sync_status_outbound: mock.MagicMock,
    ) -> None:
        plugin_is_regression.return_value = True

        old_release = Release.objects.create(
            version="a",
            organization_id=self.project.organization_id,
            date_added=timezone.now() - timedelta(minutes=30),
        )
        old_release.add_project(self.project)

        manager = EventManager(
            make_event(
                event_id="a" * 32,
                checksum="a" * 32,
                timestamp=time() - 50000,  # need to work around active_at
                release=old_release.version,
            )
        )
        event = manager.save(self.project.id)

        assert event.group is not None
        group = event.group

        org = group.organization

        integration = self.create_integration(
            organization=org,
            external_id="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
            provider="example",
            name="Example",
        )

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=org.id, integration_id=integration.id, key="APP-%s" % group.id
        )[0]

        GroupLink.objects.get_or_create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )[0]

        group.update(status=GroupStatus.RESOLVED, substatus=None)

        resolution = GroupResolution.objects.create(release=old_release, group=group)
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            ident=resolution.id,
            data={"version": ""},
        )

        manager = EventManager(
            make_event(
                event_id="b" * 32, checksum="a" * 32, timestamp=time(), release=old_release.version
            )
        )

        with self.tasks():
            with self.feature({"organizations:integrations-issue-sync": True}):
                event = manager.save(self.project.id)
                assert event.group_id == group.id

                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.RESOLVED

                activity = Activity.objects.get(id=activity.id)
                assert activity.data["version"] == ""

                assert GroupResolution.objects.filter(group=group).exists()

                manager = EventManager(
                    make_event(event_id="c" * 32, checksum="a" * 32, timestamp=time(), release="b")
                )
                event = manager.save(self.project.id)
                assert event.group is not None
                mock_sync_status_outbound.assert_called_once_with(
                    external_issue, False, event.group.project_id
                )
                assert event.group_id == group.id

                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.UNRESOLVED

                activity = Activity.objects.get(id=activity.id)
                assert activity.data["version"] == "b"

                assert not GroupResolution.objects.filter(group=group).exists()

                activity = Activity.objects.get(group=group, type=ActivityType.SET_REGRESSION.value)

                mock_send_activity_notifications_delay.assert_called_once_with(activity.id)

    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_does_not_mark_as_unresolved_with_pending_commit(
        self,
        plugin_is_regression: mock.MagicMock,
        mock_send_activity_notifications_delay: mock.MagicMock,
    ) -> None:
        plugin_is_regression.return_value = True

        repo = self.create_repo(project=self.project)
        commit = self.create_commit(repo=repo)

        manager = EventManager(
            make_event(
                event_id="a" * 32,
                checksum="a" * 32,
                timestamp=time() - 50000,  # need to work around active_at
            )
        )
        event = manager.save(self.project.id)

        group = event.group
        assert group is not None

        group.update(status=GroupStatus.RESOLVED, substatus=None)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_id=commit.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=time()))
        event = manager.save(self.project.id)
        assert event.group is not None
        assert event.group_id == group.id

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_mark_as_unresolved_with_released_commit(
        self,
        plugin_is_regression: mock.MagicMock,
        mock_send_activity_notifications_delay: mock.MagicMock,
    ) -> None:
        plugin_is_regression.return_value = True

        release = self.create_release(project=self.project)
        repo = self.create_repo(project=self.project)
        commit = self.create_commit(repo=repo, release=release, project=self.project)

        manager = EventManager(
            make_event(
                event_id="a" * 32,
                checksum="a" * 32,
                timestamp=time() - 50000,  # need to work around active_at
            )
        )
        event = manager.save(self.project.id)

        group = event.group
        assert group is not None

        group.update(status=GroupStatus.RESOLVED, substatus=None)

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_id=commit.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=time()))

        event = manager.save(self.project.id)
        assert event.group is not None
        assert event.group_id == group.id

        assert Group.objects.get(id=group.id).status == GroupStatus.UNRESOLVED

    @mock.patch("sentry.models.Group.is_resolved")
    def test_unresolves_group_with_auto_resolve(self, mock_is_resolved: mock.MagicMock) -> None:
        ts = time() - 100
        mock_is_resolved.return_value = False
        manager = EventManager(make_event(event_id="a" * 32, checksum="a" * 32, timestamp=ts))
        with self.tasks():
            event = manager.save(self.project.id)
        assert event.group is not None

        mock_is_resolved.return_value = True
        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 100))
        with self.tasks():
            event2 = manager.save(self.project.id)
        assert event2.group is not None
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group.id)
        assert group.active_at
        assert group.active_at.replace(second=0) == event2.datetime.replace(second=0)
        assert group.active_at.replace(second=0) != event.datetime.replace(second=0)

    def test_invalid_transaction(self) -> None:
        dict_input = {"messages": "foo"}
        manager = EventManager(make_event(transaction=dict_input))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.transaction is None

    def test_transaction_as_culprit(self) -> None:
        manager = EventManager(make_event(transaction="foobar"))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.transaction == "foobar"
        assert event.culprit == "foobar"

    def test_culprit_is_not_transaction(self) -> None:
        manager = EventManager(make_event(culprit="foobar"))
        manager.normalize()
        event1 = manager.save(self.project.id)
        assert event1.transaction is None
        assert event1.culprit == "foobar"

    def test_culprit_after_stacktrace_processing(self) -> None:
        from sentry.grouping.enhancer import Enhancements

        enhancements_str = Enhancements.from_config_string(
            """
            function:in_app_function +app
            function:not_in_app_function -app
            """
        ).dumps()

        grouping_config = {"id": DEFAULT_GROUPING_CONFIG, "enhancements": enhancements_str}

        with patch(
            "sentry.grouping.ingest.hashing.get_grouping_config_dict_for_project",
            return_value=grouping_config,
        ):
            manager = EventManager(
                make_event(
                    platform="native",
                    exception={
                        "values": [
                            {
                                "type": "Hello",
                                "stacktrace": {
                                    "frames": [
                                        {
                                            "function": "not_in_app_function",
                                        },
                                        {
                                            "function": "in_app_function",
                                        },
                                    ]
                                },
                            }
                        ]
                    },
                )
            )
            manager.normalize()
            event1 = manager.save(self.project.id)
            assert event1.transaction is None
            assert event1.culprit == "in_app_function"

    def test_inferred_culprit_from_empty_stacktrace(self) -> None:
        manager = EventManager(make_event(stacktrace={"frames": []}))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.culprit == ""

    def test_transaction_and_culprit(self) -> None:
        manager = EventManager(make_event(transaction="foobar", culprit="baz"))
        manager.normalize()
        event1 = manager.save(self.project.id)
        assert event1.transaction == "foobar"
        assert event1.culprit == "baz"

    def test_release_with_empty_version(self) -> None:
        cases = ["", " ", "\t", "\n"]
        for case in cases:
            event = self.make_release_event(case, self.project.id)
            assert event.group is not None
            assert not event.group.first_release
            assert Release.objects.filter(projects__in=[self.project.id]).count() == 0
            assert Release.objects.filter(organization_id=self.project.organization_id).count() == 0

    def test_first_release(self) -> None:
        project_id = self.project.id
        event = self.make_release_event("1.0", project_id)

        group = event.group
        assert group is not None
        assert group.first_release is not None
        assert group.first_release.version == "1.0"

        event = self.make_release_event("2.0", project_id)

        group = event.group
        assert group is not None
        assert group.first_release is not None
        assert group.first_release.version == "1.0"

    def test_release_project_slug(self) -> None:
        project = self.create_project(name="foo")
        release = Release.objects.create(version="foo-1.0", organization=project.organization)
        release.add_project(project)

        event = self.make_release_event("1.0", project.id)

        group = event.group
        assert group is not None
        assert group.first_release is not None
        assert group.first_release.version == "foo-1.0"
        release_tag = [v for k, v in event.tags if k == "sentry:release"][0]
        assert release_tag == "foo-1.0"

        event = self.make_release_event("2.0", project.id)

        group = event.group
        assert group is not None
        assert group.first_release is not None
        assert group.first_release.version == "foo-1.0"

    def test_release_project_slug_long(self) -> None:
        project = self.create_project(name="foo")
        partial_version_len = MAX_VERSION_LENGTH - 4
        release = Release.objects.create(
            version="foo-{}".format("a" * partial_version_len), organization=project.organization
        )
        release.add_project(project)

        event = self.make_release_event("a" * partial_version_len, project.id)

        group = event.group
        assert group is not None
        assert group.first_release is not None
        assert group.first_release.version == "foo-{}".format("a" * partial_version_len)
        release_tag = [v for k, v in event.tags if k == "sentry:release"][0]
        assert release_tag == "foo-{}".format("a" * partial_version_len)

    def test_group_release_no_env(self) -> None:
        project_id = self.project.id
        event = self.make_release_event("1.0", project_id)
        assert event.group_id is not None

        release = Release.objects.get(version="1.0", projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id, group_id=event.group_id, environment=""
        ).exists()

        # ensure we're not erroring on second creation
        self.make_release_event("1.0", project_id)

    def test_group_release_with_env(self) -> None:
        manager = EventManager(make_event(release="1.0", environment="prod", event_id="a" * 32))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.group_id is not None

        release = Release.objects.get(version="1.0", projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id, group_id=event.group_id, environment="prod"
        ).exists()

        manager = EventManager(make_event(release="1.0", environment="staging", event_id="b" * 32))
        event = manager.save(self.project.id)

        release = Release.objects.get(version="1.0", projects=event.project_id)

        assert event.group_id is not None
        assert GroupRelease.objects.filter(
            release_id=release.id, group_id=event.group_id, environment="staging"
        ).exists()

    def test_tsdb(self) -> None:
        project = self.project
        manager = EventManager(
            make_event(
                fingerprint=["totally unique super duper fingerprint"],
                environment="totally unique super duper environment",
            )
        )
        event = manager.save(project.id)
        assert event.group is not None

        def query(model: TSDBModel, key: int, **kwargs: Any) -> int:
            return tsdb.backend.get_sums(
                model,
                [key],
                event.datetime,
                event.datetime,
                tenant_ids={"organization_id": 123, "referrer": "r"},
                **kwargs,
            )[key]

        assert query(TSDBModel.project, project.id) == 1
        assert query(TSDBModel.group, event.group.id) == 1

        environment_id = Environment.get_for_organization_id(
            event.project.organization_id, "totally unique super duper environment"
        ).id
        assert query(TSDBModel.project, project.id, environment_id=environment_id) == 1
        assert query(TSDBModel.group, event.group.id, environment_id=environment_id) == 1

    def test_event_user(self) -> None:
        event_id = uuid.uuid4().hex
        manager = EventManager(
            make_event(
                event_id=event_id, environment="totally unique environment", **{"user": {"id": "1"}}
            )
        )
        manager.normalize()
        with self.tasks():
            event = manager.save(self.project.id)
        assert event.group is not None

        environment_id = Environment.get_for_organization_id(
            event.project.organization_id, "totally unique environment"
        ).id

        assert tsdb.backend.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            (event.group.id,),
            event.datetime,
            event.datetime,
            tenant_ids={"referrer": "r", "organization_id": 123},
        ) == {event.group.id: 1}

        assert tsdb.backend.get_distinct_counts_totals(
            TSDBModel.users_affected_by_project,
            (event.project.id,),
            event.datetime,
            event.datetime,
            tenant_ids={"organization_id": 123, "referrer": "r"},
        ) == {event.project.id: 1}

        assert tsdb.backend.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            (event.group.id,),
            event.datetime,
            event.datetime,
            environment_id=environment_id,
            tenant_ids={"organization_id": 123, "referrer": "r"},
        ) == {event.group.id: 1}

        assert tsdb.backend.get_distinct_counts_totals(
            TSDBModel.users_affected_by_project,
            (event.project.id,),
            event.datetime,
            event.datetime,
            environment_id=environment_id,
            tenant_ids={"organization_id": 123, "referrer": "r"},
        ) == {event.project.id: 1}

        saved_event = eventstore.backend.get_event_by_id(self.project.id, event_id)
        assert saved_event is not None
        euser = EventUser.from_event(saved_event)
        assert event.get_tag("sentry:user") == euser.tag_value

        # clear the cache otherwise the cached EventUser from prev
        # manager.save() will be used instead of jane
        cache.clear()

        # ensure event user is mapped to tags in second attempt
        event_id_2 = uuid.uuid4().hex
        manager = EventManager(
            make_event(event_id=event_id_2, **{"user": {"id": "1", "name": "jane"}})
        )
        manager.normalize()
        with self.tasks():
            manager.save(self.project.id)

        saved_event = eventstore.backend.get_event_by_id(self.project.id, event_id_2)
        assert saved_event is not None
        euser = EventUser.from_event(saved_event)
        assert event.get_tag("sentry:user") == euser.tag_value
        assert euser.name == "jane"
        assert euser.user_ident == "1"

    def test_event_user_invalid_ip(self) -> None:
        event_id = uuid.uuid4().hex
        manager = EventManager(
            make_event(
                event_id=event_id, environment="totally unique environment", **{"user": {"id": "1"}}
            )
        )

        manager.normalize()

        # This can happen as part of PII stripping, which happens after normalization
        manager._data["user"]["ip_address"] = "[ip]"

        with self.tasks():
            manager.save(self.project.id)

        saved_event = eventstore.backend.get_event_by_id(self.project.id, event_id)
        assert saved_event is not None
        euser = EventUser.from_event(saved_event)
        assert euser.ip_address is None

    def test_event_user_unicode_identifier(self) -> None:
        event_id = uuid.uuid4().hex
        manager = EventManager(make_event(event_id=event_id, **{"user": {"username": "foô"}}))
        manager.normalize()
        with self.tasks():
            manager.save(self.project.id)

        saved_event = eventstore.backend.get_event_by_id(self.project.id, event_id)
        assert saved_event is not None
        euser = EventUser.from_event(saved_event)
        assert euser.username == "foô"

    def test_environment(self) -> None:
        manager = EventManager(make_event(**{"environment": "beta"}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert dict(event.tags).get("environment") == "beta"

    def test_invalid_environment(self) -> None:
        manager = EventManager(make_event(**{"environment": "bad/name"}))
        manager.normalize()
        event = manager.save(self.project.id)
        assert dict(event.tags).get("environment") is None

    def test_invalid_tags(self) -> None:
        manager = EventManager(make_event(**{"tags": [42]}))
        manager.normalize()
        assert None in manager.get_data().get("tags", [])
        assert 42 not in manager.get_data().get("tags", [])
        event = manager.save(self.project.id)
        assert 42 not in event.tags
        assert None not in event.tags

    @mock.patch("sentry.event_manager.eventstream.backend.insert")
    def test_group_environment(self, eventstream_insert: mock.MagicMock) -> None:
        release_version = "1.0"

        def save_event() -> Event:
            manager = EventManager(
                make_event(
                    **{
                        "message": "foo",
                        "event_id": uuid.uuid1().hex,
                        "environment": "beta",
                        "release": release_version,
                    }
                )
            )
            manager.normalize()
            return manager.save(self.project.id)

        event = save_event()
        assert event.group_id is not None

        # Ensure the `GroupEnvironment` record was created.
        instance = GroupEnvironment.objects.get(
            group_id=event.group_id,
            environment_id=Environment.objects.get(
                organization_id=self.project.organization_id, name=event.get_tag("environment")
            ).id,
        )

        assert Release.objects.get(id=instance.first_release_id).version == release_version

        group_states1 = {
            "is_new": True,
            "is_regression": False,
            "is_new_group_environment": True,
        }
        # Ensure that the first event in the (group, environment) pair is
        # marked as being part of a new environment.
        assert event.group is not None
        eventstream_insert.assert_called_with(
            event=event,
            **group_states1,
            primary_hash="acbd18db4cc2f85cedef654fccc4a4d8",
            skip_consume=False,
            received_timestamp=event.data["received"],
            group_states=[{"id": event.group.id, **group_states1}],
        )

        event = save_event()

        group_states2 = {
            "is_new": False,
            "is_regression": False,
            "is_new_group_environment": False,
        }

        # Ensure that the next event in the (group, environment) pair is *not*
        # marked as being part of a new environment.
        assert event.group is not None
        eventstream_insert.assert_called_with(
            event=event,
            **group_states2,
            primary_hash="acbd18db4cc2f85cedef654fccc4a4d8",
            skip_consume=False,
            received_timestamp=event.data["received"],
            group_states=[{"id": event.group.id, **group_states2}],
        )

    def test_default_event_type(self) -> None:
        manager = EventManager(make_event(message="foo bar"))
        manager.normalize()
        data = manager.get_data()
        assert data["type"] == "default"
        event = manager.save(self.project.id)
        group = event.group
        assert group is not None
        assert group.data["type"] == "default"
        assert group.data["metadata"]["title"] == "foo bar"

    def test_message_event_type(self) -> None:
        manager = EventManager(
            make_event(
                **{
                    "message": "",
                    "logentry": {"formatted": "foo bar", "message": "foo %s", "params": ["bar"]},
                }
            )
        )
        manager.normalize()
        data = manager.get_data()
        assert data["type"] == "default"
        event = manager.save(self.project.id)
        group = event.group
        assert group is not None
        assert group.data["type"] == "default"
        assert group.data["metadata"]["title"] == "foo bar"

    def test_error_event_type(self) -> None:
        manager = EventManager(
            make_event(**{"exception": {"values": [{"type": "Foo", "value": "bar"}]}})
        )
        manager.normalize()
        data = manager.get_data()
        assert data["type"] == "error"
        event = manager.save(self.project.id)
        group = event.group
        assert group is not None
        assert group.data.get("type") == "error"
        assert group.data.get("metadata") == {
            "type": "Foo",
            "value": "bar",
            "initial_priority": PriorityLevel.HIGH,
        }

    def test_csp_event_type(self) -> None:
        manager = EventManager(
            make_event(
                **{
                    "csp": {
                        "effective_directive": "script-src",
                        "blocked_uri": "http://example.com",
                    },
                    # this normally is noramlized in relay as part of ingest
                    "logentry": {"message": "Blocked 'script' from 'example.com'"},
                }
            )
        )
        manager.normalize()
        data = manager.get_data()
        assert data["type"] == "csp"
        event = manager.save(self.project.id)
        group = event.group
        assert group is not None
        assert group.data.get("type") == "csp"
        assert group.data.get("metadata") == {
            "directive": "script-src",
            "initial_priority": PriorityLevel.HIGH,
            "uri": "example.com",
            "message": "Blocked 'script' from 'example.com'",
        }
        assert group.title == "Blocked 'script' from 'example.com'"

    def test_transaction_event_type(self) -> None:
        manager = EventManager(
            make_event(
                **{
                    "transaction": "wait",
                    "contexts": {
                        "trace": {
                            "parent_span_id": "bce14471e0e9654d",
                            "op": "foobar",
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "span_id": "bf5be759039ede9a",
                        }
                    },
                    "spans": [],
                    "timestamp": "2019-06-14T14:01:40Z",
                    "start_timestamp": "2019-06-14T14:01:40Z",
                    "type": "transaction",
                }
            )
        )
        manager.normalize()
        data = manager.get_data()
        assert data["type"] == "transaction"

    def test_transaction_event_span_grouping(self) -> None:
        manager = EventManager(
            make_event(
                **{
                    "transaction": "wait",
                    "contexts": {
                        "trace": {
                            "parent_span_id": "bce14471e0e9654d",
                            "op": "foobar",
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "span_id": "bf5be759039ede9a",
                        }
                    },
                    "spans": [
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "a" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span a",
                        },
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "b" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span a",
                        },
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "c" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span b",
                        },
                    ],
                    "timestamp": "2019-06-14T14:01:40Z",
                    "start_timestamp": "2019-06-14T14:01:40Z",
                    "type": "transaction",
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)
        data = event.data
        assert data["type"] == "transaction"
        assert data["span_grouping_config"]["id"] == "default:2022-10-27"
        spans = [{"hash": span["hash"]} for span in data["spans"]]
        # the basic strategy is to simply use the description
        assert spans == [{"hash": hash_values([span["description"]])} for span in data["spans"]]

    def test_transaction_sampler_and_receive(self) -> None:
        # make sure with the option on we don't get any errors
        manager = EventManager(
            make_event(
                **{
                    "transaction": "wait",
                    "contexts": {
                        "trace": {
                            "parent_span_id": "bce14471e0e9654d",
                            "op": "foobar",
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "span_id": "bf5be759039ede9a",
                        }
                    },
                    "spans": [
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "a" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span a",
                        },
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "b" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span a",
                        },
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "c" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span b",
                        },
                    ],
                    "timestamp": "2019-06-14T14:01:40Z",
                    "start_timestamp": "2019-06-14T14:01:40Z",
                    "type": "transaction",
                    "transaction_info": {
                        "source": "url",
                    },
                }
            )
        )
        manager.normalize()
        manager.save(self.project.id)

    @patch("sentry.event_manager.record_event_processed")
    @patch("sentry.event_manager.record_user_context_received")
    @patch("sentry.event_manager.record_release_received")
    @patch("sentry.ingest.transaction_clusterer.datasource.redis._record_sample")
    def test_transaction_sampler_and_receive_mock_called(
        self,
        mock_record_sample: mock.MagicMock,
        mock_record_release: mock.MagicMock,
        mock_record_user: mock.MagicMock,
        mock_record_event: mock.MagicMock,
    ) -> None:
        manager = EventManager(
            make_event(
                **{
                    "transaction": "wait",
                    "contexts": {
                        "trace": {
                            "parent_span_id": "bce14471e0e9654d",
                            "op": "foobar",
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "span_id": "bf5be759039ede9a",
                        }
                    },
                    "spans": [
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "a" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span a",
                        },
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "b" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span a",
                        },
                        {
                            "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                            "parent_span_id": "bf5be759039ede9a",
                            "span_id": "c" * 16,
                            "start_timestamp": 0,
                            "timestamp": 1,
                            "same_process_as_parent": True,
                            "op": "default",
                            "description": "span b",
                        },
                    ],
                    "timestamp": "2019-06-14T14:01:40Z",
                    "start_timestamp": "2019-06-14T14:01:40Z",
                    "type": "transaction",
                    "transaction_info": {
                        "source": "url",
                    },
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)

        mock_record_event.assert_called_once_with(self.project, event)
        mock_record_user.assert_called_once_with(self.project, event)
        mock_record_release.assert_called_once_with(self.project, event)
        assert mock_record_sample.mock_calls == [
            mock.call(ClustererNamespace.TRANSACTIONS, self.project, "wait")
        ]

    def test_sdk(self) -> None:
        manager = EventManager(make_event(**{"sdk": {"name": "sentry-unity", "version": "1.0"}}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data["sdk"] == {
            "name": "sentry-unity",
            "version": "1.0",
            "integrations": None,
            "packages": None,
        }

    def test_sdk_group_tagging(self) -> None:
        manager = EventManager(
            make_event(**{"sdk": {"name": "sentry-native-unity", "version": "1.0"}})
        )
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.group is not None

        sdk_metadata = event.group.data["metadata"]["sdk"]
        assert sdk_metadata["name"] == "sentry-native-unity"
        assert sdk_metadata["name_normalized"] == "sentry.native.unity"

    def test_no_message(self) -> None:
        # test that the message is handled gracefully
        manager = EventManager(
            make_event(**{"message": None, "logentry": {"message": "hello world"}})
        )
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.message == "hello world"

    def test_search_message_simple(self) -> None:
        manager = EventManager(
            make_event(
                **{
                    "message": "test",
                    "transaction": "sentry.tasks.process",
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)

        search_message = event.search_message
        assert "test" in search_message
        assert "sentry.tasks.process" in search_message

    def test_search_message_prefers_log_entry_message(self) -> None:
        manager = EventManager(
            make_event(
                **{
                    "message": "test",
                    "logentry": {"message": "hello world"},
                    "transaction": "sentry.tasks.process",
                }
            )
        )
        manager.normalize()
        event = manager.save(self.project.id)

        search_message = event.search_message
        assert "test" not in search_message
        assert "hello world" in search_message
        assert "sentry.tasks.process" in search_message

    def test_search_message_skips_requested_keys(self) -> None:
        from sentry.eventstore import models

        with patch.object(models, "SEARCH_MESSAGE_SKIPPED_KEYS", ("dogs",)):
            manager = EventManager(
                make_event(
                    **{
                        "logentry": {"message": "hello world"},
                        "transaction": "sentry.tasks.process",
                    }
                )
            )
            manager.normalize()
            # Normalizing nukes any metadata we might pass when creating the event and event
            # manager, so we have to add it in here
            manager._data["metadata"] = {"dogs": "are great", "maisey": "silly", "charlie": "goofy"}

            event = manager.save(
                self.project.id,
            )

            search_message = event.search_message
            assert "hello world" in search_message
            assert "sentry.tasks.process" in search_message
            assert "silly" in search_message
            assert "goofy" in search_message
            assert "are great" not in search_message  # "dogs" key is skipped

    def test_search_message_skips_bools_and_numbers(self) -> None:
        from sentry.eventstore import models

        with patch.object(models, "SEARCH_MESSAGE_SKIPPED_KEYS", ("dogs",)):
            manager = EventManager(
                make_event(
                    **{
                        "logentry": {"message": "hello world"},
                        "transaction": "sentry.tasks.process",
                    }
                )
            )
            manager.normalize()
            # Normalizing nukes any metadata we might pass when creating the event and event
            # manager, so we have to add it in here
            manager._data["metadata"] = {
                "dogs are great": True,
                "maisey": 12312012,
                "charlie": 1121.2012,
                "adopt": "don't shop",
            }

            event = manager.save(
                self.project.id,
            )

            search_message = event.search_message
            assert "hello world" in search_message
            assert "sentry.tasks.process" in search_message
            assert "True" not in search_message  # skipped because it's a boolean
            assert "12312012" not in search_message  # skipped because it's an int
            assert "1121.2012" not in search_message  # skipped because it's a float
            assert "don't shop" in search_message

    def test_stringified_message(self) -> None:
        manager = EventManager(make_event(**{"message": 1234}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data["logentry"] == {"formatted": "1234", "message": None, "params": None}

    def test_bad_message(self) -> None:
        # test that invalid messages are rejected
        manager = EventManager(make_event(**{"message": ["asdf"]}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.message == '["asdf"]'
        assert "logentry" in event.data

    def test_message_attribute_goes_to_interface(self) -> None:
        manager = EventManager(make_event(**{"message": "hello world"}))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.data["logentry"] == {
            "formatted": "hello world",
            "message": None,
            "params": None,
        }

    def test_message_attribute_shadowing(self) -> None:
        # Logentry shadows the legacy message attribute.
        manager = EventManager(
            make_event(**{"message": "world hello", "logentry": {"message": "hello world"}})
        )
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.data["logentry"] == {
            "formatted": "hello world",
            "message": None,
            "params": None,
        }

    def test_message_attribute_interface_both_strings(self) -> None:
        manager = EventManager(
            make_event(**{"logentry": "a plain string", "message": "another string"})
        )
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.data["logentry"] == {
            "formatted": "a plain string",
            "message": None,
            "params": None,
        }

    def test_throws_when_matches_discarded_hash(self) -> None:
        manager = EventManager(make_event(message="foo", event_id="a" * 32, fingerprint=["a" * 32]))
        with self.tasks():
            event = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            data=group.data,
            previous_group_id=group.id,
        )
        GroupHash.objects.filter(group=group).update(group=None, group_tombstone_id=tombstone.id)

        manager = EventManager(
            make_event(message="foo", event_id="b" * 32, fingerprint=["a" * 32]),
            project=self.project,
        )
        manager.normalize()

        a1 = CachedAttachment(name="a1", data=b"hello")
        a2 = CachedAttachment(name="a2", data=b"world")

        cache_key = cache_key_for_event(manager.get_data())
        attachment_cache.set(cache_key, attachments=[a1, a2])

        from sentry.utils.outcomes import track_outcome

        mock_track_outcome = mock.Mock(wraps=track_outcome)
        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            with self.feature("organizations:event-attachments"):
                with self.tasks():
                    with pytest.raises(HashDiscarded):
                        manager.save(self.project.id, cache_key=cache_key, has_attachments=True)

        assert mock_track_outcome.call_count == 3

        for o in mock_track_outcome.mock_calls:
            assert o.kwargs["outcome"] == Outcome.FILTERED
            assert o.kwargs["reason"] == FilterStatKeys.DISCARDED_HASH

        o = mock_track_outcome.mock_calls[0]
        assert o.kwargs["category"] == DataCategory.ERROR

        for o in mock_track_outcome.mock_calls[1:]:
            assert o.kwargs["category"] == DataCategory.ATTACHMENT
            assert o.kwargs["quantity"] == 5

    def test_honors_crash_report_limit(self) -> None:
        from sentry.utils.outcomes import track_outcome

        mock_track_outcome = mock.Mock(wraps=track_outcome)

        # Allow exactly one crash report
        self.project.update_option("sentry:store_crash_reports", 1)

        manager = EventManager(
            make_event(message="foo", event_id="a" * 32, fingerprint=["a" * 32]),
            project=self.project,
        )
        manager.normalize()

        a1 = CachedAttachment(name="a1", data=b"hello", type="event.minidump")
        a2 = CachedAttachment(name="a2", data=b"world")
        cache_key = cache_key_for_event(manager.get_data())
        attachment_cache.set(cache_key, attachments=[a1, a2])

        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            with self.feature("organizations:event-attachments"):
                with self.tasks():
                    manager.save(self.project.id, cache_key=cache_key, has_attachments=True)

        # The first minidump should be accepted, since the limit is 1
        assert mock_track_outcome.call_count == 3
        for o in mock_track_outcome.mock_calls:
            assert o.kwargs["outcome"] == Outcome.ACCEPTED

        mock_track_outcome.reset_mock()

        manager = EventManager(
            make_event(message="foo", event_id="b" * 32, fingerprint=["a" * 32]),
            project=self.project,
        )
        manager.normalize()

        cache_key = cache_key_for_event(manager.get_data())
        attachment_cache.set(cache_key, attachments=[a1, a2])

        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            with self.feature("organizations:event-attachments"):
                with self.tasks():
                    event = manager.save(self.project.id, cache_key=cache_key, has_attachments=True)

        assert event.data["metadata"]["stripped_crash"] is True

        assert mock_track_outcome.call_count == 3
        o = mock_track_outcome.mock_calls[0]
        assert o.kwargs["outcome"] == Outcome.FILTERED
        assert o.kwargs["category"] == DataCategory.ATTACHMENT
        assert o.kwargs["reason"] == FilterStatKeys.CRASH_REPORT_LIMIT

        for o in mock_track_outcome.mock_calls[1:]:
            assert o.kwargs["outcome"] == Outcome.ACCEPTED

    def test_event_accepted_outcome(self) -> None:
        manager = EventManager(make_event(message="foo"))
        manager.normalize()

        mock_track_outcome = mock.Mock()
        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            manager.save(self.project.id)

        assert_mock_called_once_with_partial(
            mock_track_outcome, outcome=Outcome.ACCEPTED, category=DataCategory.ERROR
        )

    def test_attachment_accepted_outcomes(self) -> None:
        manager = EventManager(make_event(message="foo"), project=self.project)
        manager.normalize()

        a1 = CachedAttachment(name="a1", data=b"hello")
        a2 = CachedAttachment(name="a2", data=b"limited", rate_limited=True)
        a3 = CachedAttachment(name="a3", data=b"world")

        cache_key = cache_key_for_event(manager.get_data())
        attachment_cache.set(cache_key, attachments=[a1, a2, a3])

        mock_track_outcome = mock.Mock()
        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            with self.feature("organizations:event-attachments"):
                manager.save(self.project.id, cache_key=cache_key, has_attachments=True)

        assert mock_track_outcome.call_count == 3

        for o in mock_track_outcome.mock_calls:
            assert o.kwargs["outcome"] == Outcome.ACCEPTED

        for o in mock_track_outcome.mock_calls[:2]:
            assert o.kwargs["category"] == DataCategory.ATTACHMENT
            assert o.kwargs["quantity"] == 5

        final = mock_track_outcome.mock_calls[2]
        assert final.kwargs["category"] == DataCategory.ERROR

    def test_attachment_filtered_outcomes(self) -> None:
        manager = EventManager(make_event(message="foo"), project=self.project)
        manager.normalize()

        # Disable storing all crash reports, which will drop the minidump but save the other
        a1 = CachedAttachment(name="a1", data=b"minidump", type="event.minidump")
        a2 = CachedAttachment(name="a2", data=b"limited", rate_limited=True)
        a3 = CachedAttachment(name="a3", data=b"world")

        cache_key = cache_key_for_event(manager.get_data())
        attachment_cache.set(cache_key, attachments=[a1, a2, a3])

        mock_track_outcome = mock.Mock()
        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            with self.feature("organizations:event-attachments"):
                manager.save(self.project.id, cache_key=cache_key, has_attachments=True)

        assert mock_track_outcome.call_count == 3

        # First outcome is the rejection of the minidump
        o = mock_track_outcome.mock_calls[0]
        assert o.kwargs["outcome"] == Outcome.FILTERED
        assert o.kwargs["category"] == DataCategory.ATTACHMENT
        assert o.kwargs["reason"] == FilterStatKeys.CRASH_REPORT_LIMIT

        # Second outcome is acceptance of the "a3" attachment
        o = mock_track_outcome.mock_calls[1]
        assert o.kwargs["outcome"] == Outcome.ACCEPTED
        assert o.kwargs["category"] == DataCategory.ATTACHMENT
        assert o.kwargs["quantity"] == 5

        # Last outcome is the event
        o = mock_track_outcome.mock_calls[2]
        assert o.kwargs["outcome"] == Outcome.ACCEPTED
        assert o.kwargs["category"] == DataCategory.ERROR

    def test_transaction_outcome_accepted(self) -> None:
        """
        Without metrics extraction, we count the number of accepted transaction
        events in the TRANSACTION data category. This maintains compatibility
        with Sentry installations that do not have a metrics pipeline.
        """

        timestamp = before_now(minutes=5).isoformat()
        manager = EventManager(
            make_event(
                transaction="wait",
                contexts={
                    "trace": {
                        "parent_span_id": "bce14471e0e9654d",
                        "op": "foobar",
                        "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                        "span_id": "bf5be759039ede9a",
                    }
                },
                spans=[],
                timestamp=timestamp,
                start_timestamp=timestamp,
                type="transaction",
                platform="python",
            )
        )
        manager.normalize()

        mock_track_outcome = mock.Mock()
        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            with self.feature({"organizations:transaction-metrics-extraction": False}):
                manager.save(self.project.id)

        assert_mock_called_once_with_partial(
            mock_track_outcome, outcome=Outcome.ACCEPTED, category=DataCategory.TRANSACTION
        )

    def test_transaction_indexed_outcome_accepted(self) -> None:
        """
        With metrics extraction, we count the number of accepted transaction
        events in the TRANSACTION_INDEXED data category. The TRANSACTION data
        category contains the number of metrics from
        ``billing_metrics_consumer``.
        """

        timestamp = before_now(minutes=5).isoformat()
        manager = EventManager(
            make_event(
                transaction="wait",
                contexts={
                    "trace": {
                        "parent_span_id": "bce14471e0e9654d",
                        "op": "foobar",
                        "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                        "span_id": "bf5be759039ede9a",
                    }
                },
                spans=[],
                timestamp=timestamp,
                start_timestamp=timestamp,
                type="transaction",
                platform="python",
            )
        )
        manager.normalize()

        mock_track_outcome = mock.Mock()
        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            with self.feature("organizations:transaction-metrics-extraction"):
                manager.save(self.project.id)

        assert_mock_called_once_with_partial(
            mock_track_outcome, outcome=Outcome.ACCEPTED, category=DataCategory.TRANSACTION_INDEXED
        )

    def test_invalid_checksum_gets_hashed(self) -> None:
        checksum = "invalid checksum hash"
        manager = EventManager(make_event(**{"checksum": checksum}))
        manager.normalize()
        event = manager.save(self.project.id)

        hashes = [gh.hash for gh in GroupHash.objects.filter(group=event.group)]
        assert len(hashes) == 1
        assert hashes[0] == hash_from_values(checksum)

    def test_legacy_attributes_moved(self) -> None:
        event_params = make_event(
            release="my-release",
            environment="my-environment",
            site="whatever",
            server_name="foo.com",
            event_id=uuid.uuid1().hex,
        )
        manager = EventManager(event_params)
        event = manager.save(self.project.id)

        # release and environment stay toplevel
        assert event.data["release"] == "my-release"
        assert event.data["environment"] == "my-environment"

        # site is a legacy attribute that is just a tag
        assert event.data.get("site") is None
        tags = dict(event.tags)
        assert tags["site"] == "whatever"
        assert event.data.get("server_name") is None
        tags = dict(event.tags)
        assert tags["server_name"] == "foo.com"

    @freeze_time()
    def test_save_issueless_event(self) -> None:
        timestamp = before_now(minutes=5).isoformat()
        manager = EventManager(
            make_event(
                transaction="wait",
                contexts={
                    "trace": {
                        "parent_span_id": "bce14471e0e9654d",
                        "op": "foobar",
                        "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                        "span_id": "bf5be759039ede9a",
                    }
                },
                spans=[],
                timestamp=timestamp,
                start_timestamp=timestamp,
                type="transaction",
                platform="python",
            )
        )

        event = manager.save(self.project.id)

        assert event.group is None
        assert (
            tsdb.backend.get_sums(
                TSDBModel.project,
                [self.project.id],
                event.datetime,
                event.datetime,
                tenant_ids={"organization_id": 123, "referrer": "r"},
            )[self.project.id]
            == 0
        )

    @pytest.mark.skip(reason="Flaky test")
    def test_category_match_in_app(self) -> None:
        """
        Regression test to ensure that grouping in-app enhancements work in
        principle.
        """
        from sentry.grouping.enhancer import Enhancements

        enhancements_str = Enhancements.from_config_string(
            """
            function:foo category=bar
            function:foo2 category=bar
            category:bar -app
            """
        ).dumps()

        grouping_config = {"id": DEFAULT_GROUPING_CONFIG, "enhancements": enhancements_str}

        with patch(
            "sentry.grouping.ingest.hashing.get_grouping_config_dict_for_project",
            return_value=grouping_config,
        ):
            event_params = make_event(
                platform="native",
                exception={
                    "values": [
                        {
                            "type": "Hello",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "foo",
                                        "in_app": True,
                                    },
                                    {"function": "bar"},
                                ]
                            },
                        }
                    ]
                },
            )

            manager = EventManager(event_params)
            manager.normalize()
            event1 = manager.save(self.project.id)
            assert (
                event1.data["exception"]["values"][0]["stacktrace"]["frames"][0]["in_app"] is False
            )

            event_params = make_event(
                platform="native",
                exception={
                    "values": [
                        {
                            "type": "Hello",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "foo2",
                                        "in_app": True,
                                    },
                                    {"function": "bar"},
                                ]
                            },
                        }
                    ]
                },
            )

            manager = EventManager(event_params)
            manager.normalize()
            event2 = manager.save(self.project.id)
            assert (
                event2.data["exception"]["values"][0]["stacktrace"]["frames"][0]["in_app"] is False
            )
            assert event1.group_id == event2.group_id

    def test_category_match_group(self) -> None:
        """
        Regression test to ensure categories are applied consistently and don't
        produce hash mismatches.
        """
        from sentry.grouping.enhancer import Enhancements

        enhancements_str = Enhancements.from_config_string(
            """
            function:foo category=foo_like
            category:foo_like -group
            """
        ).dumps()

        grouping_config: GroupingConfig = {
            "id": DEFAULT_GROUPING_CONFIG,
            "enhancements": enhancements_str,
        }

        with patch(
            "sentry.grouping.ingest.hashing.get_grouping_config_dict_for_project",
            return_value=grouping_config,
        ):
            event_params = make_event(
                platform="native",
                exception={
                    "values": [
                        {
                            "type": "Hello",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "foo",
                                    },
                                    {
                                        "function": "bar",
                                    },
                                ]
                            },
                        }
                    ]
                },
            )

            manager = EventManager(event_params)
            manager.normalize()

            event1 = manager.save(self.project.id)
            event2 = Event(event1.project_id, event1.event_id, data=event1.data)

            assert event1.get_hashes() == event2.get_hashes(load_grouping_config(grouping_config))

    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_creation(self) -> None:
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            event = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view"))
            )
            data = event.data
            assert event.get_event_type() == "transaction"
            assert event.transaction == "/books/"
            assert data["span_grouping_config"]["id"] == "default:2022-10-27"
            span_hashes = [span["hash"] for span in data["spans"]]
            assert span_hashes == [
                "0f43fb6f6e01ca52",
                "3dc5dd68b38e1730",
                "424c6ae1641f0f0e",
                "d5da18d7274b34a1",
                "ac72fc0a4f5fe381",
                "ac1468d8e11a0553",
                "d8681423cab4275f",
                "e853d2eb7fb9ebb0",
                "6a992d5529f459a4",
                "b640a0ce465fa2a4",
                "a3605e201eaf6c45",
                "061710eb39a66089",
                "c031296784b22ea9",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
                "d74ed7012596c3fb",
            ]
            assert event.group
            group = event.group
            assert group is not None
            assert group.title == "N+1 Query"
            assert (
                group.message
                == "/books/ N+1 Query SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            )
            assert group.culprit == "/books/"
            assert group.get_event_type() == "transaction"
            description = "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            assert group.get_event_metadata() == {
                "location": "/books/",
                "title": "N+1 Query",
                "value": description,
                "initial_priority": PriorityLevel.LOW,
            }
            assert (
                event.search_message
                == "/books/ N+1 Query SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            )
            assert group.location() == "/books/"
            assert group.level == 40
            assert group.issue_category == GroupCategory.PERFORMANCE
            assert group.issue_type == PerformanceNPlusOneGroupType
            assert event.occurrence
            assert event.occurrence.evidence_display == [
                IssueEvidence(
                    name="Offending Spans",
                    value="db - SELECT `books_author`.`id`, `books_author`.`name` "
                    "FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                    important=True,
                )
            ]
            assert event.occurrence.evidence_data == {
                "transaction_name": "/books/",
                "op": "db",
                "parent_span_ids": ["8dd7a5869a4f4583"],
                "parent_span": "django.view - index",
                "cause_span_ids": ["9179e43ae844b174"],
                "offender_span_ids": [
                    "b8be6138369491dd",
                    "b2d4826e7b618f1b",
                    "b3fdeea42536dbf1",
                    "b409e78a092e642f",
                    "86d2ede57bbf48d4",
                    "8e554c84cdc9731e",
                    "94d6230f3f910e12",
                    "a210b87a2191ceb6",
                    "88a5ccaf25b9bd8f",
                    "bb32cf50fc56b296",
                ],
                "repeating_spans": "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                "repeating_spans_compact": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                "num_repeating_spans": "10",
            }

    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_update(self) -> None:
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            event = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view"))
            )
            group = event.group
            assert group is not None
            assert group.issue_category == GroupCategory.PERFORMANCE
            assert group.issue_type == PerformanceNPlusOneGroupType
            group.data["metadata"] = {
                "location": "hi",
                "title": "lol",
            }
            group.culprit = "wat"
            group.message = "nope"
            group.save()
            assert group.location() == "hi"
            assert group.title == "lol"

            with self.tasks():
                self.create_performance_issue(
                    event_data=make_event(**get_event("n-plus-one-in-django-index-view"))
                )

            # Make sure the original group is updated via buffers
            group.refresh_from_db()
            assert group.title == "N+1 Query"

            assert group.get_event_metadata() == {
                "location": "/books/",
                "title": "N+1 Query",
                "value": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                "initial_priority": PriorityLevel.LOW,
            }
            assert group.location() == "/books/"
            assert group.message == "nope"
            assert group.culprit == "/books/"

    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_error_issue_no_associate_perf_event(self) -> None:
        """Test that you can't associate a performance event with an error issue"""
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            event = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view"))
            )
            assert event.group is not None

            # sneakily make the group type wrong
            group = event.group
            assert group is not None
            group.type = ErrorGroupType.type_id
            group.save()
            event = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view"))
            )

            assert event.group is None

    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_no_associate_error_event(self) -> None:
        """Test that you can't associate an error event with a performance issue"""
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            manager = EventManager(make_event())
            manager.normalize()
            event = manager.save(self.project.id)
            assert len(event.groups) == 1

            # sneakily make the group type wrong
            group = event.group
            assert group is not None
            group.type = PerformanceNPlusOneGroupType.type_id
            group.save()
            manager = EventManager(make_event())
            manager.normalize()
            event = manager.save(self.project.id)

            assert not event.group

    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_creation_ignored(self) -> None:
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            event = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view")),
                noise_limit=2,
            )
            assert event.get_event_type() == "transaction"
            assert event.group is None

    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_creation_over_ignored_threshold(self) -> None:
        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"):
            event_1 = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view")), noise_limit=3
            )
            event_2 = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view")), noise_limit=3
            )
            event_3 = self.create_performance_issue(
                event_data=make_event(**get_event("n-plus-one-in-django-index-view")), noise_limit=3
            )
            assert event_1.get_event_type() == "transaction"
            assert event_2.get_event_type() == "transaction"
            assert event_3.get_event_type() == "transaction"
            # only the third occurrence of the hash should create the group
            assert event_1.group is None
            assert event_2.group is None
            assert event_3.group is not None

    @override_options(
        {
            "performance.issues.slow_db_query.problem-creation": 1.0,
            "performance_issue_creation_rate": 1.0,
            "performance.issues.all.problem-detection": 1.0,
        }
    )
    def test_perf_issue_slow_db_issue_is_created(self) -> None:
        def attempt_to_generate_slow_db_issue() -> Event:
            return self.create_performance_issue(
                event_data=make_event(**get_event("slow-db-spans")),
                issue_type=PerformanceSlowDBQueryGroupType,
            )

        last_event = attempt_to_generate_slow_db_issue()
        assert last_event.group
        assert last_event.group.type == PerformanceSlowDBQueryGroupType.type_id

    @patch("sentry.event_manager.metrics.incr")
    def test_new_group_metrics_logging(self, mock_metrics_incr: MagicMock) -> None:
        manager = EventManager(
            make_event(platform="javascript", sdk={"name": "sentry.javascript.nextjs"})
        )
        manager.normalize()
        manager.save(self.project.id)

        mock_metrics_incr.assert_any_call(
            "group.created",
            skip_internal=True,
            tags={
                "platform": "javascript",
                "sdk": "sentry.javascript.nextjs",
            },
        )

    @patch("sentry.event_manager.metrics.incr")
    def test_new_group_metrics_logging_no_platform_no_sdk(
        self, mock_metrics_incr: MagicMock
    ) -> None:
        manager = EventManager(make_event(platform=None, sdk=None))
        manager.normalize()
        manager.save(self.project.id)

        mock_metrics_incr.assert_any_call(
            "group.created",
            skip_internal=True,
            tags={
                "platform": "other",
                "sdk": "other",
            },
        )

    @patch("sentry.event_manager.metrics.incr")
    def test_new_group_metrics_logging_sdk_exist_but_null(
        self, mock_metrics_incr: MagicMock
    ) -> None:
        manager = EventManager(make_event(platform=None, sdk={"name": None}))
        manager.normalize()
        manager.save(self.project.id)

        mock_metrics_incr.assert_any_call(
            "group.created",
            skip_internal=True,
            tags={
                "platform": "other",
                "sdk": "other",
            },
        )

    def test_new_group_metrics_logging_with_frame_mix(self) -> None:
        with patch("sentry.event_manager.metrics.incr") as mock_metrics_incr:
            manager = EventManager(
                make_event(platform="javascript", sdk={"name": "sentry.javascript.nextjs"})
            )
            manager.normalize()
            # IRL, `normalize_stacktraces_for_grouping` adds frame mix metadata to the event, but we
            # can't mock that because it's imported inside its calling function to avoid circular imports
            manager._data["metadata"] = {"in_app_frame_mix": "in-app-only"}
            manager.save(self.project.id)

            mock_metrics_incr.assert_any_call(
                "grouping.in_app_frame_mix",
                sample_rate=1.0,
                tags={
                    "platform": "javascript",
                    "frame_mix": "in-app-only",
                    "sdk": "sentry.javascript.nextjs",
                },
            )

    def test_new_group_metrics_logging_without_frame_mix(self) -> None:
        with patch("sentry.event_manager.metrics.incr") as mock_metrics_incr:
            manager = EventManager(make_event(platform="javascript"))
            event = manager.save(self.project.id)

            assert event.get_event_metadata().get("in_app_frame_mix") is None

            metrics_logged = [call.args[0] for call in mock_metrics_incr.mock_calls]
            assert "grouping.in_app_frame_mix" not in metrics_logged


class ReleaseIssueTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.release = Release.get_or_create(self.project, "1.0")
        self.environment1 = Environment.get_or_create(self.project, "prod")
        self.environment2 = Environment.get_or_create(self.project, "staging")
        self.timestamp = float(int(time() - 300))

    def make_release_event(
        self,
        release_version: str = "1.0",
        environment_name: str | None = "prod",
        project_id: int = 1,
        **kwargs: Any,
    ) -> Event:
        event_params = make_event(
            release=release_version, environment=environment_name, event_id=uuid.uuid1().hex
        )
        event_params.update(kwargs)
        manager = EventManager(event_params)
        with self.tasks():
            event = manager.save(project_id)
        return event

    def convert_timestamp(self, timestamp: float) -> datetime:
        return datetime.fromtimestamp(timestamp, tz=UTC)

    def assert_release_project_environment(
        self, event: Event, new_issues_count: int, first_seen: float, last_seen: float
    ) -> None:
        release = Release.objects.get(
            organization=event.project.organization.id, version=event.get_tag("sentry:release")
        )
        release_project_envs = ReleaseProjectEnvironment.objects.filter(
            release=release, project=event.project, environment=event.get_environment()
        )
        assert len(release_project_envs) == 1

        release_project_env = release_project_envs[0]
        assert release_project_env.new_issues_count == new_issues_count
        assert release_project_env.first_seen == self.convert_timestamp(first_seen)
        assert release_project_env.last_seen == self.convert_timestamp(last_seen)

    def test_different_groups(self) -> None:
        event1 = self.make_release_event(
            release_version=self.release.version,
            environment_name=self.environment1.name,
            project_id=self.project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )
        self.assert_release_project_environment(
            event=event1, new_issues_count=1, last_seen=self.timestamp, first_seen=self.timestamp
        )

        event2 = self.make_release_event(
            release_version=self.release.version,
            environment_name=self.environment1.name,
            project_id=self.project.id,
            checksum="b" * 32,
            timestamp=self.timestamp + 100,
        )
        self.assert_release_project_environment(
            event=event2,
            new_issues_count=2,
            last_seen=self.timestamp + 100,
            first_seen=self.timestamp,
        )

    def test_same_group(self) -> None:
        event1 = self.make_release_event(
            release_version=self.release.version,
            environment_name=self.environment1.name,
            project_id=self.project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )
        self.assert_release_project_environment(
            event=event1, new_issues_count=1, last_seen=self.timestamp, first_seen=self.timestamp
        )
        event2 = self.make_release_event(
            release_version=self.release.version,
            environment_name=self.environment1.name,
            project_id=self.project.id,
            checksum="a" * 32,
            timestamp=self.timestamp + 100,
        )
        self.assert_release_project_environment(
            event=event2,
            new_issues_count=1,
            last_seen=self.timestamp + 100,
            first_seen=self.timestamp,
        )

    def test_same_group_different_environment(self) -> None:
        event1 = self.make_release_event(
            release_version=self.release.version,
            environment_name=self.environment1.name,
            project_id=self.project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )
        self.assert_release_project_environment(
            event=event1, new_issues_count=1, last_seen=self.timestamp, first_seen=self.timestamp
        )
        event2 = self.make_release_event(
            release_version=self.release.version,
            environment_name=self.environment2.name,
            project_id=self.project.id,
            checksum="a" * 32,
            timestamp=self.timestamp + 100,
        )
        self.assert_release_project_environment(
            event=event1, new_issues_count=1, last_seen=self.timestamp, first_seen=self.timestamp
        )
        self.assert_release_project_environment(
            event=event2,
            new_issues_count=1,
            last_seen=self.timestamp + 100,
            first_seen=self.timestamp + 100,
        )


@apply_feature_flag_on_cls("organizations:dynamic-sampling")
class DSLatestReleaseBoostTest(TestCase):
    def setUp(self) -> None:
        self.environment1 = Environment.get_or_create(self.project, "prod")
        self.environment2 = Environment.get_or_create(self.project, "staging")
        self.timestamp = float(int(time() - 300))
        self.redis_client = get_redis_client_for_ds()

    def make_transaction_event(self, **kwargs: Any) -> dict[str, Any]:
        result = {
            "transaction": "wait",
            "contexts": {
                "trace": {
                    "parent_span_id": "bce14471e0e9654d",
                    "op": "foobar",
                    "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                    "span_id": "bf5be759039ede9a",
                }
            },
            "spans": [],
            "timestamp": self.timestamp + 0.23,
            "start_timestamp": "2019-06-14T14:01:40Z",
            "type": "transaction",
        }
        result.update(kwargs)
        return result

    def make_release_transaction(
        self,
        release_version: str = "1.0",
        environment_name: str | None = "prod",
        project_id: int = 1,
        **kwargs: Any,
    ) -> Event:
        transaction = (
            self.make_transaction_event(
                release=release_version, environment=environment_name, event_id=uuid.uuid1().hex
            )
            if environment_name is not None
            else self.make_transaction_event(release=release_version, event_id=uuid.uuid1().hex)
        )
        transaction.update(kwargs)
        manager = EventManager(transaction)
        with self.tasks():
            event = manager.save(project_id)
        return event

    @freeze_time("2022-11-03 10:00:00")
    def test_boost_release_with_non_observed_release(self) -> None:
        ts = timezone.now().timestamp()

        project = self.create_project(platform="python")
        release_1 = Release.get_or_create(project=project, version="1.0", date_added=timezone.now())
        release_2 = Release.get_or_create(
            project=project, version="2.0", date_added=timezone.now() + timedelta(hours=1)
        )
        release_3 = Release.get_or_create(
            project=project, version="3.0", date_added=timezone.now() + timedelta(hours=2)
        )

        for release, environment in (
            (release_1, None),
            (release_2, "prod"),
            (release_3, "dev"),
        ):
            self.make_release_transaction(
                release_version=release.version,
                environment_name=environment,
                project_id=project.id,
                checksum="a" * 32,
                timestamp=self.timestamp,
            )

            env_postfix = f":e:{environment}" if environment is not None else ""
            assert self.redis_client.get(f"ds::p:{project.id}:r:{release.id}{env_postfix}") == "1"

        assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
            f"ds::r:{release_1.id}": str(ts),
            f"ds::r:{release_2.id}:e:prod": str(ts),
            f"ds::r:{release_3.id}:e:dev": str(ts),
        }
        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == [
            ExtendedBoostedRelease(
                id=release_1.id,
                timestamp=ts,
                environment=None,
                cache_key=f"ds::r:{release_1.id}",
                version=release_1.version,
                platform=Platform(project.platform),
            ),
            ExtendedBoostedRelease(
                id=release_2.id,
                timestamp=ts,
                environment="prod",
                cache_key=f"ds::r:{release_2.id}:e:prod",
                version=release_2.version,
                platform=Platform(project.platform),
            ),
            ExtendedBoostedRelease(
                id=release_3.id,
                timestamp=ts,
                environment="dev",
                cache_key=f"ds::r:{release_3.id}:e:dev",
                version=release_3.version,
                platform=Platform(project.platform),
            ),
        ]

    @freeze_time("2022-11-03 10:00:00")
    def test_boost_release_boosts_only_latest_release(self) -> None:
        ts = timezone.now().timestamp()

        project = self.create_project(platform="python")
        release_1 = Release.get_or_create(project=project, version="1.0", date_added=timezone.now())
        release_2 = Release.get_or_create(
            project=project,
            version="2.0",
            # We must make sure the new release_2.date_added > release_1.date_added.
            date_added=timezone.now() + timedelta(hours=1),
        )

        # We add a transaction for latest release release_2.
        self.make_release_transaction(
            release_version=release_2.version,
            environment_name=self.environment1.name,
            project_id=project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )

        # We add a transaction for release_1 which is not anymore the latest release, therefore we should skip this.
        self.make_release_transaction(
            release_version=release_1.version,
            environment_name=self.environment1.name,
            project_id=project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )

        assert (
            self.redis_client.get(f"ds::p:{project.id}:r:{release_2.id}:e:{self.environment1.name}")
            == "1"
        )
        assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
            f"ds::r:{release_2.id}:e:{self.environment1.name}": str(ts),
        }
        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == [
            ExtendedBoostedRelease(
                id=release_2.id,
                timestamp=ts,
                environment=self.environment1.name,
                cache_key=f"ds::r:{release_2.id}:e:{self.environment1.name}",
                version=release_2.version,
                platform=Platform(project.platform),
            )
        ]

    @freeze_time("2022-11-03 10:00:00")
    def test_boost_release_with_observed_release_and_different_environment(self) -> None:
        project = self.create_project(platform="python")
        release = Release.get_or_create(project=project, version="1.0", date_added=timezone.now())

        self.make_release_transaction(
            release_version=release.version,
            environment_name=self.environment1.name,
            project_id=project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )

        ts_1 = time()

        assert (
            self.redis_client.get(f"ds::p:{project.id}:r:{release.id}:e:{self.environment1.name}")
            == "1"
        )
        assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
            f"ds::r:{release.id}:e:{self.environment1.name}": str(ts_1)
        }
        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == [
            ExtendedBoostedRelease(
                id=release.id,
                timestamp=ts_1,
                environment=self.environment1.name,
                cache_key=f"ds::r:{release.id}:e:{self.environment1.name}",
                version=release.version,
                platform=Platform(project.platform),
            )
        ]

        # We simulate that a new transaction with same release but with a different environment value comes after
        # 30 minutes to show that we expect the entry for that release-env to be added to the boosted releases.
        with freeze_time("2022-11-03 10:30:00"):
            self.make_release_transaction(
                release_version=release.version,
                environment_name=self.environment2.name,
                project_id=project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )

            ts_2 = time()

            assert (
                self.redis_client.get(
                    f"ds::p:{project.id}:r:{release.id}:e:{self.environment2.name}"
                )
                == "1"
            )
            assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
                f"ds::r:{release.id}:e:{self.environment1.name}": str(ts_1),
                f"ds::r:{release.id}:e:{self.environment2.name}": str(ts_2),
            }
            assert ProjectBoostedReleases(
                project_id=project.id
            ).get_extended_boosted_releases() == [
                ExtendedBoostedRelease(
                    id=release.id,
                    timestamp=ts_1,
                    environment=self.environment1.name,
                    cache_key=f"ds::r:{release.id}:e:{self.environment1.name}",
                    version=release.version,
                    platform=Platform(project.platform),
                ),
                ExtendedBoostedRelease(
                    id=release.id,
                    timestamp=ts_2,
                    environment=self.environment2.name,
                    cache_key=f"ds::r:{release.id}:e:{self.environment2.name}",
                    version=release.version,
                    platform=Platform(project.platform),
                ),
            ]

        # We also test the case in which no environment is set, which can be the case as per
        # https://docs.sentry.io/platforms/javascript/configuration/options/#environment.
        with freeze_time("2022-11-03 11:00:00"):
            self.make_release_transaction(
                release_version=release.version,
                environment_name=None,
                project_id=project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )

            ts_3 = time()

            assert self.redis_client.get(f"ds::p:{project.id}:r:{release.id}") == "1"
            assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
                f"ds::r:{release.id}:e:{self.environment1.name}": str(ts_1),
                f"ds::r:{release.id}:e:{self.environment2.name}": str(ts_2),
                f"ds::r:{release.id}": str(ts_3),
            }
            assert ProjectBoostedReleases(
                project_id=project.id
            ).get_extended_boosted_releases() == [
                ExtendedBoostedRelease(
                    id=release.id,
                    timestamp=ts_1,
                    environment=self.environment1.name,
                    cache_key=f"ds::r:{release.id}:e:{self.environment1.name}",
                    version=release.version,
                    platform=Platform(project.platform),
                ),
                ExtendedBoostedRelease(
                    id=release.id,
                    timestamp=ts_2,
                    environment=self.environment2.name,
                    cache_key=f"ds::r:{release.id}:e:{self.environment2.name}",
                    version=release.version,
                    platform=Platform(project.platform),
                ),
                ExtendedBoostedRelease(
                    id=release.id,
                    timestamp=ts_3,
                    environment=None,
                    cache_key=f"ds::r:{release.id}",
                    version=release.version,
                    platform=Platform(project.platform),
                ),
            ]

    @freeze_time("2022-11-03 10:00:00")
    def test_release_not_boosted_with_observed_release_and_same_environment(self) -> None:
        project = self.create_project(platform="python")
        release = Release.get_or_create(project=project, version="1.0", date_added=timezone.now())

        for environment in (self.environment1.name, self.environment2.name):
            self.redis_client.set(
                f"ds::p:{project.id}:r:{release.id}:e:{environment}", 1, 60 * 60 * 24
            )
            self.make_release_transaction(
                release_version=release.version,
                environment_name=environment,
                project_id=project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )

        assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {}
        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == []

    @freeze_time("2022-11-03 10:00:00")
    def test_release_not_boosted_with_deleted_release_after_event_received(self) -> None:
        ts = timezone.now().timestamp()

        project = self.create_project(platform="python")
        release_1 = Release.get_or_create(project=project, version="1.0", date_added=timezone.now())
        release_2 = Release.get_or_create(
            project=project, version="2.0", date_added=timezone.now() + timedelta(hours=1)
        )

        self.make_release_transaction(
            release_version=release_1.version,
            environment_name=None,
            project_id=project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )
        assert self.redis_client.get(f"ds::p:{project.id}:r:{release_1.id}") == "1"

        self.make_release_transaction(
            release_version=release_2.version,
            environment_name=None,
            project_id=project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )
        assert self.redis_client.get(f"ds::p:{project.id}:r:{release_2.id}") == "1"

        # We simulate that the release_2 is deleted after the boost has been inserted.
        release_2_id = release_2.id
        release_2.delete()

        # We expect the boosted release to be kept in Redis, if not queried by the ProjectBoostedReleases.
        assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
            f"ds::r:{release_1.id}": str(ts),
            f"ds::r:{release_2_id}": str(ts),
        }
        # We expect to not see the release 2 because it will not be in the database anymore, thus we mark it as
        # expired.
        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == [
            ExtendedBoostedRelease(
                id=release_1.id,
                timestamp=ts,
                environment=None,
                cache_key=f"ds::r:{release_1.id}",
                version=release_1.version,
                platform=Platform(project.platform),
            ),
        ]

    @freeze_time("2022-11-03 10:00:00")
    def test_get_boosted_releases_with_old_and_new_cache_keys(self) -> None:
        ts = timezone.now().timestamp()

        project = self.create_project(platform="python")

        # Old cache key
        release_1 = Release.get_or_create(project=project, version="1.0", date_added=timezone.now())
        self.redis_client.hset(
            f"ds::p:{project.id}:boosted_releases",
            f"{release_1.id}",
            ts,
        )

        # New cache key
        release_2 = Release.get_or_create(
            project=project, version="2.0", date_added=timezone.now() + timedelta(hours=1)
        )
        self.redis_client.hset(
            f"ds::p:{project.id}:boosted_releases",
            f"ds::r:{release_2.id}",
            ts,
        )
        self.redis_client.hset(
            f"ds::p:{project.id}:boosted_releases",
            f"ds::r:{release_2.id}:e:{self.environment1.name}",
            ts,
        )
        self.redis_client.hset(
            f"ds::p:{project.id}:boosted_releases",
            f"ds::r:{release_2.id}:e:{self.environment2.name}",
            ts,
        )

        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == [
            ExtendedBoostedRelease(
                id=release_1.id,
                timestamp=ts,
                environment=None,
                # This item has the old cache key.
                cache_key=f"{release_1.id}",
                version=release_1.version,
                platform=Platform(project.platform),
            ),
            ExtendedBoostedRelease(
                id=release_2.id,
                timestamp=ts,
                environment=None,
                cache_key=f"ds::r:{release_2.id}",
                version=release_2.version,
                platform=Platform(project.platform),
            ),
            ExtendedBoostedRelease(
                id=release_2.id,
                timestamp=ts,
                environment=self.environment1.name,
                cache_key=f"ds::r:{release_2.id}:e:{self.environment1.name}",
                version=release_2.version,
                platform=Platform(project.platform),
            ),
            ExtendedBoostedRelease(
                id=release_2.id,
                timestamp=ts,
                environment=self.environment2.name,
                cache_key=f"ds::r:{release_2.id}:e:{self.environment2.name}",
                version=release_2.version,
                platform=Platform(project.platform),
            ),
        ]

    @freeze_time("2022-11-03 10:00:00")
    def test_expired_boosted_releases_are_removed(self) -> None:
        ts = timezone.now().timestamp()

        # We want to test with multiple platforms.
        for platform in ("python", "java", None):
            project = self.create_project(platform=platform)

            for index, (release_version, environment) in enumerate(
                (
                    (f"1.0-{platform}", self.environment1.name),
                    (f"2.0-{platform}", self.environment2.name),
                )
            ):
                release = Release.get_or_create(
                    project=project,
                    version=release_version,
                    date_added=timezone.now() + timedelta(hours=index),
                )
                self.redis_client.set(
                    f"ds::p:{project.id}:r:{release.id}:e:{environment}", 1, 60 * 60 * 24
                )
                self.redis_client.hset(
                    f"ds::p:{project.id}:boosted_releases",
                    f"ds::r:{release.id}:e:{environment}",
                    # We set the creation time in order to expire it by 1 second.
                    ts - Platform(platform).time_to_adoption - 1,
                )

            # We add a new boosted release that is not expired.
            release_3 = Release.get_or_create(
                project=project,
                version=f"3.0-{platform}",
                date_added=timezone.now() + timedelta(hours=2),
            )
            self.make_release_transaction(
                release_version=release_3.version,
                environment_name=self.environment1.name,
                project_id=project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )

            assert (
                self.redis_client.get(
                    f"ds::p:{project.id}:r:{release_3.id}:e:{self.environment1.name}"
                )
                == "1"
            )
            assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
                f"ds::r:{release_3.id}:e:{self.environment1.name}": str(ts)
            }
            assert ProjectBoostedReleases(
                project_id=project.id
            ).get_extended_boosted_releases() == [
                ExtendedBoostedRelease(
                    id=release_3.id,
                    timestamp=ts,
                    environment=self.environment1.name,
                    cache_key=f"ds::r:{release_3.id}:e:{self.environment1.name}",
                    version=release_3.version,
                    platform=Platform(project.platform),
                )
            ]

    @mock.patch("sentry.event_manager.schedule_invalidate_project_config")
    def test_project_config_invalidation_is_triggered_when_new_release_is_observed(
        self, mocked_invalidate: mock.MagicMock
    ) -> None:
        self.make_release_transaction(
            release_version=self.release.version,
            environment_name=self.environment1.name,
            project_id=self.project.id,
            checksum="a" * 32,
            timestamp=self.timestamp,
        )
        assert any(
            o.kwargs["trigger"] == "dynamic_sampling:boost_release"
            for o in mocked_invalidate.mock_calls
        )

    @freeze_time("2022-11-03 10:00:00")
    @mock.patch("sentry.dynamic_sampling.rules.helpers.latest_releases.BOOSTED_RELEASES_LIMIT", 2)
    def test_least_recently_boosted_release_is_removed_if_limit_is_exceeded(self) -> None:
        ts = timezone.now().timestamp()

        project = self.create_project(platform="python")
        release_1 = Release.get_or_create(
            project=project,
            version="1.0",
            date_added=timezone.now(),
        )
        release_2 = Release.get_or_create(
            project=project,
            version="2.0",
            date_added=timezone.now() + timedelta(hours=1),
        )

        # We boost with increasing timestamps, so that we know that the smallest will be evicted.
        for release, boost_time in ((release_1, ts - 2), (release_2, ts - 1)):
            self.redis_client.set(
                f"ds::p:{project.id}:r:{release.id}",
                1,
                60 * 60 * 24,
            )
            self.redis_client.hset(
                f"ds::p:{project.id}:boosted_releases",
                f"ds::r:{release.id}",
                boost_time,
            )

        release_3 = Release.get_or_create(
            project=project,
            version="3.0",
            date_added=timezone.now() + timedelta(hours=2),
        )
        self.make_release_transaction(
            release_version=release_3.version,
            environment_name=self.environment1.name,
            project_id=project.id,
            checksum="b" * 32,
            timestamp=self.timestamp,
        )

        assert (
            self.redis_client.get(f"ds::p:{project.id}:r:{release_3.id}:e:{self.environment1.name}")
            == "1"
        )
        assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
            f"ds::r:{release_2.id}": str(ts - 1),
            f"ds::r:{release_3.id}:e:{self.environment1.name}": str(ts),
        }
        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == [
            ExtendedBoostedRelease(
                id=release_2.id,
                timestamp=ts - 1,
                environment=None,
                cache_key=f"ds::r:{release_2.id}",
                version=release_2.version,
                platform=Platform(project.platform),
            ),
            ExtendedBoostedRelease(
                id=release_3.id,
                timestamp=ts,
                environment=self.environment1.name,
                cache_key=f"ds::r:{release_3.id}:e:{self.environment1.name}",
                version=release_3.version,
                platform=Platform(project.platform),
            ),
        ]

    @freeze_time()
    @mock.patch("sentry.dynamic_sampling.rules.helpers.latest_releases.BOOSTED_RELEASES_LIMIT", 2)
    def test_removed_boost_not_added_again_if_limit_is_exceeded(self) -> None:
        ts = timezone.now().timestamp()

        project = self.create_project(platform="python")
        release_1 = Release.get_or_create(project=project, version="1.0", date_added=timezone.now())

        # We want to test that if we have the same release, but we send different environments that go over the
        # limit, and we evict an environment, but then we send a transaction with the evicted environment.
        #
        # As an example suppose the following history of transactions received in the form (release, env) -> None:
        # (1, production) -> (1, staging) -> (1, None) -> (1, production)
        #
        # Once we receive the first two, we have reached maximum capacity. Then we receive (1, None) and evict boost
        # for (1, production) which results in the following boosts (1, staging), (1, None). After that we receive
        # (1, production) again but in this case we don't want to remove (1, staging) because we will end up in an
        # infinite loop. Instead, we expect to mark (1, production) as observed and only un-observe it if it does
        # not receive transactions within the next 24 hours.
        environments_sequence = [
            self.environment1.name,
            self.environment2.name,
            None,
            self.environment1.name,
        ]
        for environment in environments_sequence:
            self.make_release_transaction(
                release_version=release_1.version,
                environment_name=environment,
                project_id=project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )

        # We assert that all environments have been observed.
        assert (
            self.redis_client.get(f"ds::p:{project.id}:r:{release_1.id}:e:{self.environment1.name}")
            == "1"
        )
        assert (
            self.redis_client.get(f"ds::p:{project.id}:r:{release_1.id}:e:{self.environment2.name}")
            == "1"
        )
        assert self.redis_client.get(f"ds::p:{project.id}:r:{release_1.id}") == "1"

        # We assert that only the last 2 unseen (release, env) pairs are boosted.
        assert self.redis_client.hgetall(f"ds::p:{project.id}:boosted_releases") == {
            f"ds::r:{release_1.id}:e:{self.environment2.name}": str(ts),
            f"ds::r:{release_1.id}": str(ts),
        }
        assert ProjectBoostedReleases(project_id=project.id).get_extended_boosted_releases() == [
            ExtendedBoostedRelease(
                id=release_1.id,
                timestamp=ts,
                environment=self.environment2.name,
                cache_key=f"ds::r:{release_1.id}:e:{self.environment2.name}",
                version=release_1.version,
                platform=Platform(project.platform),
            ),
            ExtendedBoostedRelease(
                id=release_1.id,
                timestamp=ts,
                environment=None,
                cache_key=f"ds::r:{release_1.id}",
                version=release_1.version,
                platform=Platform(project.platform),
            ),
        ]


class TestSaveGroupHashAndGroup(TransactionTestCase):
    def test(self) -> None:
        perf_data = load_data("transaction-n-plus-one", timestamp=before_now(minutes=10))
        event = _get_event_instance(perf_data, project_id=self.project.id)
        group_hash = "some_group"
        group, created = save_grouphash_and_group(self.project, event, group_hash)
        assert created
        group_2, created = save_grouphash_and_group(self.project, event, group_hash)
        assert group.id == group_2.id
        assert not created
        assert Group.objects.filter(grouphash__hash=group_hash).count() == 1
        group_3, created = save_grouphash_and_group(self.project, event, "new_hash")
        assert created
        assert group_2.id != group_3.id
        assert Group.objects.filter(grouphash__hash=group_hash).count() == 1


example_transaction_event = {
    "type": "transaction",
    "timestamp": datetime.now().isoformat(),
    "start_timestamp": (datetime.now() - timedelta(seconds=1)).isoformat(),
    "spans": [],
    "contexts": {
        "trace": {
            "parent_span_id": "8988cec7cc0779c1",
            "type": "trace",
            "op": "foobar",
            "trace_id": "a7d67cf796774551a95be6543cacd459",
            "span_id": "babaae0d4b7512d9",
            "status": "ok",
        }
    },
}


example_error_event = {
    "event_id": "80e3496eff734ab0ac993167aaa0d1cd",
    "release": "5.222.5",
    "type": "error",
    "level": "fatal",
    "platform": "cocoa",
    "tags": {"level": "fatal"},
    "environment": "test-app",
    "sdk": {
        "name": "sentry.cocoa",
        "version": "8.2.0",
        "integrations": [
            "Crash",
            "PerformanceTracking",
            "MetricKit",
            "WatchdogTerminationTracking",
            "ViewHierarchy",
            "NetworkTracking",
            "ANRTracking",
            "AutoBreadcrumbTracking",
            "FramesTracking",
            "AppStartTracking",
            "Screenshot",
            "FileIOTracking",
            "UIEventTracking",
            "AutoSessionTracking",
            "CoreDataTracking",
            "PreWarmedAppStartTracing",
        ],
    },
    "user": {
        "id": "803F5C87-0F8B-41C7-8499-27BD71A92738",
        "ip_address": "192.168.0.1",
        "geo": {"country_code": "US", "region": "United States"},
    },
    "logger": "my.logger.name",
}


@pytest.mark.parametrize(
    "event_data,expected_type",
    [
        pytest.param(
            example_transaction_event,
            "transactions",
            id="transactions",
        ),
        pytest.param(
            example_error_event,
            "errors",
            id="errors",
        ),
    ],
)
@django_db_all
def test_cogs_event_manager(
    default_project: int, event_data: Mapping[str, Any], expected_type: str
) -> None:
    storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker = LocalBroker(storage)
    topic = Topic("shared-resources-usage")
    broker.create_topic(topic, 1)
    producer = broker.get_producer()

    set("shared_resources_accounting_enabled", [settings.COGS_EVENT_STORE_LABEL])

    accountant.init_backend(producer)

    raw_event_params = make_event(**event_data)

    manager = EventManager(raw_event_params)
    manager.normalize()
    normalized_data = dict(manager.get_data())
    _ = manager.save(default_project)

    expected_len = len(json.dumps(normalized_data))

    accountant._shutdown()
    accountant.reset_backend()
    msg1 = broker.consume(Partition(topic, 0), 0)
    assert msg1 is not None
    payload = msg1.payload
    assert payload is not None
    formatted = json.loads(payload.value.decode("utf-8"))
    assert formatted["shared_resource_id"] == settings.COGS_EVENT_STORE_LABEL
    assert formatted["app_feature"] == expected_type
    assert formatted["usage_unit"] == "bytes"
    # We cannot assert for exact length because manager save method adds some extra fields. So we
    # assert that the length is at least greater than the expected length.
    assert formatted["amount"] >= expected_len
