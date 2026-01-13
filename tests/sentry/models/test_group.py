import uuid
from datetime import datetime, timedelta
from unittest import mock
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache
from django.db.models import ProtectedError
from django.utils import timezone

from sentry.issues.grouptype import FeedbackGroup, ProfileFileIOGroupType, ReplayHydrationErrorType
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus, get_group_with_redirect
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupredirect import GroupRedirect
from sentry.models.grouprelease import GroupRelease
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.project import Project
from sentry.models.release import Release, _get_cache_key
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import ReplaysSnubaTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = requires_snuba


class GroupTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1).isoformat()

    def test_is_resolved(self) -> None:
        group = self.create_group(status=GroupStatus.RESOLVED)
        assert group.is_resolved()

        group.status = GroupStatus.IGNORED
        assert not group.is_resolved()

        group.status = GroupStatus.UNRESOLVED
        assert not group.is_resolved()

        group.last_seen = timezone.now() - timedelta(hours=12)

        group.project.update_option("sentry:resolve_age", 24)

        assert not group.is_resolved()

        group.project.update_option("sentry:resolve_age", 1)

        assert group.is_resolved()

    def test_is_ignored_with_expired_snooze(self) -> None:
        group = self.create_group(status=GroupStatus.IGNORED)
        GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(minutes=1))
        assert not group.is_ignored()

    def test_status_with_expired_snooze(self) -> None:
        group = self.create_group(status=GroupStatus.IGNORED)
        GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(minutes=1))
        assert group.get_status() == GroupStatus.UNRESOLVED

    def test_deleting_release_does_not_delete_group(self) -> None:
        project = self.create_project()
        release = Release.objects.create(version="a", organization_id=project.organization_id)
        release.add_project(project)
        group = self.create_group(project=project, first_release=release)

        with pytest.raises(ProtectedError):
            release.delete()

        group = Group.objects.get(id=group.id)
        assert group.first_release == release

    def test_save_truncate_message(self) -> None:
        assert len(self.create_group(message="x" * 300).message) == 255
        assert self.create_group(message="\nfoo\n   ").message == "foo"
        assert self.create_group(message="foo").message == "foo"
        assert self.create_group(message="").message == ""

    def test_get_group_with_redirect(self) -> None:
        group = self.create_group()
        assert get_group_with_redirect(group.id) == (group, False)

        duplicate_id = self.create_group().id
        Group.objects.filter(id=duplicate_id).delete()
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=duplicate_id)

        assert get_group_with_redirect(duplicate_id) == (group, True)

        # We shouldn't end up in a case where the redirect points to a bad
        # reference, but testing this path for completeness.
        group.delete()

        with pytest.raises(Group.DoesNotExist):
            get_group_with_redirect(duplicate_id)

    def test_get_group_with_redirect_from_qualified_short_id(self) -> None:
        group = self.create_group()
        assert group.qualified_short_id
        assert get_group_with_redirect(
            group.qualified_short_id, organization=group.project.organization
        ) == (group, False)

        duplicate_group = self.create_group()
        duplicate_id = duplicate_group.id
        GroupRedirect.create_for_group(duplicate_group, group)
        Group.objects.filter(id=duplicate_id).delete()

        assert get_group_with_redirect(
            duplicate_group.qualified_short_id, organization=group.project.organization
        ) == (group, True)

        # We shouldn't end up in a case where the redirect points to a bad
        # reference, but testing this path for completeness.
        group.delete()

        with pytest.raises(Group.DoesNotExist):
            get_group_with_redirect(
                duplicate_group.qualified_short_id, organization=group.project.organization
            )

    def test_invalid_shared_id(self) -> None:
        with pytest.raises(Group.DoesNotExist):
            Group.objects.from_share_id("adc7a5b902184ce3818046302e94f8ec")

    def test_qualified_share_id(self) -> None:
        project = self.create_project(name="foo bar")
        group = self.create_group(project=project, short_id=project.next_short_id())
        short_id = group.qualified_short_id

        assert short_id.startswith("FOO-BAR-")

        group2 = Group.objects.by_qualified_short_id(group.organization.id, short_id)

        assert group2 == group

        with pytest.raises(Group.DoesNotExist):
            Group.objects.by_qualified_short_id(
                group.organization.id, "server_name:my-server-with-dashes-0ac14dadda3b428cf"
            )

        group.update(status=GroupStatus.PENDING_DELETION, substatus=None)
        with pytest.raises(Group.DoesNotExist):
            Group.objects.by_qualified_short_id(group.organization.id, short_id)

    def test_qualified_share_id_bulk(self) -> None:
        project = self.create_project(name="foo bar")
        group = self.create_group(project=project, short_id=project.next_short_id())
        group_2 = self.create_group(project=project, short_id=project.next_short_id())
        group_short_id = group.qualified_short_id
        group_2_short_id = group_2.qualified_short_id
        assert [group] == Group.objects.by_qualified_short_id_bulk(
            group.organization.id, [group_short_id]
        )
        assert {group, group_2} == set(
            Group.objects.by_qualified_short_id_bulk(
                group.organization.id,
                [group_short_id, group_2_short_id],
            )
        )

        group.update(status=GroupStatus.PENDING_DELETION, substatus=None)
        with pytest.raises(Group.DoesNotExist):
            Group.objects.by_qualified_short_id_bulk(
                group.organization.id, [group_short_id, group_2_short_id]
            )

    def test_by_qualified_short_id_bulk_case_insensitive_project_slug(self) -> None:
        project = self.create_project(slug="mixedcaseslug")
        group = self.create_group(project=project, short_id=project.next_short_id())

        Project.objects.filter(id=project.id).update(slug="MixedCaseSlug")
        assert Project.objects.get(id=project.id).slug == "MixedCaseSlug"

        # Re-fetch to ensure updated relation is used when computing qualified_short_id
        group = Group.objects.get(id=group.id)
        short_id = group.qualified_short_id

        # Should resolve via case-insensitive slug fallback
        resolved = Group.objects.by_qualified_short_id_bulk(group.organization.id, [short_id])
        assert resolved == [group]

    def test_first_last_release(self) -> None:
        project = self.create_project()
        release = Release.objects.create(version="a", organization_id=project.organization_id)
        event = self.store_event(
            data={"release": "a", "timestamp": self.min_ago}, project_id=project.id
        )
        group = event.group

        release = Release.objects.get(version="a")

        assert group.first_release == release
        assert group.get_first_release() == release.version
        cache.delete(_get_cache_key(group.id, group.project_id, True))
        assert group.get_last_release() == release.version

    def test_first_release_from_tag(self) -> None:
        project = self.create_project()
        event = self.store_event(
            data={"release": "a", "timestamp": self.min_ago}, project_id=project.id
        )

        group = event.group

        assert group.get_first_release() == "a"
        cache.delete(_get_cache_key(group.id, group.project_id, True))
        assert group.get_last_release() == "a"

    def test_first_last_release_miss(self) -> None:
        project = self.create_project()
        release = Release.objects.create(version="a", organization_id=project.organization_id)
        release.add_project(project)

        group = self.create_group(project=project)

        assert group.first_release is None
        assert group.get_first_release() is None
        assert group.get_last_release() is None

    def test_get_email_subject(self) -> None:
        project = self.create_project()
        group = self.create_group(project=project)

        expect = f"{group.qualified_short_id} - {group.title}"
        assert group.get_email_subject() == expect

    def test_get_absolute_url(self) -> None:
        for org_slug, group_id, params, expected in [
            ("org1", 23, None, "http://testserver/organizations/org1/issues/23/"),
            (
                "org2",
                42,
                {"environment": "dev"},
                "http://testserver/organizations/org2/issues/42/?environment=dev",
            ),
            (
                "\u00f6rg3",
                86,
                {"env\u00edronment": "d\u00e9v"},
                "http://testserver/organizations/org3/issues/86/?env%C3%ADronment=d%C3%A9v",
            ),
        ]:
            org = self.create_organization(slug=org_slug)
            project = self.create_project(organization=org)
            group = self.create_group(id=group_id, project=project)
            actual = group.get_absolute_url(params)
            assert actual == expected

    def test_get_absolute_url_feedback(self) -> None:
        org_slug = "org1"
        org = self.create_organization(slug=org_slug)
        project = self.create_project(organization=org)
        group_id = 23
        params = None
        expected = f"http://testserver/organizations/org1/feedback/?feedbackSlug={project.slug}%3A23&project={project.id}"

        group = self.create_group(id=group_id, project=project, type=FeedbackGroup.type_id)
        actual = group.get_absolute_url(params)
        assert actual == expected

    def test_get_absolute_url_event(self) -> None:
        project = self.create_project()
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": self.min_ago}, project_id=project.id
        )
        group = event.group
        url = f"http://testserver/organizations/{project.organization.slug}/issues/{group.id}/events/{event.event_id}/"
        assert url == group.get_absolute_url(event_id=event.event_id)

    @with_feature("system:multi-region")
    def test_get_absolute_url_customer_domains(self) -> None:
        project = self.create_project()
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": self.min_ago}, project_id=project.id
        )
        org = self.organization
        group = event.group
        expected = f"http://{org.slug}.testserver/issues/{group.id}/events/{event.event_id}/"
        assert expected == group.get_absolute_url(event_id=event.event_id)

        expected = f"http://{org.slug}.testserver/issues/{group.id}/"
        assert expected == group.get_absolute_url()

    def test_get_absolute_api_url(self) -> None:
        project = self.create_project()
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": self.min_ago}, project_id=project.id
        )
        org = self.organization
        group = event.group

        assert (
            group.get_absolute_api_url()
            == f"http://testserver/api/0/organizations/{org.slug}/issues/{group.id}/"
        )

    def test_get_releases(self) -> None:
        now = timezone.now().replace(microsecond=0)
        project = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project)

        last_release = Release.objects.create(
            organization_id=self.organization.id,
            version="100",
            date_added=now - timedelta(seconds=10),
        )
        first_release = Release.objects.create(
            organization_id=self.organization.id,
            version="200",
            date_added=now - timedelta(seconds=100),
        )
        GroupRelease.objects.create(
            project_id=project.id,
            group_id=group.id,
            release_id=first_release.id,
            environment="",
            last_seen=first_release.date_added,
            first_seen=first_release.date_added,
        )

        GroupRelease.objects.create(
            project_id=project.id,
            group_id=group.id,
            release_id=last_release.id,
            environment="",
            last_seen=last_release.date_added,
            first_seen=last_release.date_added,
        )

        assert group.get_first_release() == "200"
        cache.delete(_get_cache_key(group2.id, group2.project_id, True))

        assert group2.get_first_release() is None
        cache.delete(_get_cache_key(group.id, group.project_id, True))

        assert group.get_last_release() == "100"

        assert group2.get_last_release() is None

    @patch("sentry.models.group.logger.error")
    def test_group_substatus_defaults(self, mock_logger: MagicMock) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        assert group.substatus is None
        assert mock_logger.call_count == 1

        for nullable_status in (
            GroupStatus.IGNORED,
            GroupStatus.MUTED,
            GroupStatus.RESOLVED,
            GroupStatus.PENDING_DELETION,
            GroupStatus.DELETION_IN_PROGRESS,
            GroupStatus.REPROCESSING,
        ):
            assert self.create_group(status=nullable_status).substatus is None

    def test_group_valid_substatus(self) -> None:
        desired_status_substatus_pairs = [
            (GroupStatus.UNRESOLVED, GroupSubStatus.ESCALATING),
            (GroupStatus.UNRESOLVED, GroupSubStatus.REGRESSED),
            (GroupStatus.UNRESOLVED, GroupSubStatus.NEW),
            (GroupStatus.IGNORED, GroupSubStatus.FOREVER),
            (GroupStatus.IGNORED, GroupSubStatus.UNTIL_CONDITION_MET),
            (GroupStatus.IGNORED, GroupSubStatus.UNTIL_ESCALATING),
        ]
        for status, substatus in desired_status_substatus_pairs:
            group = self.create_group(status=status, substatus=substatus)
            assert group.substatus is substatus


