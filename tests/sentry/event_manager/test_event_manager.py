# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import logging
from sentry.utils.compat import mock
import pytest
import uuid

from datetime import datetime, timedelta
from django.utils import timezone
from time import time

from sentry import nodestore
from sentry.app import tsdb
from sentry.attachments import attachment_cache, CachedAttachment
from sentry.constants import DataCategory, MAX_VERSION_LENGTH
from sentry.eventstore.models import Event
from sentry.event_manager import (
    HashDiscarded,
    EventManager,
    EventUser,
    has_pending_commit_resolution,
)
from sentry.grouping.utils import hash_from_values
from sentry.models import (
    Activity,
    Commit,
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
    Release,
    ReleaseCommit,
    ReleaseProjectEnvironment,
    OrganizationIntegration,
    UserReport,
)
from sentry.utils.cache import cache_key_for_event
from sentry.utils.outcomes import Outcome
from sentry.testutils import assert_mock_called_once_with_partial, TestCase
from sentry.ingest.inbound_filters import FilterStatKeys


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


class EventManagerTest(TestCase):
    def make_release_event(self, release_name, project_id):
        manager = EventManager(make_event(release=release_name))
        manager.normalize()
        event = manager.save(project_id)
        return event

    def test_similar_message_prefix_doesnt_group(self):
        # we had a regression which caused the default hash to just be
        # 'event.message' instead of '[event.message]' which caused it to
        # generate a hash per letter
        manager = EventManager(make_event(event_id="a", message="foo bar"))
        manager.normalize()
        event1 = manager.save(1)

        manager = EventManager(make_event(event_id="b", message="foo baz"))
        manager.normalize()
        event2 = manager.save(1)

        assert event1.group_id != event2.group_id

    def test_ephemeral_interfaces_removed_on_save(self):
        manager = EventManager(make_event(platform="python"))
        manager.normalize()
        event = manager.save(1)

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
        event = manager.save(1)

        manager = EventManager(
            make_event(
                message="foo bar", event_id="b" * 32, checksum="a" * 32, timestamp=timestamp + 2.0
            )
        )
        manager.normalize()

        with self.tasks():
            event2 = manager.save(1)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime
        assert group.message == event2.message
        assert group.data.get("type") == "default"
        assert group.data.get("metadata") == {"title": "foo bar"}

    def test_updates_group_with_fingerprint(self):
        ts = time() - 200
        manager = EventManager(
            make_event(message="foo", event_id="a" * 32, fingerprint=["a" * 32], timestamp=ts)
        )
        with self.tasks():
            event = manager.save(1)

        manager = EventManager(
            make_event(message="foo bar", event_id="b" * 32, fingerprint=["a" * 32], timestamp=ts)
        )
        with self.tasks():
            event2 = manager.save(1)

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
            event = manager.save(1)

        manager = EventManager(
            make_event(message="foo bar", event_id="b" * 32, fingerprint=["a" * 32])
        )
        with self.tasks():
            manager.normalize()
            event2 = manager.save(1)

        assert event.group_id != event2.group_id

    @mock.patch("sentry.signals.issue_unresolved.send_robust")
    def test_unresolves_group(self, send_robust):
        ts = time() - 300

        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1.
        manager = EventManager(make_event(event_id="a" * 32, checksum="a" * 32, timestamp=ts))
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 50))
        event2 = manager.save(1)
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
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(
            make_event(event_id="b" * 32, checksum="a" * 32, timestamp=1403007315)
        )
        manager.normalize()
        event2 = manager.save(1)
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
        event = manager.save(1)

        group = event.group

        group.update(status=GroupStatus.RESOLVED)

        resolution = GroupResolution.objects.create(release=old_release, group=group)
        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.SET_RESOLVED_IN_RELEASE,
            ident=resolution.id,
            data={"version": ""},
        )

        manager = EventManager(
            make_event(
                event_id="b" * 32, checksum="a" * 32, timestamp=time(), release=old_release.version
            )
        )
        event = manager.save(1)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data["version"] == ""

        assert GroupResolution.objects.filter(group=group).exists()

        manager = EventManager(
            make_event(event_id="c" * 32, checksum="a" * 32, timestamp=time(), release="b")
        )
        event = manager.save(1)
        assert event.group_id == group.id

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        activity = Activity.objects.get(id=activity.id)
        assert activity.data["version"] == "b"

        assert not GroupResolution.objects.filter(group=group).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_REGRESSION)

        mock_send_activity_notifications_delay.assert_called_once_with(activity.id)

    def test_has_pending_commit_resolution(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)

        group = event.group
        assert group.first_release.version == "1.0"
        pending = has_pending_commit_resolution(group)
        assert pending is False

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

        pending = has_pending_commit_resolution(group)
        assert pending

    def test_multiple_pending_commit_resolution(self):
        project_id = 1
        event = self.make_release_event("1.0", project_id)
        group = event.group

        # Add a few commits with no associated release
        repo = self.create_repo(project=group.project)
        for key in ["a", "b", "c"]:
            commit = Commit.objects.create(
                organization_id=group.project.organization_id, repository_id=repo.id, key=key * 40,
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
        event = manager.save(1)

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
            type=Activity.SET_RESOLVED_IN_RELEASE,
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
                event = manager.save(1)
                assert event.group_id == group.id

                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.RESOLVED

                activity = Activity.objects.get(id=activity.id)
                assert activity.data["version"] == ""

                assert GroupResolution.objects.filter(group=group).exists()

                manager = EventManager(
                    make_event(event_id="c" * 32, checksum="a" * 32, timestamp=time(), release="b")
                )
                event = manager.save(1)
                mock_sync_status_outbound.assert_called_once_with(
                    external_issue, False, event.group.project_id
                )
                assert event.group_id == group.id

                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.UNRESOLVED

                activity = Activity.objects.get(id=activity.id)
                assert activity.data["version"] == "b"

                assert not GroupResolution.objects.filter(group=group).exists()

                activity = Activity.objects.get(group=group, type=Activity.SET_REGRESSION)

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
            event = manager.save(1)

        mock_is_resolved.return_value = True
        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 100))
        with self.tasks():
            event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group.id)
        assert group.active_at.replace(second=0) == event2.datetime.replace(second=0)
        assert group.active_at.replace(second=0) != event.datetime.replace(second=0)

    def test_invalid_transaction(self):
        dict_input = {"messages": "foo"}
        manager = EventManager(make_event(transaction=dict_input))
        manager.normalize()
        event = manager.save(1)
        assert event.transaction is None

    def test_transaction_as_culprit(self):
        manager = EventManager(make_event(transaction="foobar"))
        manager.normalize()
        event = manager.save(1)
        assert event.transaction == "foobar"
        assert event.culprit == "foobar"

    def test_culprit_is_not_transaction(self):
        manager = EventManager(make_event(culprit="foobar"))
        manager.normalize()
        event1 = manager.save(1)
        assert event1.transaction is None
        assert event1.culprit == "foobar"

    def test_inferred_culprit_from_empty_stacktrace(self):
        manager = EventManager(make_event(stacktrace={"frames": []}))
        manager.normalize()
        event = manager.save(1)
        assert event.culprit == ""

    def test_transaction_and_culprit(self):
        manager = EventManager(make_event(transaction="foobar", culprit="baz"))
        manager.normalize()
        event1 = manager.save(1)
        assert event1.transaction == "foobar"
        assert event1.culprit == "baz"

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
            version="foo-%s" % ("a" * partial_version_len,), organization=project.organization
        )
        release.add_project(project)

        event = self.make_release_event("a" * partial_version_len, project.id)

        group = event.group
        assert group.first_release.version == "foo-%s" % ("a" * partial_version_len,)
        release_tag = [v for k, v in event.tags if k == "sentry:release"][0]
        assert release_tag == "foo-%s" % ("a" * partial_version_len,)

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
        event = manager.save(1)

        release = Release.objects.get(version="1.0", projects=event.project_id)

        assert GroupRelease.objects.filter(
            release_id=release.id, group_id=event.group_id, environment="prod"
        ).exists()

        manager = EventManager(make_event(release="1.0", environment="staging", event_id="b" * 32))
        event = manager.save(1)

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
        manager = EventManager(make_event(**{"user": {"username": u"foô"}}))
        manager.normalize()
        with self.tasks():
            manager.save(self.project.id)
        euser = EventUser.objects.get(project_id=self.project.id)
        assert euser.username == u"foô"

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

        # Ensure that the first event in the (group, environment) pair is
        # marked as being part of a new environment.
        eventstream_insert.assert_called_with(
            group=event.group,
            event=event,
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            primary_hash="acbd18db4cc2f85cedef654fccc4a4d8",
            skip_consume=False,
            received_timestamp=event.data["received"],
        )

        event = save_event()

        # Ensure that the next event in the (group, environment) pair is *not*
        # marked as being part of a new environment.
        eventstream_insert.assert_called_with(
            group=event.group,
            event=event,
            is_new=False,
            is_regression=None,  # XXX: wut
            is_new_group_environment=False,
            primary_hash="acbd18db4cc2f85cedef654fccc4a4d8",
            skip_consume=False,
            received_timestamp=event.data["received"],
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
            project=project,
            event_id=event_id,
            name="foo",
            email="bar@example.com",
            comments="It Broke!!!",
        )

        self.store_event(
            data=make_event(environment=environment.name, event_id=event_id), project_id=project.id
        )

        assert UserReport.objects.get(event_id=event_id).environment == environment

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
        assert group.data.get("metadata") == {"type": "Foo", "value": "bar"}

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
            event = manager.save(1)

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
                    with self.assertRaises(HashDiscarded):
                        event = manager.save(1, cache_key=cache_key)

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
            manager.save(1)

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
                manager.save(1, cache_key=cache_key)

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
                manager.save(1, cache_key=cache_key)

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
        event = manager.save(1)

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
                timestamp="2019-06-14T14:01:40Z",
                start_timestamp="2019-06-14T14:01:40Z",
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
            == 1
        )

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
                timestamp="2019-06-14T14:01:40Z",
                start_timestamp="2019-06-14T14:01:40Z",
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
            == 2
        )

        assert (
            tsdb.get_sums(tsdb.models.group, [event1.group.id], event1.datetime, event1.datetime)[
                event1.group.id
            ]
            == 1
        )


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
