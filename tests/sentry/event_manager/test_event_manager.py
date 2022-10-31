import logging
import uuid
from datetime import datetime, timedelta
from time import time
from unittest import mock

import pytest
import responses
from django.core.cache import cache
from django.test.utils import override_settings
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.status import HTTP_404_NOT_FOUND

from fixtures.github import (
    COMPARE_COMMITS_EXAMPLE_WITH_INTERMEDIATE,
    EARLIER_COMMIT_SHA,
    GET_COMMIT_EXAMPLE,
    GET_LAST_2_COMMITS_EXAMPLE,
    GET_PRIOR_COMMIT_EXAMPLE,
    LATER_COMMIT_SHA,
)
from sentry import audit_log, nodestore, tsdb
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.constants import MAX_VERSION_LENGTH, DataCategory
from sentry.dynamic_sampling.latest_release_booster import (
    BOOSTED_RELEASE_TIMEOUT,
    get_boosted_releases,
    get_redis_client_for_ds,
)
from sentry.event_manager import (
    EventManager,
    EventUser,
    HashDiscarded,
    _get_event_instance,
    _save_grouphash_and_group,
    has_pending_commit_resolution,
)
from sentry.eventstore.models import Event
from sentry.grouping.utils import hash_from_values
from sentry.ingest.inbound_filters import FilterStatKeys
from sentry.models import (
    Activity,
    Commit,
    CommitAuthor,
    Environment,
    ExternalIssue,
    Group,
    GroupEnvironment,
    GroupHash,
    GroupLink,
    GroupRelease,
    GroupResolution,
    GroupStatus,
    GroupTombstone,
    Integration,
    OrganizationIntegration,
    Project,
    PullRequest,
    PullRequestCommit,
    Release,
    ReleaseCommit,
    ReleaseHeadCommit,
    ReleaseProjectEnvironment,
    UserReport,
)
from sentry.models.auditlogentry import AuditLogEntry
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG
from sentry.spans.grouping.utils import hash_values
from sentry.testutils import (
    SnubaTestCase,
    TestCase,
    TransactionTestCase,
    assert_mock_called_once_with_partial,
)
from sentry.testutils.helpers import apply_feature_flag_on_cls, override_options
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.issues import GroupCategory, GroupType
from sentry.utils import json
from sentry.utils.cache import cache_key_for_event
from sentry.utils.outcomes import Outcome
from sentry.utils.performance_issues.performance_detection import (
    EventPerformanceProblem,
    PerformanceProblem,
)
from sentry.utils.samples import load_data
from tests.sentry.integrations.github.test_repository import stub_installation_token
from tests.sentry.utils.performance_issues.test_performance_detection import EVENTS


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


class EventManagerTestMixin:
    def make_release_event(self, release_name, project_id):
        manager = EventManager(make_event(release=release_name))
        manager.normalize()
        event = manager.save(project_id)
        return event