class GroupIsOverResolveAgeTest(TestCase):
    def test_simple(self) -> None:
        group = self.group
        group.last_seen = timezone.now() - timedelta(hours=2)
        group.project.update_option("sentry:resolve_age", 1)  # 1 hour
        assert group.is_over_resolve_age() is True
        group.last_seen = timezone.now()
        assert group.is_over_resolve_age() is False

    def test_respects_enable_auto_resolve_flag(self) -> None:
        # Create a group and make it old enough to auto-resolve
        group = self.group
        group.last_seen = timezone.now() - timedelta(hours=2)
        group.project.update_option("sentry:resolve_age", 1)  # 1 hour

        # Test with a group type that has auto-resolve enabled
        group.type = ReplayHydrationErrorType.type_id
        group.save()

        # Verify it would be auto-resolved
        assert group.is_over_resolve_age() is True
        assert group.get_status() == GroupStatus.RESOLVED

        # Test with a group type that has auto-resolve disabled
        group.type = FeedbackGroup.type_id
        group.status = GroupStatus.UNRESOLVED  # Reset status
        group.save()

        # Verify it would NOT be auto-resolved, even though is_over_resolve_age is True
        assert group.is_over_resolve_age() is True
        assert group.get_status() == GroupStatus.UNRESOLVED


