from datetime import timedelta
from unittest import mock

from django.test import override_settings
from django.utils import timezone

from sentry import buffer, tsdb
from sentry.buffer.redis import RedisBuffer
from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.models.activity import Activity
from sentry.models.apikey import ApiKey
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.grouphash import GroupHash
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupseen import GroupSeen
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.grouptombstone import GroupTombstone
from sentry.models.release import Release
from sentry.notifications.types import GroupSubscriptionReason
from sentry.plugins.base import plugins
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


@region_silo_test
class GroupDetailsTest(APITestCase, SnubaTestCase):
    def test_with_numerical_id(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)

        url = f"/api/0/organizations/{group.organization.slug}/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)

    def test_with_qualified_short_id(self):
        self.login_as(user=self.user)

        group = self.create_group()
        assert group.qualified_short_id

        url = f"/api/0/organizations/{group.organization.slug}/issues/{group.qualified_short_id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)

        url = f"/api/0/issues/{group.qualified_short_id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    def test_with_first_release(self):
        self.login_as(user=self.user)

        event = self.store_event(data={"release": "1.0"}, project_id=self.project.id)

        group = event.group

        url = f"/api/0/issues/{group.id}/"

        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.0"

    def test_no_releases(self):
        self.login_as(user=self.user)

        event = self.store_event(data={}, project_id=self.project.id)

        group = event.group

        url = f"/api/0/issues/{group.id}/"

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["firstRelease"] is None
        assert response.data["lastRelease"] is None

    def test_pending_delete_pending_merge_excluded(self):
        group1 = self.create_group(status=GroupStatus.PENDING_DELETION)
        group2 = self.create_group(status=GroupStatus.DELETION_IN_PROGRESS)

        group3 = self.create_group(status=GroupStatus.PENDING_MERGE)

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group1.id}/"

        response = self.client.get(url, format="json")
        assert response.status_code == 404

        url = f"/api/0/issues/{group2.id}/"
        response = self.client.get(url, format="json")
        assert response.status_code == 404

        url = f"/api/0/issues/{group3.id}/"
        response = self.client.get(url, format="json")
        assert response.status_code == 404

    def test_environment(self):
        group = self.create_group()
        self.login_as(user=self.user)

        environment = Environment.get_or_create(group.project, "production")

        url = f"/api/0/issues/{group.id}/"

        with mock.patch(
            "sentry.tsdb.backend.get_range", side_effect=tsdb.backend.get_range
        ) as get_range:
            response = self.client.get(url, {"environment": "production"}, format="json")
            assert response.status_code == 200
            assert get_range.call_count == 2
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id]

        response = self.client.get(url, {"environment": "invalid"}, format="json")
        assert response.status_code == 404

    def test_platform_external_issue_annotation(self):
        self.login_as(user=self.user)

        group = self.create_group()
        self.create_platform_external_issue(
            group=group,
            service_type="sentry-app",
            web_url="https://example.com/issues/2",
            display_name="Issue#2",
        )
        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.data["annotations"] == [
            '<a href="https://example.com/issues/2">Issue#2</a>'
        ]

    def test_plugin_external_issue_annotation(self):
        group = self.create_group()
        GroupMeta.objects.create(group=group, key="trello:tid", value="134")

        plugins.get("trello").enable(group.project)
        plugins.get("trello").set_option("key", "some_value", group.project)
        plugins.get("trello").set_option("token", "another_value", group.project)

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.data["annotations"] == ['<a href="https://trello.com/c/134">Trello-134</a>']

    def test_integration_external_issue_annotation(self):
        group = self.create_group()
        integration = self.create_integration(
            organization=group.organization,
            provider="jira",
            external_id="some_id",
            name="Hello world",
            metadata={"base_url": "https://example.com"},
        )
        self.create_integration_external_issue(group=group, integration=integration, key="api-123")

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.data["annotations"] == [
            '<a href="https://example.com/browse/api-123">api-123</a>'
        ]

    def test_permalink_superuser(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        group = self.create_group()
        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        result = response.data["permalink"]
        assert "http://" in result
        assert f"{group.organization.slug}/issues/{group.id}" in result

    def test_permalink_sentry_app_installation_token(self):
        project = self.create_project(organization=self.organization, teams=[self.team])
        internal_app = self.create_internal_integration(
            name="Internal app",
            organization=self.organization,
            scopes=("project:read", "org:read", "event:write"),
        )
        token = internal_app.installations.first().api_token

        group = self.create_group(project=project)
        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token}", format="json")
        result = response.data["permalink"]
        assert "http://" in result
        assert f"{group.organization.slug}/issues/{group.id}" in result

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_ratelimit(self):
        self.login_as(user=self.user)
        group = self.create_group()
        url = f"/api/0/issues/{group.id}/"
        with freeze_time("2000-01-01"):
            for i in range(5):
                self.client.get(url, sort_by="date", limit=1)
            response = self.client.get(url, sort_by="date", limit=1)
            assert response.status_code == 429

    def test_with_deleted_user_activity(self):
        self.login_as(user=self.user)
        user = self.create_user("foo@example.com")

        group = self.create_group()
        Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.NOTE.value,
            user_id=user.id,
            data={"text": "This is bad"},
            datetime=timezone.now(),
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            user.delete()

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content

    def test_collapse_tags(self):
        self.login_as(user=self.user)
        group = self.create_group()
        url = f"/api/0/issues/{group.id}/"

        # Without collapse param, tags should be present
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["tags"] == []

        # With collapse param, tags should not be present
        response = self.client.get(url, {"collapse": ["tags"]})
        assert "tags" not in response.data

    def test_count_with_buffer(self):
        """Test that group count includes the count from the buffer."""
        self.login_as(user=self.user)

        redis_buffer = RedisBuffer()
        with mock.patch("sentry.buffer.backend.get", redis_buffer.get), mock.patch(
            "sentry.buffer.backend.incr", redis_buffer.incr
        ):
            event = self.store_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            group = event.group
            event.group.update(times_seen=1)
            buffer.backend.incr(Group, {"times_seen": 15}, filters={"id": event.group.id})

            url = f"/api/0/issues/{group.id}/"
            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert response.data["id"] == str(group.id)
            assert response.data["count"] == "16"

            url = f"/api/0/organizations/{group.organization.slug}/issues/{group.id}/"
            response = self.client.get(url, format="json")

            assert response.status_code == 200, response.content
            assert response.data["id"] == str(group.id)
            assert response.data["count"] == "16"