@region_silo_test
class EventManagerTest(TestCase, SnubaTestCase, EventManagerTestMixin):
    def test_similar_message_prefix_doesnt_group(self):
        # we had a regression which caused the default hash to just be
        # 'event.message' instead of '[event.message]' which caused it to
        # generate a hash per letter
        manager = EventManager(make_event(event_id="a", message="foo bar"))
        manager.normalize()
        event1 = manager.save(self.project.id)

        manager = EventManager(make_event(event_id="b", message="foo baz"))
        manager.normalize()
        event2 = manager.save(self.project.id)

        assert event1.group_id != event2.group_id

    def test_ephemeral_interfaces_removed_on_save(self):
        manager = EventManager(make_event(platform="python"))
        manager.normalize()
        event = manager.save(self.project.id)

        group = event.group
        assert group.platform == "python"
        assert event.platform == "python"

    @mock.patch("sentry.event_manager.eventstream.insert")
    def test_dupe_message_id(self, eventstream_insert):
        # Saves the latest event to nodestore and eventstream
        project_id = 1
        event_id = "a" * 32
        node_id = Event.generate_node_id(project_id, event_id)

        manager = EventManager(make_event(event_id=event_id, message="first"))
        manager.normalize()
        manager.save(project_id)
        assert nodestore.get(node_id)["logentry"]["formatted"] == "first"

        manager = EventManager(make_event(event_id=event_id, message="second"))
        manager.normalize()
        manager.save(project_id)
        assert nodestore.get(node_id)["logentry"]["formatted"] == "second"

        assert eventstream_insert.call_count == 2

    def test_updates_group(self):
        timestamp = time() - 300
        manager = EventManager(
            make_event(message="foo", event_id="a" * 32, checksum="a" * 32, timestamp=timestamp)
        )
        manager.normalize()
        event = manager.save(self.project.id)

        manager = EventManager(
            make_event(
                message="foo bar", event_id="b" * 32, checksum="a" * 32, timestamp=timestamp + 2.0
            )
        )
        manager.normalize()

        with self.tasks():
            event2 = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message
        assert group.data.get("type") == "default"
        assert group.data.get("metadata") == {"title": "foo bar"}

    def test_applies_secondary_grouping(self):
        project = self.project
        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", 0)

        timestamp = time() - 300
        manager = EventManager(
            make_event(message="foo 123", event_id="a" * 32, timestamp=timestamp)
        )
        manager.normalize()
        event = manager.save(project.id)

        project.update_option("sentry:grouping_config", "newstyle:2019-10-29")
        project.update_option("sentry:secondary_grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", time() + (24 * 90 * 3600))

        # Switching to newstyle grouping changes hashes as 123 will be removed
        manager = EventManager(
            make_event(message="foo 123", event_id="b" * 32, timestamp=timestamp + 2.0)
        )
        manager.normalize()

        with self.tasks():
            event2 = manager.save(project.id)

        # make sure that events did get into same group because of fallback grouping, not because of hashes which come from primary grouping only
        assert not set(event.get_hashes().hashes) & set(event2.get_hashes().hashes)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message
        assert group.data.get("type") == "default"
        assert group.data.get("metadata") == {"title": "foo 123"}

        # After expiry, new events are still assigned to the same group:
        project.update_option("sentry:secondary_grouping_expiry", 0)
        manager = EventManager(
            make_event(message="foo 123", event_id="c" * 32, timestamp=timestamp + 4.0)
        )
        manager.normalize()

        with self.tasks():
            event3 = manager.save(project.id)
        assert event3.group_id == event2.group_id

    def test_applies_secondary_grouping_hierarchical(self):
        project = self.project
        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", 0)

        timestamp = time() - 300

        def save_event(ts_offset):
            ts = timestamp + ts_offset
            manager = EventManager(
                make_event(
                    message="foo 123",
                    event_id=hex(2**127 + int(ts))[-32:],
                    timestamp=ts,
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
            with self.tasks():
                return manager.save(project.id)

        event = save_event(0)

        project.update_option("sentry:grouping_config", "mobile:2021-02-12")
        project.update_option("sentry:secondary_grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", time() + (24 * 90 * 3600))

        # Switching to newstyle grouping changes hashes as 123 will be removed
        event2 = save_event(2)

        # make sure that events did get into same group because of fallback grouping, not because of hashes which come from primary grouping only
        assert not set(event.get_hashes().hashes) & set(event2.get_hashes().hashes)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime

        # After expiry, new events are still assigned to the same group:
        project.update_option("sentry:secondary_grouping_expiry", 0)
        event3 = save_event(4)
        assert event3.group_id == event2.group_id

    @mock.patch("sentry.event_manager._calculate_background_grouping")
    def test_applies_background_grouping(self, mock_calc_grouping):
        timestamp = time() - 300
        manager = EventManager(
            make_event(message="foo 123", event_id="a" * 32, timestamp=timestamp)
        )
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 1.0,
            }
        ):
            manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 1

    @mock.patch("sentry.event_manager._calculate_background_grouping")
    def test_background_grouping_sample_rate(self, mock_calc_grouping):

        timestamp = time() - 300
        manager = EventManager(
            make_event(message="foo 123", event_id="a" * 32, timestamp=timestamp)
        )
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 0.0,
            }
        ):
            manager.save(self.project.id)

        manager.save(self.project.id)

        assert mock_calc_grouping.call_count == 0

    def test_updates_group_with_fingerprint(self):
        ts = time() - 200
        manager = EventManager(
            make_event(message="foo", event_id="a" * 32, fingerprint=["a" * 32], timestamp=ts)
        )
        with self.tasks():
            event = manager.save(self.project.id)

        manager = EventManager(
            make_event(message="foo bar", event_id="b" * 32, fingerprint=["a" * 32], timestamp=ts)
        )
        with self.tasks():
            event2 = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event.datetime
        assert group.message == event2.message

    def test_differentiates_with_fingerprint(self):
        manager = EventManager(
            make_event(message="foo", event_id="a" * 32, fingerprint=["{{ default }}", "a" * 32])
        )
        with self.tasks():
            manager.normalize()
            event = manager.save(self.project.id)

        manager = EventManager(
            make_event(message="foo bar", event_id="b" * 32, fingerprint=["a" * 32])
        )
        with self.tasks():
            manager.normalize()
            event2 = manager.save(self.project.id)

        assert event.group_id != event2.group_id

    @mock.patch("sentry.signals.issue_unresolved.send_robust")
    def test_unresolves_group(self, send_robust):
        ts = time() - 300

        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1.
        manager = EventManager(make_event(event_id="a" * 32, checksum="a" * 32, timestamp=ts))
        with self.tasks():
            event = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 50))
        event2 = manager.save(self.project.id)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert not group.is_resolved()
        assert send_robust.called

    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_does_not_unresolve_group(self, plugin_is_regression):
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
        self, plugin_is_regression, mock_send_activity_notifications_delay
    ):
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

        group = event.group

        group.update(status=GroupStatus.RESOLVED)

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
        self, plugin_is_regression, mock_send_activity_notifications_delay
    ):
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
        group = event.group
        group.update(status=GroupStatus.RESOLVED)

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

        mock_send_activity_notifications_delay.assert_called_once_with(regressed_activity.id)

    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_current_release_version_in_latest_activity_prior_to_regression_is_not_overridden(
        self, plugin_is_regression, mock_send_activity_notifications_delay
    ):
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
        group = event.group
        group.update(status=GroupStatus.RESOLVED)

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

    def test_has_pending_commit_resolution(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)

        group = event.group
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

    def test_multiple_pending_commit_resolution(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)
        group = event.group

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

    def test_has_pending_commit_resolution_issue_regression(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)
        group = event.group
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

    def test_has_pending_commit_resolution_issue_regression_released_commits(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)
        group = event.group
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
        plugin_is_regression,
        mock_send_activity_notifications_delay,
        mock_sync_status_outbound,
    ):
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

        group = event.group

        org = group.organization

        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)
        OrganizationIntegration.objects.filter(
            integration_id=integration.id, organization_id=group.organization.id
        ).update(
            config={
                "sync_comments": True,
                "sync_status_outbound": True,
                "sync_status_inbound": True,
                "sync_assignee_outbound": True,
                "sync_assignee_inbound": True,
            }
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

        group.update(status=GroupStatus.RESOLVED)

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
        self, plugin_is_regression, mock_send_activity_notifications_delay
    ):
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

        group.update(status=GroupStatus.RESOLVED)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_id=commit.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=time()))
        event = manager.save(self.project.id)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

    @mock.patch("sentry.tasks.activity.send_activity_notifications.delay")
    @mock.patch("sentry.event_manager.plugin_is_regression")
    def test_mark_as_unresolved_with_released_commit(
        self, plugin_is_regression, mock_send_activity_notifications_delay
    ):
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

        group.update(status=GroupStatus.RESOLVED)

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_id=commit.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=time()))

        event = manager.save(self.project.id)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

    @mock.patch("sentry.models.Group.is_resolved")
    def test_unresolves_group_with_auto_resolve(self, mock_is_resolved):
        ts = time() - 100
        mock_is_resolved.return_value = False
        manager = EventManager(make_event(event_id="a" * 32, checksum="a" * 32, timestamp=ts))
        with self.tasks():
            event = manager.save(self.project.id)

        mock_is_resolved.return_value = True
        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 100))
        with self.tasks():
            event2 = manager.save(self.project.id)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group.id)
        assert group.active_at.replace(second=0) == event2.datetime.replace(second=0)
        assert group.active_at.replace(second=0) != event.datetime.replace(second=0)

    def test_invalid_transaction(self):
        dict_input = {"messages": "foo"}
        manager = EventManager(make_event(transaction=dict_input))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.transaction is None

    def test_transaction_as_culprit(self):
        manager = EventManager(make_event(transaction="foobar"))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.transaction == "foobar"
        assert event.culprit == "foobar"

    def test_culprit_is_not_transaction(self):
        manager = EventManager(make_event(culprit="foobar"))
        manager.normalize()
        event1 = manager.save(self.project.id)
        assert event1.transaction is None
        assert event1.culprit == "foobar"

    def test_culprit_after_stacktrace_processing(self):
        from sentry.grouping.enhancer import Enhancements

        enhancement = Enhancements.from_config_string(
            """
            function:in_app_function +app
            function:not_in_app_function -app
            """,
        )

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
        manager.get_data()["grouping_config"] = {
            "enhancements": enhancement.dumps(),
            "id": "legacy:2019-03-12",
        }
        event1 = manager.save(self.project.id)
        assert event1.transaction is None
        assert event1.culprit == "in_app_function"

    def test_inferred_culprit_from_empty_stacktrace(self):
        manager = EventManager(make_event(stacktrace={"frames": []}))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.culprit == ""

    def test_transaction_and_culprit(self):
        manager = EventManager(make_event(transaction="foobar", culprit="baz"))
        manager.normalize()
        event1 = manager.save(self.project.id)
        assert event1.transaction == "foobar"
        assert event1.culprit == "baz"

    def test_release_with_empty_version(self):
        cases = ["", " ", "\t", "\n"]
        for case in cases:
            event = self.make_release_event(case, self.project.id)
            assert not event.group.first_release
            assert Release.objects.filter(projects__in=[self.project.id]).count() == 0
            assert Release.objects.filter(organization_id=self.project.organization_id).count() == 0

    def test_first_release(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)

        group = event.group
        assert group.first_release.version == "1.0"

        event = self.make_release_event("2.0", project_id)

        group = event.group
        assert group.first_release.version == "1.0"

    def test_release_project_slug(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(version="foo-1.0", organization=project.organization)
        release.add_project(project)

        event = self.make_release_event("1.0", project.id)

        group = event.group
        assert group.first_release.version == "foo-1.0"
        release_tag = [v for k, v in event.tags if k == "sentry:release"][0]
        assert release_tag == "foo-1.0"

        event = self.make_release_event("2.0", project.id)

        group = event.group
        assert group.first_release.version == "foo-1.0"

    def test_release_project_slug_long(self):
        project = self.create_project(name="foo")
        partial_version_len = MAX_VERSION_LENGTH - 4
        release = Release.objects.create(
            version="foo-{}".format("a" * partial_version_len), organization=project.organization
        )
        release.add_project(project)

        event = self.make_release_event("a" * partial_version_len, project.id)

        group = event.group
        assert group.first_release.version == "foo-{}".format("a" * partial_version_len)
        release_tag = [v for k, v in event.tags if k == "sentry:release"][0]
        assert release_tag == "foo-{}".format("a" * partial_version_len)

    def test_group_release_no_env(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)

        release = Release.objects.get(version="1.0", projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id, group_id=event.group_id, environment=""
        ).exists()

        # ensure we're not erroring on second creation
        event = self.make_release_event("1.0", project_id)

    def test_group_release_with_env(self):
        manager = EventManager(make_event(release="1.0", environment="prod", event_id="a" * 32))
        manager.normalize()
        event = manager.save(self.project.id)

        release = Release.objects.get(version="1.0", projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id, group_id=event.group_id, environment="prod"
        ).exists()

        manager = EventManager(make_event(release="1.0", environment="staging", event_id="b" * 32))
        event = manager.save(self.project.id)

        release = Release.objects.get(version="1.0", projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id, group_id=event.group_id, environment="staging"
        ).exists()

    def test_tsdb(self):
        project = self.project
        manager = EventManager(
            make_event(
                fingerprint=["totally unique super duper fingerprint"],
                environment="totally unique super duper environment",
            )
        )
        event = manager.save(project.id)

        def query(model, key, **kwargs):
            return tsdb.get_sums(model, [key], event.datetime, event.datetime, **kwargs)[key]

        assert query(tsdb.models.project, project.id) == 1
        assert query(tsdb.models.group, event.group.id) == 1

        environment_id = Environment.get_for_organization_id(
            event.project.organization_id, "totally unique super duper environment"
        ).id
        assert query(tsdb.models.project, project.id, environment_id=environment_id) == 1
        assert query(tsdb.models.group, event.group.id, environment_id=environment_id) == 1

    @pytest.mark.xfail
    def test_record_frequencies(self):
        project = self.project
        manager = EventManager(make_event())
        event = manager.save(project.id)

        assert tsdb.get_most_frequent(
            tsdb.models.frequent_issues_by_project, (event.project.id,), event.datetime
        ) == {event.project.id: [(event.group_id, 1.0)]}

    def test_event_user(self):
        manager = EventManager(
            make_event(
                event_id="a", environment="totally unique environment", **{"user": {"id": "1"}}
            )
        )
        manager.normalize()
        with self.tasks():
            event = manager.save(self.project.id)

        environment_id = Environment.get_for_organization_id(
            event.project.organization_id, "totally unique environment"
        ).id

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group, (event.group.id,), event.datetime, event.datetime
        ) == {event.group.id: 1}

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_project,
            (event.project.id,),
            event.datetime,
            event.datetime,
        ) == {event.project.id: 1}

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group,
            (event.group.id,),
            event.datetime,
            event.datetime,
            environment_id=environment_id,
        ) == {event.group.id: 1}

        assert tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_project,
            (event.project.id,),
            event.datetime,
            event.datetime,
            environment_id=environment_id,
        ) == {event.project.id: 1}

        euser = EventUser.objects.get(project_id=self.project.id, ident="1")
        assert event.get_tag("sentry:user") == euser.tag_value

        # clear the cache otherwise the cached EventUser from prev
        # manager.save() will be used instead of jane
        cache.clear()

        # ensure event user is mapped to tags in second attempt
        manager = EventManager(make_event(event_id="b", **{"user": {"id": "1", "name": "jane"}}))
        manager.normalize()
        with self.tasks():
            event = manager.save(self.project.id)

        euser = EventUser.objects.get(id=euser.id)
        assert event.get_tag("sentry:user") == euser.tag_value
        assert euser.name == "jane"
        assert euser.ident == "1"

    def test_event_user_invalid_ip(self):
        manager = EventManager(
            make_event(
                event_id="a", environment="totally unique environment", **{"user": {"id": "1"}}
            )
        )

        manager.normalize()

        # This can happen as part of PII stripping, which happens after normalization
        manager._data["user"]["ip_address"] = "[ip]"

        with self.tasks():
            manager.save(self.project.id)

        euser = EventUser.objects.get(project_id=self.project.id)

        assert euser.ip_address is None

    def test_event_user_unicode_identifier(self):
        manager = EventManager(make_event(**{"user": {"username": "foô"}}))
        manager.normalize()
        with self.tasks():
            manager.save(self.project.id)
        euser = EventUser.objects.get(project_id=self.project.id)
        assert euser.username == "foô"

    def test_environment(self):
        manager = EventManager(make_event(**{"environment": "beta"}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert dict(event.tags).get("environment") == "beta"

    def test_invalid_environment(self):
        manager = EventManager(make_event(**{"environment": "bad/name"}))
        manager.normalize()
        event = manager.save(self.project.id)
        assert dict(event.tags).get("environment") is None

    def test_invalid_tags(self):
        manager = EventManager(make_event(**{"tags": [42]}))
        manager.normalize()
        assert None in manager.get_data().get("tags", [])
        assert 42 not in manager.get_data().get("tags", [])
        event = manager.save(self.project.id)
        assert 42 not in event.tags
        assert None not in event.tags

    @mock.patch("sentry.event_manager.eventstream.insert")
    def test_group_environment(self, eventstream_insert):
        release_version = "1.0"

        def save_event():
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
        eventstream_insert.assert_called_with(
            event=event,
            **group_states1,
            primary_hash="acbd18db4cc2f85cedef654fccc4a4d8",
            skip_consume=False,
            received_timestamp=event.data["received"],
            group_states=[{"id": event.groups[0].id, **group_states1}],
        )

        event = save_event()

        group_states2 = {
            "is_new": False,
            "is_regression": False,
            "is_new_group_environment": False,
        }

        # Ensure that the next event in the (group, environment) pair is *not*
        # marked as being part of a new environment.
        eventstream_insert.assert_called_with(
            event=event,
            **group_states2,
            primary_hash="acbd18db4cc2f85cedef654fccc4a4d8",
            skip_consume=False,
            received_timestamp=event.data["received"],
            group_states=[{"id": event.groups[0].id, **group_states2}],
        )

    def test_default_fingerprint(self):
        manager = EventManager(make_event())
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data.get("fingerprint") == ["{{ default }}"]

    def test_user_report_gets_environment(self):
        project = self.create_project()
        environment = Environment.objects.create(
            project_id=project.id, organization_id=project.organization_id, name="production"
        )
        environment.add_project(project)

        event_id = "a" * 32

        UserReport.objects.create(
            project_id=project.id,
            event_id=event_id,
            name="foo",
            email="bar@example.com",
            comments="It Broke!!!",
        )

        self.store_event(
            data=make_event(environment=environment.name, event_id=event_id), project_id=project.id
        )

        assert UserReport.objects.get(event_id=event_id).environment_id == environment.id

    def test_default_event_type(self):
        manager = EventManager(make_event(message="foo bar"))
        manager.normalize()
        data = manager.get_data()
        assert data["type"] == "default"
        event = manager.save(self.project.id)
        group = event.group
        assert group.data.get("type") == "default"
        assert group.data.get("metadata") == {"title": "foo bar"}

    def test_message_event_type(self):
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
        assert group.data.get("type") == "default"
        assert group.data.get("metadata") == {"title": "foo bar"}

    def test_error_event_type(self):
        manager = EventManager(
            make_event(**{"exception": {"values": [{"type": "Foo", "value": "bar"}]}})
        )
        manager.normalize()
        data = manager.get_data()
        assert data["type"] == "error"
        event = manager.save(self.project.id)
        group = event.group
        assert group.data.get("type") == "error"
        assert group.data.get("metadata") == {
            "type": "Foo",
            "value": "bar",
            "display_title_with_tree_label": False,
        }

    def test_csp_event_type(self):
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
        assert group.data.get("type") == "csp"
        assert group.data.get("metadata") == {
            "directive": "script-src",
            "uri": "example.com",
            "message": "Blocked 'script' from 'example.com'",
        }
        assert group.title == "Blocked 'script' from 'example.com'"

    def test_transaction_event_type(self):
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

    def test_transaction_event_span_grouping(self):
        with self.feature("projects:performance-suspect-spans-ingestion"):
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
            assert data["span_grouping_config"]["id"] == "default:2022-10-04"
            spans = [{"hash": span["hash"]} for span in data["spans"]]
            # the basic strategy is to simply use the description
            assert spans == [{"hash": hash_values([span["description"]])} for span in data["spans"]]

    def test_sdk(self):
        manager = EventManager(make_event(**{"sdk": {"name": "sentry-unity", "version": "1.0"}}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data["sdk"] == {
            "name": "sentry-unity",
            "version": "1.0",
            "integrations": None,
            "packages": None,
        }

    def test_no_message(self):
        # test that the message is handled gracefully
        manager = EventManager(
            make_event(**{"message": None, "logentry": {"message": "hello world"}})
        )
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.message == "hello world"

    def test_search_message(self):
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
        assert event.search_message == "hello world sentry.tasks.process"

    def test_stringified_message(self):
        manager = EventManager(make_event(**{"message": 1234}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.data["logentry"] == {"formatted": "1234", "message": None, "params": None}

    def test_bad_message(self):
        # test that invalid messages are rejected
        manager = EventManager(make_event(**{"message": ["asdf"]}))
        manager.normalize()
        event = manager.save(self.project.id)

        assert event.message == '["asdf"]'
        assert "logentry" in event.data

    def test_message_attribute_goes_to_interface(self):
        manager = EventManager(make_event(**{"message": "hello world"}))
        manager.normalize()
        event = manager.save(self.project.id)
        assert event.data["logentry"] == {
            "formatted": "hello world",
            "message": None,
            "params": None,
        }

    def test_message_attribute_shadowing(self):
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

    def test_message_attribute_interface_both_strings(self):
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

    def test_throws_when_matches_discarded_hash(self):
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
                        event = manager.save(self.project.id, cache_key=cache_key)

        assert mock_track_outcome.call_count == 3

        for o in mock_track_outcome.mock_calls:
            assert o.kwargs["outcome"] == Outcome.FILTERED
            assert o.kwargs["reason"] == FilterStatKeys.DISCARDED_HASH

        o = mock_track_outcome.mock_calls[0]
        assert o.kwargs["category"] == DataCategory.ERROR

        for o in mock_track_outcome.mock_calls[1:]:
            assert o.kwargs["category"] == DataCategory.ATTACHMENT
            assert o.kwargs["quantity"] == 5

    def test_honors_crash_report_limit(self):
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
                    manager.save(self.project.id, cache_key=cache_key)

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
                    event = manager.save(self.project.id, cache_key=cache_key)

        assert event.data["metadata"]["stripped_crash"] is True

        assert mock_track_outcome.call_count == 3
        o = mock_track_outcome.mock_calls[0]
        assert o.kwargs["outcome"] == Outcome.FILTERED
        assert o.kwargs["category"] == DataCategory.ATTACHMENT
        assert o.kwargs["reason"] == FilterStatKeys.CRASH_REPORT_LIMIT

        for o in mock_track_outcome.mock_calls[1:]:
            assert o.kwargs["outcome"] == Outcome.ACCEPTED

    def test_event_accepted_outcome(self):
        manager = EventManager(make_event(message="foo"))
        manager.normalize()

        mock_track_outcome = mock.Mock()
        with mock.patch("sentry.event_manager.track_outcome", mock_track_outcome):
            manager.save(self.project.id)

        assert_mock_called_once_with_partial(
            mock_track_outcome, outcome=Outcome.ACCEPTED, category=DataCategory.ERROR
        )

    def test_attachment_accepted_outcomes(self):
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
                manager.save(self.project.id, cache_key=cache_key)

        assert mock_track_outcome.call_count == 3

        for o in mock_track_outcome.mock_calls:
            assert o.kwargs["outcome"] == Outcome.ACCEPTED

        for o in mock_track_outcome.mock_calls[:2]:
            assert o.kwargs["category"] == DataCategory.ATTACHMENT
            assert o.kwargs["quantity"] == 5

        final = mock_track_outcome.mock_calls[2]
        assert final.kwargs["category"] == DataCategory.ERROR

    def test_attachment_filtered_outcomes(self):
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
                manager.save(self.project.id, cache_key=cache_key)

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

    def test_checksum_rehashed(self):
        checksum = "invalid checksum hash"
        manager = EventManager(make_event(**{"checksum": checksum}))
        manager.normalize()
        event = manager.save(self.project.id)

        hashes = [gh.hash for gh in GroupHash.objects.filter(group=event.group)]
        assert sorted(hashes) == sorted([hash_from_values(checksum), checksum])

    def test_legacy_attributes_moved(self):
        event = make_event(
            release="my-release",
            environment="my-environment",
            site="whatever",
            server_name="foo.com",
            event_id=uuid.uuid1().hex,
        )
        manager = EventManager(event)
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
    def test_save_issueless_event(self):
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
                timestamp=iso_format(before_now(minutes=5)),
                start_timestamp=iso_format(before_now(minutes=5)),
                type="transaction",
                platform="python",
            )
        )

        event = manager.save(self.project.id)

        assert event.group is None
        assert (
            tsdb.get_sums(tsdb.models.project, [self.project.id], event.datetime, event.datetime)[
                self.project.id
            ]
            == 0
        )

    @freeze_time()
    def test_fingerprint_ignored(self):
        manager1 = EventManager(make_event(event_id="a" * 32, fingerprint="fingerprint1"))
        event1 = manager1.save(self.project.id)

        manager2 = EventManager(
            make_event(
                event_id="b" * 32,
                fingerprint="fingerprint1",
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
                timestamp=iso_format(before_now(minutes=1)),
                start_timestamp=iso_format(before_now(minutes=1)),
                type="transaction",
                platform="python",
            )
        )
        event2 = manager2.save(self.project.id)

        assert event1.group is not None
        assert event2.group is None
        assert (
            tsdb.get_sums(tsdb.models.project, [self.project.id], event1.datetime, event1.datetime)[
                self.project.id
            ]
            == 1
        )

        assert (
            tsdb.get_sums(tsdb.models.group, [event1.group.id], event1.datetime, event1.datetime)[
                event1.group.id
            ]
            == 1
        )

    def test_category_match_in_app(self):
        """
        Regression test to ensure that grouping in-app enhancements work in
        principle.
        """
        from sentry.grouping.enhancer import Enhancements

        enhancement = Enhancements.from_config_string(
            """
            function:foo category=bar
            function:foo2 category=bar
            category:bar -app
            """,
        )

        event = make_event(
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

        manager = EventManager(event)
        manager.normalize()
        manager.get_data()["grouping_config"] = {
            "enhancements": enhancement.dumps(),
            "id": "mobile:2021-02-12",
        }
        event1 = manager.save(self.project.id)
        assert event1.data["exception"]["values"][0]["stacktrace"]["frames"][0]["in_app"] is False

        event = make_event(
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

        manager = EventManager(event)
        manager.normalize()
        manager.get_data()["grouping_config"] = {
            "enhancements": enhancement.dumps(),
            "id": "mobile:2021-02-12",
        }
        event2 = manager.save(self.project.id)
        assert event2.data["exception"]["values"][0]["stacktrace"]["frames"][0]["in_app"] is False
        assert event1.group_id == event2.group_id

    def test_category_match_group(self):
        """
        Regression test to ensure categories are applied consistently and don't
        produce hash mismatches.
        """
        from sentry.grouping.enhancer import Enhancements

        enhancement = Enhancements.from_config_string(
            """
            function:foo category=foo_like
            category:foo_like -group
            """,
        )

        event = make_event(
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

        manager = EventManager(event)
        manager.normalize()

        grouping_config = {
            "enhancements": enhancement.dumps(),
            "id": "mobile:2021-02-12",
        }

        manager.get_data()["grouping_config"] = grouping_config
        event1 = manager.save(self.project.id)

        event2 = Event(event1.project_id, event1.event_id, data=event1.data)

        assert event1.get_hashes().hashes == event2.get_hashes(grouping_config).hashes

    def test_write_none_tree_labels(self):
        """Write tree labels even if None"""

        event = make_event(
            platform="native",
            exception={
                "values": [
                    {
                        "type": "Hello",
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "<redacted>",
                                },
                                {
                                    "function": "<redacted>",
                                },
                            ]
                        },
                    }
                ]
            },
        )

        manager = EventManager(event)
        manager.normalize()

        manager.get_data()["grouping_config"] = {
            "id": "mobile:2021-02-12",
        }
        event = manager.save(self.project.id)

        assert event.data["hierarchical_tree_labels"] == [None]

    def test_synthetic_exception_detection(self):
        manager = EventManager(
            make_event(
                message="foo",
                event_id="b" * 32,
                exception={
                    "values": [
                        {
                            "type": "SIGABRT",
                            "mechanism": {"handled": False},
                            "stacktrace": {"frames": [{"function": "foo"}]},
                        }
                    ]
                },
            ),
            project=self.project,
        )
        manager.normalize()

        manager.get_data()["grouping_config"] = {
            "id": "mobile:2021-02-12",
        }
        event = manager.save(self.project.id)

        mechanism = event.interfaces["exception"].values[0].mechanism
        assert mechanism is not None
        assert mechanism.synthetic is True
        assert event.title == "foo"

    def test_auto_update_grouping(self):
        with override_settings(SENTRY_GROUPING_AUTO_UPDATE_ENABLED=False):
            # start out with legacy grouping, this should update us
            self.project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

            manager = EventManager(
                make_event(
                    message="foo",
                    event_id="c" * 32,
                ),
                project=self.project,
            )
            manager.normalize()
            manager.save(self.project.id, auto_upgrade_grouping=True)

            # No update yet
            project = Project.objects.get(id=self.project.id)
            assert project.get_option("sentry:grouping_config") == LEGACY_GROUPING_CONFIG

        with override_settings(SENTRY_GROUPING_AUTO_UPDATE_ENABLED=1.0):
            # start out with legacy grouping, this should update us
            self.project.update_option("sentry:grouping_config", LEGACY_GROUPING_CONFIG)

            manager = EventManager(
                make_event(
                    message="foo",
                    event_id="c" * 32,
                ),
                project=self.project,
            )
            manager.normalize()
            manager.save(self.project.id, auto_upgrade_grouping=True)

            # This should have moved us back to the default grouping
            project = Project.objects.get(id=self.project.id)
            assert project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG

            # and we should see an audit log record.
            record = AuditLogEntry.objects.first()
            assert record.event == audit_log.get_event_id("PROJECT_EDIT")
            assert record.data["sentry:grouping_config"] == DEFAULT_GROUPING_CONFIG
            assert record.data["slug"] == self.project.slug

    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_creation(self):
        self.project.update_option("sentry:performance_issue_creation_rate", 1.0)

        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"), self.feature(
            {
                "projects:performance-suspect-spans-ingestion": True,
                "organizations:performance-issues-ingest": True,
            }
        ):
            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            event = manager.save(self.project.id)
            data = event.data
            expected_hash = "19e15e0444e0bc1d5159fb07cd4bd2eb"
            assert event.get_event_type() == "transaction"
            assert data["span_grouping_config"]["id"] == "default:2022-10-04"
            assert data["hashes"] == [expected_hash]
            spans = [{"hash": span["hash"]} for span in data["spans"]]
            # the basic strategy is to simply use the description
            assert spans == [{"hash": hash_values([span["description"]])} for span in data["spans"]]
            assert len(event.groups) == 1
            group = event.groups[0]
            assert group.title == "N+1 Query"
            assert group.message == "/books/"
            assert group.culprit == "/books/"
            assert group.get_event_type() == "transaction"
            description = "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            assert group.get_event_metadata() == {
                "location": "/books/",
                "title": "N+1 Query",
                "value": description,
            }
            assert group.location() == "/books/"
            assert group.level == 40
            assert group.issue_category == GroupCategory.PERFORMANCE
            assert group.issue_type == GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
            assert EventPerformanceProblem.fetch(
                event, expected_hash
            ).problem == PerformanceProblem(
                expected_hash,
                "db",
                description,
                GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                ["8dd7a5869a4f4583"],
                ["9179e43ae844b174"],
                [
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
            )

    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_update(self):
        self.project.update_option("sentry:performance_issue_creation_rate", 1.0)

        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"), self.feature(
            {
                "projects:performance-suspect-spans-ingestion": True,
                "organizations:performance-issues-ingest": True,
            }
        ):
            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            event = manager.save(self.project.id)
            group = event.groups[0]
            assert group.issue_category == GroupCategory.PERFORMANCE
            assert group.issue_type == GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
            group.data["metadata"] = {
                "location": "hi",
                "title": "lol",
            }
            group.culprit = "wat"
            group.message = "nope"
            group.save()
            assert group.location() == "hi"
            assert group.title == "lol"

            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            with self.tasks():
                manager.save(self.project.id)
            # Make sure the original group is updated via buffers
            group.refresh_from_db()
            assert group.title == "N+1 Query"

            assert group.get_event_metadata() == {
                "location": "/books/",
                "title": "N+1 Query",
                "value": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            }
            assert group.location() == "/books/"
            assert group.message == "/books/"
            assert group.culprit == "/books/"

    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_error_issue_no_associate_perf_event(self):
        """Test that you can't associate a performance event with an error issue"""
        self.project.update_option("sentry:performance_issue_creation_rate", 1.0)

        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"), self.feature(
            {
                "projects:performance-suspect-spans-ingestion": True,
                "organizations:performance-issues-ingest": True,
            }
        ):
            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            event = manager.save(self.project.id)
            assert len(event.groups) == 1

            # sneakily make the group type wrong
            group = event.groups[0]
            group.type = GroupType.ERROR.value
            group.save()
            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            event = manager.save(self.project.id)

            assert len(event.groups) == 0

    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def test_perf_issue_no_associate_error_event(self):
        """Test that you can't associate an error event with a performance issue"""
        self.project.update_option("sentry:performance_issue_creation_rate", 1.0)

        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"), self.feature(
            {
                "projects:performance-suspect-spans-ingestion": True,
                "organizations:performance-issues-ingest": True,
            }
        ):
            manager = EventManager(make_event())
            manager.normalize()
            event = manager.save(self.project.id)
            assert len(event.groups) == 1

            # sneakily make the group type wrong
            group = event.groups[0]
            group.type = GroupType.PERFORMANCE_N_PLUS_ONE.value
            group.save()
            manager = EventManager(make_event())
            manager.normalize()
            event = manager.save(self.project.id)

            assert len(event.groups) == 0