class GroupGetLatestEventTest(TestCase, OccurrenceTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1).isoformat()
        self.two_min_ago = before_now(minutes=2).isoformat()
        self.just_over_one_min_ago = before_now(seconds=61).isoformat()

    def test_get_latest_event_no_events(self) -> None:
        project = self.create_project()
        group = self.create_group(project=project)
        assert group.get_latest_event() is None

    def test_get_latest_event(self) -> None:
        self.store_event(
            data={"event_id": "a" * 32, "fingerprint": ["group-1"], "timestamp": self.two_min_ago},
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "fingerprint": ["group-1"], "timestamp": self.min_ago},
            project_id=self.project.id,
        )

        group = Group.objects.get()

        group_event = group.get_latest_event()
        assert group_event is not None

        assert group_event.event_id == "b" * 32
        assert group_event.occurrence is None

    def test_get_latest_almost_identical_timestamps(self) -> None:
        self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["group-1"],
                "timestamp": self.just_over_one_min_ago,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "fingerprint": ["group-1"], "timestamp": self.min_ago},
            project_id=self.project.id,
        )
        group = Group.objects.get()

        group_event = group.get_latest_event()
        assert group_event is not None

        assert group_event.event_id == "b" * 32
        assert group_event.occurrence is None

    def test_get_latest_event_occurrence(self) -> None:
        event_id = uuid.uuid4().hex
        occurrence, _ = self.process_occurrence(
            project_id=self.project.id,
            event_id=event_id,
            event_data={
                "fingerprint": ["group-1"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
        )

        group = Group.objects.get()
        group.update(type=ProfileFileIOGroupType.type_id)

        group_event = group.get_latest_event()
        assert group_event is not None
        assert group_event.event_id == event_id
        self.assert_occurrences_identical(group_event.occurrence, occurrence)


class GroupReplaysCacheTest(SnubaTestCase, ReplaysSnubaTestCase):
    def test_simple(self) -> None:
        replay1_id = "46eb3948be25448abd53fe36b5891ff2"
        self.project.flags.has_replays = True
        self.project.save()
        self.store_event(
            data={
                "message": "Hello world",
                "level": "error",
                "contexts": {"replay": {"replay_id": replay1_id}},
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )

        self.store_replays(
            mock_replay(
                datetime.now() - timedelta(minutes=60),
                self.project.id,
                replay1_id,
            )
        )
        group = Group.objects.get()
        assert group.has_replays() is True

        # test caching
        with mock.patch(
            "sentry.models.group.metrics.incr",
        ) as incr:
            assert group.has_replays() is True
            incr.assert_any_call(
                "group.has_replays.cached",
                tags={
                    "has_replays": True,
                },
            )

    def test_no_replay_project(self) -> None:
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )
        group = event.group
        assert group.has_replays() is False

    def test_no_replay_on_issue(self) -> None:
        self.project.flags.has_replays = True
        self.project.save()

        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )

        group = event.group
        assert group.has_replays() is False

        # test caching
        with mock.patch(
            "sentry.models.group.metrics.incr",
        ) as incr:
            assert group.has_replays() is False
            incr.assert_any_call(
                "group.has_replays.cached",
                tags={
                    "has_replays": False,
                },
            )

    def test_has_replays_rate_limit_exceeded(self) -> None:
        """Test that has_replays gracefully handles rate limit exceptions."""
        from sentry.utils.snuba import RateLimitExceeded

        self.project.flags.has_replays = True
        self.project.save()

        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )

        group = event.group

        # Mock get_replay_counts to raise RateLimitExceeded
        with mock.patch(
            "sentry.replays.usecases.replay_counts.get_replay_counts",
            side_effect=RateLimitExceeded("Rate limit exceeded"),
        ):
            # Ensure metrics are tracked
            with mock.patch("sentry.models.group.metrics.incr") as incr:
                # Should return False instead of raising exception
                assert group.has_replays() is False

                # Verify rate limit metric was incremented
                incr.assert_any_call("group.has_replays.rate_limit_exceeded")

            # Verify logging occurred
            with mock.patch("sentry.models.group.logger.warning") as warning:
                # Clear cache to force another query
                cache.delete(f"group:has_replays:{group.id}")

                with mock.patch(
                    "sentry.replays.usecases.replay_counts.get_replay_counts",
                    side_effect=RateLimitExceeded("Rate limit exceeded"),
                ):
                    assert group.has_replays() is False

                    # Verify warning was logged with proper context
                    warning.assert_called_once()
                    call_args = warning.call_args
                    assert call_args[0][0] == "Rate limit exceeded when checking for replays"
                    assert call_args[1]["extra"]["group_id"] == group.id
                    assert call_args[1]["extra"]["project_id"] == self.project.id

    def test_update_group_status_with_custom_update_date(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        custom_datetime = timezone.now() + timedelta(hours=1)

        Group.objects.update_group_status(
            groups=[group],
            status=GroupStatus.RESOLVED,
            substatus=None,
            activity_type=ActivityType.SET_RESOLVED,
            update_date=custom_datetime,
        )

        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        assert group.resolved_at == custom_datetime

        activity = Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED.value
        ).first()
        assert activity is not None
        assert activity.datetime == custom_datetime

        open_period = GroupOpenPeriod.objects.get(group=group)
        assert open_period.date_ended == custom_datetime

    def test_update_group_status_without_custom_update_date(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        before = timezone.now()

        Group.objects.update_group_status(
            groups=[group],
            status=GroupStatus.RESOLVED,
            substatus=None,
            activity_type=ActivityType.SET_RESOLVED,
        )

        after = timezone.now()
        group.refresh_from_db()

        assert group.status == GroupStatus.RESOLVED
        assert before <= group.resolved_at <= after

        activity = Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED.value
        ).first()
        assert activity is not None
        assert before <= activity.datetime <= after