@region_silo_test
class GroupUpdateTest(APITestCase):
    def test_resolve(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200, response.content

        group = Group.objects.get(id=group.id, project=group.project.id)
        assert group.status == GroupStatus.RESOLVED

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

    def test_resolved_in_next_release(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project.flags.has_releases = True
        project.save()
        group = self.create_group(project=project)
        Release.get_or_create(version="abcd", project=project)

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"status": "resolvedInNextRelease"})
        assert response.status_code == 200, response.content

        group = Group.objects.get(id=group.id, project=group.project.id)
        assert group.status == GroupStatus.RESOLVED

        assert GroupResolution.objects.filter(group=group).exists()

    def test_snooze_duration(self):
        group = self.create_group(status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(
            url, data={"status": "ignored", "ignoreDuration": 30}, format="json"
        )

        assert response.status_code == 200

        snooze = GroupSnooze.objects.get(group=group)

        assert snooze.until is not None
        assert snooze.until > timezone.now() + timedelta(minutes=29)
        assert snooze.until < timezone.now() + timedelta(minutes=31)

        assert response.data["statusDetails"]["ignoreUntil"] == snooze.until

        group = Group.objects.get(id=group.id)
        assert group.get_status() == GroupStatus.IGNORED

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

    def test_bookmark(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"isBookmarked": "1"}, format="json")

        assert response.status_code == 200, response.content

        # ensure we've created the bookmark
        assert GroupBookmark.objects.filter(group=group, user_id=self.user.id).exists()

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

    def test_assign_username(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"assignedTo": self.user.username}, format="json")

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user_id=self.user.id).exists()

        assert (
            Activity.objects.filter(
                group=group, user_id=self.user.id, type=ActivityType.ASSIGNED.value
            ).count()
            == 1
        )

        response = self.client.put(url, format="json")

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user_id=self.user.id).exists()

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        response = self.client.put(url, data={"assignedTo": ""}, format="json")

        assert response.status_code == 200, response.content

        assert not GroupAssignee.objects.filter(group=group, user_id=self.user.id).exists()

    def test_assign_id(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"assignedTo": self.user.id}, format="json")

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user_id=self.user.id).exists()

        assert (
            Activity.objects.filter(
                group=group, user_id=self.user.id, type=ActivityType.ASSIGNED.value
            ).count()
            == 1
        )

        response = self.client.put(url, format="json")

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, user_id=self.user.id).exists()

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        response = self.client.put(url, data={"assignedTo": ""}, format="json")

        assert response.status_code == 200, response.content

        assert not GroupAssignee.objects.filter(group=group, user_id=self.user.id).exists()

    def test_assign_id_via_api_key(self):
        # XXX: This test is written to verify that using api keys works when
        # hitting an endpoint that uses `client.{get,put,post}` to redirect to
        # another endpoint. This catches a regression that happened when
        # migrating to DRF 3.x.
        with assume_test_silo_mode(SiloMode.CONTROL):
            api_key = ApiKey.objects.create(
                organization_id=self.organization.id, scope_list=["event:write"]
            )
        group = self.create_group()
        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(
            url,
            data={"assignedTo": self.user.id},
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )
        assert response.status_code == 200, response.content
        assert GroupAssignee.objects.filter(group=group, user_id=self.user.id).exists()

    def test_assign_team(self):
        self.login_as(user=self.user)

        group = self.create_group()
        team = self.create_team(organization=group.project.organization, members=[self.user])
        group.project.add_team(team)

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"assignedTo": f"team:{team.id}"}, format="json")

        assert response.status_code == 200, response.content

        assert GroupAssignee.objects.filter(group=group, team=team).exists()

        assert Activity.objects.filter(group=group, type=ActivityType.ASSIGNED.value).count() == 1

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        response = self.client.put(url, data={"assignedTo": ""}, format="json")

        assert response.status_code == 200, response.content

        assert Activity.objects.filter(group=group).count() == 2

        assert not GroupAssignee.objects.filter(group=group, team=team).exists()

    def test_assign_unavailable_team(self):
        self.login_as(user=self.user)

        group = self.create_group()
        team = self.create_team(organization=group.project.organization, members=[self.user])

        url = f"/api/0/issues/{group.id}/"
        response = self.client.put(url, data={"assignedTo": f"team:{team.id}"}, format="json")

        assert response.status_code == 400, response.content

    def test_mark_seen(self):
        self.login_as(user=self.user)

        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"hasSeen": "1"}, format="json")

        assert response.status_code == 200, response.content

        assert GroupSeen.objects.filter(group=group, user_id=self.user.id).exists()

        response = self.client.put(url, data={"hasSeen": "0"}, format="json")

        assert response.status_code == 200, response.content

        assert not GroupSeen.objects.filter(group=group, user_id=self.user.id).exists()

    def test_mark_seen_as_non_member(self):
        user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(user=user, superuser=True)

        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"

        response = self.client.put(url, data={"hasSeen": "1"}, format="json")

        assert response.status_code == 200, response.content

        assert not GroupSeen.objects.filter(group=group, user_id=self.user.id).exists()

    def test_subscription(self):
        self.login_as(user=self.user)
        group = self.create_group()

        url = f"/api/0/issues/{group.id}/"

        resp = self.client.put(url, data={"isSubscribed": "true"})
        assert resp.status_code == 200, resp.content
        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        resp = self.client.put(url, data={"isSubscribed": "false"})
        assert resp.status_code == 200, resp.content
        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=False
        ).exists()

    @with_feature("organizations:team-workflow-notifications")
    def test_team_subscription(self):
        group = self.create_group()
        team = self.create_team(organization=group.project.organization, members=[self.user])

        # subscribe the team
        GroupSubscription.objects.create(
            team=team,
            group=group,
            project=group.project,
            is_active=True,
            reason=GroupSubscriptionReason.team_mentioned,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data["participants"]) == 1
        assert response.data["participants"][0]["type"] == "team"

        # add the user as a subscriber
        GroupSubscription.objects.create(
            user_id=self.user.id,
            group=group,
            project=group.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        response = self.client.get(url)
        assert response.status_code == 200

        # both the user and their team should be subscribed separately
        assert len(response.data["participants"]) == 2
        assert (
            response.data["participants"][0]["type"] == "user"
        )  # user participants are processed first
        assert response.data["participants"][1]["type"] == "team"

    def test_discard(self):
        self.login_as(user=self.user)
        group = self.create_group()

        group_hash = GroupHash.objects.create(hash="x" * 32, project=group.project, group=group)

        url = f"/api/0/issues/{group.id}/"

        with self.tasks():
            with self.feature("projects:discard-groups"):
                resp = self.client.put(url, data={"discard": True})

        assert resp.status_code == 204
        assert not Group.objects.filter(id=group.id).exists()
        assert GroupHash.objects.filter(id=group_hash.id).exists()
        tombstone = GroupTombstone.objects.get(
            id=GroupHash.objects.get(id=group_hash.id).group_tombstone_id
        )
        assert tombstone.message == group.message
        assert tombstone.culprit == group.culprit
        assert tombstone.project == group.project
        assert tombstone.data == group.data

    def test_discard_performance_issue(self):
        self.login_as(user=self.user)
        group = self.create_group(type=PerformanceSlowDBQueryGroupType.type_id)
        GroupHash.objects.create(hash="x" * 32, project=group.project, group=group)

        url = f"/api/0/issues/{group.id}/"

        with self.tasks():
            with self.feature("projects:discard-groups"):
                response = self.client.put(url, data={"discard": True})

        assert response.status_code == 400, response.content

        # Ensure it's still there
        assert Group.objects.filter(id=group.id).exists()
        assert GroupHash.objects.filter(group_id=group.id).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_ratelimit(self):
        self.login_as(user=self.user)
        group = self.create_group()
        url = f"/api/0/issues/{group.id}/"
        with freeze_time("2000-01-01"):
            for i in range(10):
                self.client.put(url, sort_by="date", limit=1)
            response = self.client.put(url, sort_by="date", limit=1)
            assert response.status_code == 429


@region_silo_test
class GroupDeleteTest(APITestCase):
    def test_delete(self):
        self.login_as(user=self.user)

        group = self.create_group()
        hash = "x" * 32
        GroupHash.objects.create(project=group.project, hash=hash, group=group)

        url = f"/api/0/issues/{group.id}/"

        response = self.client.delete(url, format="json")
        assert response.status_code == 202, response.content

        # Deletion was deferred, so it should still exist
        assert Group.objects.get(id=group.id).status == GroupStatus.PENDING_DELETION
        # BUT the hash should be gone
        assert not GroupHash.objects.filter(group_id=group.id).exists()

        Group.objects.filter(id=group.id).update(status=GroupStatus.UNRESOLVED)

        url = f"/api/0/issues/{group.id}/"

        with self.tasks():
            response = self.client.delete(url, format="json")

        assert response.status_code == 202, response.content

        # Now we killed everything with fire
        assert not Group.objects.filter(id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()

    def test_delete_performance_issue(self):
        """Test that a performance issue cannot be deleted"""
        self.login_as(user=self.user)

        group = self.create_group(type=PerformanceSlowDBQueryGroupType.type_id)
        GroupHash.objects.create(project=group.project, hash="x" * 32, group=group)

        url = f"/api/0/issues/{group.id}/"

        response = self.client.delete(url, format="json")
        assert response.status_code == 400, response.content

        # Ensure it's still there
        assert Group.objects.filter(id=group.id).exists()
        assert GroupHash.objects.filter(group_id=group.id).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_ratelimit(self):
        self.login_as(user=self.user)
        group = self.create_group()
        url = f"/api/0/issues/{group.id}/"
        with freeze_time("2000-01-01"):
            for i in range(10):
                self.client.delete(url, sort_by="date", limit=1)
            response = self.client.delete(url, sort_by="date", limit=1)
            assert response.status_code == 429

    def test_collapse_release(self):
        self.login_as(user=self.user)
        group = self.create_group()
        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["firstRelease"] is None
        response = self.client.get(url, {"collapse": ["release"]})
        assert "firstRelease" not in response.data