class AutoAssociateCommitTest(TestCase, EventManagerTestMixin):
    def setUp(self):
        super().setUp()
        self.repo_name = "example"
        self.project = self.create_project(name="foo")
        self.integration = Integration.objects.create(
            provider="github", name=self.repo_name, external_id="654321"
        )
        self.org_integration = self.integration.add_organization(
            self.project.organization, self.user
        )
        self.repo = self.create_repo(
            project=self.project,
            name=self.repo_name,
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.repo.update(config={"name": self.repo_name})
        self.create_code_mapping(
            project=self.project,
            repo=self.repo,
            organization_integration=self.org_integration,
            stack_root="/stack/root",
            source_root="/source/root",
            default_branch="main",
        )
        stub_installation_token()
        responses.add(
            "GET",
            f"https://api.github.com/repos/{self.repo_name}/commits/{LATER_COMMIT_SHA}",
            json=json.loads(GET_COMMIT_EXAMPLE),
        )
        responses.add(
            "GET",
            f"https://api.github.com/repos/{self.repo_name}/commits/{EARLIER_COMMIT_SHA}",
            json=json.loads(GET_PRIOR_COMMIT_EXAMPLE),
        )
        self.dummy_commit_sha = "a" * 40
        responses.add(
            responses.GET,
            f"https://api.github.com/repos/{self.repo_name}/compare/{self.dummy_commit_sha}...{LATER_COMMIT_SHA}",
            json=json.loads(COMPARE_COMMITS_EXAMPLE_WITH_INTERMEDIATE),
        )
        responses.add(
            responses.GET,
            f"https://api.github.com/repos/{self.repo_name}/commits?sha={LATER_COMMIT_SHA}",
            json=json.loads(GET_LAST_2_COMMITS_EXAMPLE),
        )

    def _create_first_release_commit(self):
        # Create a release
        release = self.create_release(project=self.project, version="abcabcabc")
        # Create a commit
        commit = self.create_commit(
            repo=self.repo,
            key=self.dummy_commit_sha,
        )
        # Make a release head commit
        ReleaseHeadCommit.objects.create(
            organization_id=self.project.organization.id,
            repository_id=self.repo.id,
            release=release,
            commit=commit,
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commits_on_sha_release_version(self, get_jwt):
        with self.feature("projects:auto-associate-commits-to-release"):

            self._create_first_release_commit()
            # Make a new release with SHA checksum
            with self.tasks():
                _ = self.make_release_event(LATER_COMMIT_SHA, self.project.id)

            release2 = Release.objects.get(version=LATER_COMMIT_SHA)
            commit_list = list(
                Commit.objects.filter(releasecommit__release=release2).order_by(
                    "releasecommit__order"
                )
            )

            assert len(commit_list) == 2
            assert commit_list[0].repository_id == self.repo.id
            assert commit_list[0].organization_id == self.project.organization.id
            assert commit_list[0].key == EARLIER_COMMIT_SHA
            assert commit_list[1].repository_id == self.repo.id
            assert commit_list[1].organization_id == self.project.organization.id
            assert commit_list[1].key == LATER_COMMIT_SHA

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commits_first_release(self, get_jwt):
        with self.feature("projects:auto-associate-commits-to-release"):
            with self.tasks():
                _ = self.make_release_event(LATER_COMMIT_SHA, self.project.id)

            release2 = Release.objects.get(version=LATER_COMMIT_SHA)
            commit_list = list(
                Commit.objects.filter(releasecommit__release=release2).order_by(
                    "releasecommit__order"
                )
            )

            assert len(commit_list) == 2
            assert commit_list[0].repository_id == self.repo.id
            assert commit_list[0].organization_id == self.project.organization.id
            assert commit_list[0].key == EARLIER_COMMIT_SHA
            assert commit_list[1].repository_id == self.repo.id
            assert commit_list[1].organization_id == self.project.organization.id
            assert commit_list[1].key == LATER_COMMIT_SHA

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commits_not_a_sha(self, get_jwt):
        SHA = "not-a-sha"
        with self.feature("projects:auto-associate-commits-to-release"):
            with self.tasks():
                _ = self.make_release_event(SHA, self.project.id)

            release2 = Release.objects.get(version=SHA)
            commit_list = list(
                Commit.objects.filter(releasecommit__release=release2).order_by(
                    "releasecommit__order"
                )
            )
            assert len(commit_list) == 0

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commit_not_found(self, get_jwt):
        SHA = "b" * 40
        responses.add(
            "GET",
            f"https://api.github.com/repos/{self.repo_name}/commits/{SHA}",
            status=HTTP_404_NOT_FOUND,
        )
        with self.feature("projects:auto-associate-commits-to-release"):
            with self.tasks():
                _ = self.make_release_event(SHA, self.project.id)

            release2 = Release.objects.get(version=SHA)
            commit_list = list(
                Commit.objects.filter(releasecommit__release=release2).order_by(
                    "releasecommit__order"
                )
            )
            assert len(commit_list) == 0

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commits_release_conflict(self, get_jwt):
        # Release is created but none of the commits, we should still associate commits
        with self.feature("projects:auto-associate-commits-to-release"):
            preexisting_release = self.create_release(
                project=self.project, version=LATER_COMMIT_SHA
            )
            with self.tasks():
                _ = self.make_release_event(LATER_COMMIT_SHA, self.project.id)

            commit_releases = Release.objects.filter(version=LATER_COMMIT_SHA).all()
            assert len(commit_releases) == 1
            assert commit_releases[0].id == preexisting_release.id
            commit_list = list(
                Commit.objects.filter(releasecommit__release=preexisting_release).order_by(
                    "releasecommit__order"
                )
            )

            assert len(commit_list) == 2
            assert commit_list[0].repository_id == self.repo.id
            assert commit_list[0].organization_id == self.project.organization.id
            assert commit_list[0].key == EARLIER_COMMIT_SHA
            assert commit_list[1].repository_id == self.repo.id
            assert commit_list[1].organization_id == self.project.organization.id
            assert commit_list[1].key == LATER_COMMIT_SHA

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commits_commit_conflict(self, get_jwt):
        # A commit tied to the release is somehow created before the release itself is created.
        # autoassociation should tie the existing commit to the new release
        with self.feature("projects:auto-associate-commits-to-release"):

            author = CommitAuthor.objects.create(
                organization_id=self.organization.id,
                email="support@github.com",
                name="Monalisa Octocat",
            )

            # Values taken from commit generated from GH response fixtures
            preexisting_commit = self.create_commit(
                repo=self.repo,
                project=self.project,
                author=author,
                key=EARLIER_COMMIT_SHA,
                message="Fix all the bugs",
                date_added=datetime(2011, 4, 14, 16, 0, 49, tzinfo=timezone.utc),
            )

            with self.tasks():
                self.make_release_event(LATER_COMMIT_SHA, self.project.id)

            new_release = Release.objects.get(version=LATER_COMMIT_SHA)
            commit_list = list(
                Commit.objects.filter(releasecommit__release=new_release).order_by(
                    "releasecommit__order"
                )
            )

            assert len(commit_list) == 2
            assert commit_list[0].id == preexisting_commit.id
            assert commit_list[0].repository_id == self.repo.id
            assert commit_list[0].organization_id == self.project.organization.id
            assert commit_list[0].key == EARLIER_COMMIT_SHA
            assert commit_list[1].repository_id == self.repo.id
            assert commit_list[1].organization_id == self.project.organization.id
            assert commit_list[1].key == LATER_COMMIT_SHA

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commits_feature_not_enabled(self, get_jwt):
        with self.feature({"projects:auto-associate-commits-to-release": False}):
            with self.tasks():
                _ = self.make_release_event(LATER_COMMIT_SHA, self.project.id)

            release2 = Release.objects.get(version=LATER_COMMIT_SHA)
            commit_list = list(
                Commit.objects.filter(releasecommit__release=release2).order_by(
                    "releasecommit__order"
                )
            )

            assert len(commit_list) == 0

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_autoassign_commits_duplicate_events(self, get_jwt):
        with self.feature({"projects:auto-associate-commits-to-release": True}):
            with self.tasks():
                event1 = self.make_release_event(LATER_COMMIT_SHA, self.project.id)
                event2 = self.make_release_event(LATER_COMMIT_SHA, self.project.id)

            assert event1 != event2
            assert event1.release == event2.release
            releases = Release.objects.filter(version=LATER_COMMIT_SHA).all()
            assert len(releases) == 1
            commit_list = list(
                Commit.objects.filter(releasecommit__release=releases[0]).order_by(
                    "releasecommit__order"
                )
            )

            assert len(commit_list) == 2
            assert commit_list[0].repository_id == self.repo.id
            assert commit_list[0].organization_id == self.project.organization.id
            assert commit_list[0].key == EARLIER_COMMIT_SHA
            assert commit_list[1].repository_id == self.repo.id
            assert commit_list[1].organization_id == self.project.organization.id
            assert commit_list[1].key == LATER_COMMIT_SHA


@region_silo_test
class ReleaseIssueTest(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.release = Release.get_or_create(self.project, "1.0")
        self.environment1 = Environment.get_or_create(self.project, "prod")
        self.environment2 = Environment.get_or_create(self.project, "staging")
        self.timestamp = float(int(time() - 300))

    def make_event(self, **kwargs):
        result = {
            "event_id": "a" * 32,
            "message": "foo",
            "timestamp": self.timestamp + 0.23,
            "level": logging.ERROR,
            "logger": "default",
            "tags": [],
        }
        result.update(kwargs)
        return result

    def make_release_event(
        self, release_version="1.0", environment_name="prod", project_id=1, **kwargs
    ):
        event = make_event(
            release=release_version, environment=environment_name, event_id=uuid.uuid1().hex
        )
        event.update(kwargs)
        manager = EventManager(event)
        with self.tasks():
            event = manager.save(project_id)
        return event

    def convert_timestamp(self, timestamp):
        date = datetime.fromtimestamp(timestamp)
        date = date.replace(tzinfo=timezone.utc)
        return date

    def assert_release_project_environment(self, event, new_issues_count, first_seen, last_seen):
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

    def test_different_groups(self):
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

    def test_same_group(self):
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

    def test_same_group_different_environment(self):
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


@region_silo_test
@apply_feature_flag_on_cls("organizations:server-side-sampling")
@apply_feature_flag_on_cls("organizations:dynamic-sampling")
class DSLatestReleaseBoostTest(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.release = Release.get_or_create(self.project, "1.0")
        self.environment1 = Environment.get_or_create(self.project, "prod")
        self.environment2 = Environment.get_or_create(self.project, "staging")
        self.timestamp = float(int(time() - 300))
        self.redis_client = get_redis_client_for_ds()

    def make_transaction_event(self, **kwargs):
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
        self, release_version="1.0", environment_name="prod", project_id=1, **kwargs
    ):
        transaction = self.make_transaction_event(
            release=release_version, environment=environment_name, event_id=uuid.uuid1().hex
        )
        transaction.update(kwargs)
        manager = EventManager(transaction)
        with self.tasks():
            event = manager.save(project_id)
        return event

    @freeze_time()
    def test_boost_release_when_first_observed(self):
        with self.options(
            {
                "dynamic-sampling:boost-latest-release": True,
            }
        ):
            self.make_release_transaction(
                release_version=self.release.version,
                environment_name=self.environment1.name,
                project_id=self.project.id,
                checksum="a" * 32,
                timestamp=self.timestamp,
            )

            ts = time()

            assert self.redis_client.get(f"ds::p:{self.project.id}:r:{self.release.id}") == "1"
            assert self.redis_client.hgetall(f"ds::p:{self.project.id}:boosted_releases") == {
                str(self.release.id): str(ts)
            }

            new_release = Release.get_or_create(self.project, "2.0")

            self.make_release_transaction(
                release_version=new_release.version,
                environment_name=self.environment1.name,
                project_id=self.project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )

            assert self.redis_client.get(f"ds::p:{self.project.id}:r:{new_release.id}") == "1"
            assert self.redis_client.hgetall(f"ds::p:{self.project.id}:boosted_releases") == {
                str(self.release.id): str(ts),
                str(new_release.id): str(ts),
            }

    def test_ensure_release_not_boosted_when_it_is_not_first_observed(self):
        with self.options(
            {
                "dynamic-sampling:boost-latest-release": True,
            }
        ):
            self.redis_client.set(f"ds::p:{self.project.id}:r:{self.release.id}", 1, 60 * 60 * 24)
            self.make_release_transaction(
                release_version=self.release.version,
                environment_name=self.environment1.name,
                project_id=self.project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )
            assert self.redis_client.hgetall(f"ds::p:{self.project.id}:boosted_releases") == {}
            assert get_boosted_releases(self.project.id) == []

    @freeze_time()
    def test_evict_expired_boosted_releases(self):
        release_2 = Release.get_or_create(self.project, "2.0")
        release_3 = Release.get_or_create(self.project, "3.0")

        for release_id in (self.release.id, release_2.id):
            self.redis_client.set(f"ds::p:{self.project.id}:r:{release_id}", 1, 60 * 60 * 24)
            self.redis_client.hset(
                f"ds::p:{self.project.id}:boosted_releases",
                release_id,
                time() - BOOSTED_RELEASE_TIMEOUT * 2,
            )

        with self.options(
            {
                "dynamic-sampling:boost-latest-release": True,
            }
        ):
            self.make_release_transaction(
                release_version=release_3.version,
                environment_name=self.environment1.name,
                project_id=self.project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )
            assert self.redis_client.hgetall(f"ds::p:{self.project.id}:boosted_releases") == {
                str(release_3.id): str(time())
            }
            assert self.redis_client.get(f"ds::p:{self.project.id}:r:{release_3.id}") == "1"
            assert get_boosted_releases(self.project.id) == [(release_3.id, time())]

    @mock.patch("sentry.event_manager.schedule_invalidate_project_config")
    def test_project_config_invalidation_is_triggered_when_new_release_is_observed(
        self, mocked_invalidate
    ):
        with self.options(
            {
                "dynamic-sampling:boost-latest-release": True,
            }
        ):
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

    @freeze_time()
    @mock.patch("sentry.dynamic_sampling.latest_release_booster.BOOSTED_RELEASES_LIMIT", 2)
    def test_too_many_boosted_releases_do_not_boost_anymore(self):
        """
        This test tests the case when we have already too many boosted releases, in this case we want to skip the
        boosting of anymore releases
        """
        release_2 = Release.get_or_create(self.project, "2.0")
        release_3 = Release.get_or_create(self.project, "3.0")

        for release_id in (self.release.id, release_2.id):
            self.redis_client.set(f"ds::p:{self.project.id}:r:{release_id}", 1, 60 * 60 * 24)
            self.redis_client.hset(
                f"ds::p:{self.project.id}:boosted_releases",
                release_id,
                time(),
            )

        with self.options(
            {
                "dynamic-sampling:boost-latest-release": True,
            }
        ):
            self.make_release_transaction(
                release_version=release_3.version,
                environment_name=self.environment1.name,
                project_id=self.project.id,
                checksum="b" * 32,
                timestamp=self.timestamp,
            )
            assert self.redis_client.hgetall(f"ds::p:{self.project.id}:boosted_releases") == {
                str(self.release.id): str(time()),
                str(release_2.id): str(time()),
            }
            assert self.redis_client.get(f"ds::p:{self.project.id}:r:{release_3.id}") is None


class TestSaveGroupHashAndGroup(TransactionTestCase):
    def test(self):
        perf_data = load_data("transaction-n-plus-one", timestamp=before_now(minutes=10))
        event = _get_event_instance(perf_data, project_id=self.project.id)
        group_hash = "some_group"
        group = _save_grouphash_and_group(self.project, event, group_hash)
        group_2 = _save_grouphash_and_group(self.project, event, group_hash)
        assert group.id == group_2.id
        assert Group.objects.filter(grouphash__hash=group_hash).count() == 1
        group_3 = _save_grouphash_and_group(self.project, event, "new_hash")
        assert group_2.id != group_3.id
        assert Group.objects.filter(grouphash__hash=group_hash).count() == 1
