from __future__ import annotations

import time
from collections.abc import Sequence
from datetime import timedelta
from functools import cached_property
from unittest.mock import Mock, call, patch
from urllib.parse import quote
from uuid import uuid4

from django.conf import settings
from django.utils import timezone

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.models.activity import Activity
from sentry.models.apitoken import ApiToken
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.grouphash import GroupHash
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.grouptombstone import GroupTombstone
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import Feature, parse_link_header, with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.users.models.user_option import UserOption
from sentry.utils import json


class GroupListTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def _parse_links(self, header):
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {}
        for url, attrs in parse_link_header(header).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url
        return links

    @cached_property
    def path(self):
        return f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/"

    def test_sort_by_date_with_tag(self):
        # XXX(dcramer): this tests a case where an ambiguous column name existed
        group1 = self.create_group(last_seen=before_now(seconds=1))
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group1.id)

    def test_invalid_query(self):
        self.create_group(last_seen=before_now(seconds=1))
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?sort_by=date&query=timesSeen:>1t", format="json")
        assert response.status_code == 400
        assert "Error parsing search query" in response.data["detail"]

    def test_simple_pagination(self):
        event1 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group-1"],
                "timestamp": iso_format(self.min_ago - timedelta(seconds=2)),
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group-2"],
                "timestamp": iso_format(self.min_ago - timedelta(seconds=1)),
            },
            project_id=self.project.id,
        )
        self.login_as(user=self.user)
        response = self.client.get(f"{self.path}?sort_by=date&limit=1", format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event2.group.id)

        links = self._parse_links(response["Link"])

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event1.group.id)

        links = self._parse_links(response["Link"])

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

    def test_stats_period(self):
        # TODO(dcramer): this test really only checks if validation happens
        # on statsPeriod
        self.create_group(last_seen=before_now(seconds=1))
        self.create_group(last_seen=timezone.now())

        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?statsPeriod=24h", format="json")
        assert response.status_code == 200

        response = self.client.get(f"{self.path}?statsPeriod=14d", format="json")
        assert response.status_code == 200

        response = self.client.get(f"{self.path}?statsPeriod=", format="json")
        assert response.status_code == 200

        time.sleep(1)
        response = self.client.get(f"{self.path}?statsPeriod=48h", format="json")
        assert response.status_code == 400

    def test_environment(self):
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": iso_format(self.min_ago),
                "environment": "production",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": iso_format(self.min_ago),
                "environment": "staging",
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        response = self.client.get(self.path + "?environment=production", format="json")
        assert response.status_code == 200
        assert len(response.data) == 1

        response = self.client.get(self.path + "?environment=garbage", format="json")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_auto_resolved(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        self.create_group(last_seen=before_now(days=1))
        group2 = self.create_group(last_seen=timezone.now())

        self.login_as(user=self.user)
        response = self.client.get(self.path + "?query=is:unresolved", format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group2.id)

    def test_lookup_by_event_id(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        event_id = "c" * 32
        event = self.store_event(
            data={"event_id": event_id, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        response = self.client.get("{}?query={}".format(self.path, "c" * 32), format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event.event_id

    def test_lookup_by_event_with_matching_environment(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        self.create_environment(name="test", project=project)

        event = self.store_event(
            data={"environment": "test", "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        response = self.client.get(
            f"{self.path}?query={event.event_id}&environment=test", format="json"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event.event_id
        assert response.data[0]["matchingEventEnvironment"] == "test"

    def test_lookup_by_event_id_with_whitespace(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        event = self.store_event(
            data={"event_id": "c" * 32, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)
        response = self.client.get(
            "{}?query=%20%20{}%20%20".format(self.path, "c" * 32), format="json"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)

    def test_lookup_by_unknown_event_id(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        self.create_group()
        self.create_group()

        self.login_as(user=self.user)
        response = self.client.get("{}?query={}".format(self.path, "c" * 32), format="json")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_lookup_by_short_id(self):
        group = self.group
        short_id = group.qualified_short_id

        self.login_as(user=self.user)
        response = self.client.get(f"{self.path}?query={short_id}&shortIdLookup=1", format="json")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_lookup_by_short_id_no_perms(self):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        project2 = self.create_project(organization=organization)
        team = self.create_team(organization=organization)
        project2.add_team(team)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(organization=organization, user=user, teams=[team])

        short_id = group.qualified_short_id

        self.login_as(user=user)

        path = f"/api/0/projects/{organization.slug}/{project2.slug}/issues/"
        response = self.client.get(f"{path}?query={short_id}&shortIdLookup=1", format="json")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_lookup_by_first_release(self):
        self.login_as(self.user)
        project = self.project
        project2 = self.create_project(name="baz", organization=project.organization)
        release = Release.objects.create(organization=project.organization, version="12345")
        release.add_project(project)
        release.add_project(project2)
        group = self.store_event(
            data={"release": release.version, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        ).group
        self.store_event(
            data={"release": release.version, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project2.id,
        )
        url = "{}?query={}".format(self.path, 'first-release:"%s"' % release.version)
        response = self.client.get(url, format="json")
        issues = json.loads(response.content)
        assert response.status_code == 200
        assert len(issues) == 1
        assert int(issues[0]["id"]) == group.id

    def test_lookup_by_release(self):
        self.login_as(self.user)
        version = "12345"
        event = self.store_event(
            data={"tags": {"sentry:release": version}}, project_id=self.project.id
        )
        group = event.group
        url = "{}?query={}".format(self.path, quote('release:"%s"' % version))
        response = self.client.get(url, format="json")
        issues = json.loads(response.content)
        assert response.status_code == 200
        assert len(issues) == 1
        assert int(issues[0]["id"]) == group.id

    def test_lookup_by_release_wildcard(self):
        self.login_as(self.user)
        version = "12345"
        event = self.store_event(
            data={"tags": {"sentry:release": version}}, project_id=self.project.id
        )
        group = event.group
        release_wildcard = version[:3] + "*"
        url = "{}?query={}".format(self.path, quote('release:"%s"' % release_wildcard))
        response = self.client.get(url, format="json")
        issues = json.loads(response.content)
        assert response.status_code == 200
        assert len(issues) == 1
        assert int(issues[0]["id"]) == group.id

    def test_pending_delete_pending_merge_excluded(self):
        self.create_group(status=GroupStatus.PENDING_DELETION)
        group = self.create_group()
        self.create_group(status=GroupStatus.DELETION_IN_PROGRESS)
        self.create_group(status=GroupStatus.PENDING_MERGE)

        self.login_as(user=self.user)

        response = self.client.get(self.path + "?query=is:unresolved", format="json")
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group.id)

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        self.create_group(last_seen=timezone.now() - timedelta(days=2))

        with self.options({"system.event-retention-days": 1}):
            response = self.client.get(self.path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_token_auth(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scopes=256)
        response = self.client.get(
            self.path, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}"
        )
        assert response.status_code == 200, response.content

    def test_filter_not_unresolved(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event.group.update(status=GroupStatus.RESOLVED, substatus=None)
        self.login_as(user=self.user)
        response = self.client.get(f"{self.path}?query=!is:unresolved", format="json")
        assert response.status_code == 200
        assert [int(r["id"]) for r in response.data] == [event.group.id]

    def test_single_group_by_hash(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?hashes={event.get_primary_hash()}")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

    def test_multiple_groups_by_hashes(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=400)), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        response = self.client.get(
            f"{self.path}?hashes={event.get_primary_hash()}&hashes={event2.get_primary_hash()}"
        )
        assert response.status_code == 200
        assert len(response.data) == 2

        response_group_ids = [int(group["id"]) for group in response.data]
        assert event.group.id in response_group_ids
        assert event2.group.id in response_group_ids


class GroupUpdateTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    @cached_property
    def path(self):
        return f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/"

    def assertNoResolution(self, group):
        assert not GroupResolution.objects.filter(group=group).exists()

    def test_global_resolve(self):
        group1 = self.create_group(status=GroupStatus.RESOLVED)
        group2 = self.create_group(status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        response = self.client.put(
            f"{self.path}?status=unresolved&query=is:unresolved",
            data={"status": "resolved"},
            format="json",
        )
        assert response.status_code == 200, response.data
        assert response.data == {"status": "resolved", "statusDetails": {}, "inbox": None}

        # the previously resolved entry should not be included
        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.status == GroupStatus.RESOLVED
        assert new_group1.resolved_at is None

        # this wont exist because it wasn't affected
        assert not GroupSubscription.objects.filter(user_id=self.user.id, group=new_group1).exists()

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.status == GroupStatus.RESOLVED
        assert new_group2.resolved_at is not None

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=new_group2, is_active=True
        ).exists()

        # the ignored entry should not be included
        new_group3 = Group.objects.get(id=group3.id)
        assert new_group3.status == GroupStatus.IGNORED
        assert new_group3.resolved_at is None

        assert not GroupSubscription.objects.filter(user_id=self.user.id, group=new_group3)

        new_group4 = Group.objects.get(id=group4.id)
        assert new_group4.status == GroupStatus.UNRESOLVED
        assert new_group4.resolved_at is None

        assert not GroupSubscription.objects.filter(user_id=self.user.id, group=new_group4)

    def test_bulk_resolve(self):
        self.login_as(user=self.user)

        for i in range(200):
            self.create_group(status=GroupStatus.UNRESOLVED)

        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")

        assert len(response.data) == 100

        response = self.client.put(
            f"{self.path}?status=unresolved&query=is:unresolved",
            data={"status": "resolved"},
            format="json",
        )
        assert response.status_code == 200, response.data

        assert response.data == {"status": "resolved", "statusDetails": {}, "inbox": None}
        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")

        assert len(response.data) == 0

    @patch("sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound")
    def test_resolve_with_integration(self, mock_sync_status_outbound):
        self.login_as(user=self.user)

        org = self.organization

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", name="Example")
            integration.add_organization(org, self.user)
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        with assume_test_silo_mode(SiloMode.CONTROL):
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

        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")

        assert len(response.data) == 1

        with self.tasks():
            with self.feature({"organizations:integrations-issue-sync": True}):
                response = self.client.put(
                    f"{self.path}?status=unresolved&query=is:unresolved",
                    data={"status": "resolved"},
                    format="json",
                )
                assert response.status_code == 200, response.data

                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.RESOLVED

                assert response.data == {"status": "resolved", "statusDetails": {}, "inbox": None}
                mock_sync_status_outbound.assert_called_once_with(
                    external_issue, True, group.project_id
                )

        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")
        assert len(response.data) == 0

    @patch("sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound")
    def test_set_unresolved_with_integration(self, mock_sync_status_outbound):
        release = self.create_release(project=self.project, version="abc")
        group = self.create_group(status=GroupStatus.RESOLVED)
        org = self.organization
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", name="Example")
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
        GroupResolution.objects.create(group=group, release=release)
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

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"

        with self.tasks():
            with self.feature({"organizations:integrations-issue-sync": True}):
                response = self.client.put(url, data={"status": "unresolved"}, format="json")
                assert response.status_code == 200
                assert response.data == {"status": "unresolved", "statusDetails": {}}

                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.UNRESOLVED

                self.assertNoResolution(group)

                assert GroupSubscription.objects.filter(
                    user_id=self.user.id, group=group, is_active=True
                ).exists()
                mock_sync_status_outbound.assert_called_once_with(
                    external_issue, False, group.project_id
                )

    def test_self_assign_issue(self):
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        user = self.user

        with assume_test_silo_mode(SiloMode.CONTROL):
            uo1 = UserOption.objects.create(
                key="self_assign_issue", value="1", project_id=None, user=user
            )

        self.login_as(user=user)
        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "resolved"}, format="json")

        assert response.status_code == 200, response.data
        assert response.data["assignedTo"]["id"] == str(user.id)
        assert response.data["assignedTo"]["type"] == "user"
        assert response.data["status"] == "resolved"

        assert GroupAssignee.objects.filter(group=group, user_id=user.id).exists()

        assert GroupSubscription.objects.filter(
            user_id=user.id, group=group, is_active=True
        ).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            uo1.delete()

    def test_self_assign_issue_next_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        with assume_test_silo_mode(SiloMode.CONTROL):
            uo1 = UserOption.objects.create(
                key="self_assign_issue", value="1", project_id=None, user=self.user
            )

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "resolvedInNextRelease"}, format="json")
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inNextRelease"]
        assert response.data["assignedTo"]["id"] == str(self.user.id)
        assert response.data["assignedTo"]["type"] == "user"

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        assert GroupResolution.objects.filter(group=group, release=release).exists()

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        assert activity.data["version"] == ""
        with assume_test_silo_mode(SiloMode.CONTROL):
            uo1.delete()

    def test_selective_status_update(self):
        group1 = self.create_group(status=GroupStatus.RESOLVED)
        group1.resolved_at = timezone.now()
        group1.save()
        group2 = self.create_group(status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        assert response.data == {"status": "resolved", "statusDetails": {}, "inbox": None}

        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.resolved_at is not None
        assert new_group1.status == GroupStatus.RESOLVED

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.resolved_at is not None
        assert new_group2.status == GroupStatus.RESOLVED

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=new_group2, is_active=True
        ).exists()

        new_group3 = Group.objects.get(id=group3.id)
        assert new_group3.resolved_at is None
        assert new_group3.status == GroupStatus.IGNORED

        new_group4 = Group.objects.get(id=group4.id)
        assert new_group4.resolved_at is None
        assert new_group4.status == GroupStatus.UNRESOLVED

    def test_set_resolved_in_current_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={"status": "resolved", "statusDetails": {"inRelease": "latest"}},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inRelease"] == release.version
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)
        assert "activity" in response.data

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        assert activity.data["version"] == release.version

    def test_set_resolved_in_explicit_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)
        release2 = Release.objects.create(organization_id=self.project.organization_id, version="b")
        release2.add_project(self.project)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={"status": "resolved", "statusDetails": {"inRelease": release.version}},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inRelease"] == release.version
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)
        assert "activity" in response.data

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        assert activity.data["version"] == release.version

    def test_set_resolved_in_next_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={"status": "resolved", "statusDetails": {"inNextRelease": True}},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inNextRelease"]
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)
        assert "activity" in response.data

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_next_release
        assert resolution.status == GroupResolution.Status.pending
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        assert activity.data["version"] == ""

    def test_set_resolved_in_next_release_legacy(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "resolvedInNextRelease"}, format="json")
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inNextRelease"]
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_next_release
        assert resolution.status == GroupResolution.Status.pending
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        assert activity.data["version"] == ""

    @with_feature("organizations:resolve-in-upcoming-release")
    def test_set_resolved_in_upcoming_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={"status": "resolved", "statusDetails": {"inUpcomingRelease": True}},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inUpcomingRelease"]
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)
        assert "activity" in response.data

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_upcoming_release
        assert resolution.status == GroupResolution.Status.pending
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        assert activity.data["version"] == ""

    def test_upcoming_release_flag_validation(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={"status": "resolved", "statusDetails": {"inUpcomingRelease": True}},
            format="json",
        )
        assert response.status_code == 400
        assert (
            response.data["statusDetails"]["inUpcomingRelease"][0]
            == "Your organization does not have access to this feature."
        )

    @with_feature("organizations:resolve-in-upcoming-release")
    def test_upcoming_release_release_validation(self):
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={"status": "resolved", "statusDetails": {"inUpcomingRelease": True}},
            format="json",
        )
        assert response.status_code == 400
        assert (
            response.data["statusDetails"]["inUpcomingRelease"][0]
            == "No release data present in the system."
        )

    def test_set_resolved_in_explicit_commit_unreleased(self):
        repo = self.create_repo(project=self.project, name=self.project.name)
        commit = self.create_commit(project=self.project, repo=repo)
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={
                "status": "resolved",
                "statusDetails": {"inCommit": {"commit": commit.key, "repository": repo.name}},
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inCommit"]["id"] == commit.key
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        link = GroupLink.objects.get(group_id=group.id)
        assert link.linked_type == GroupLink.LinkedType.commit
        assert link.relationship == GroupLink.Relationship.resolves
        assert link.linked_id == commit.id

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=ActivityType.SET_RESOLVED_IN_COMMIT.value)
        assert activity.data["commit"] == commit.id

    def test_set_resolved_in_explicit_commit_released(self):
        release = self.create_release(project=self.project)
        repo = self.create_repo(project=self.project, name=self.project.name)
        commit = self.create_commit(project=self.project, repo=repo, release=release)

        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={
                "status": "resolved",
                "statusDetails": {"inCommit": {"commit": commit.key, "repository": repo.name}},
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "resolved"
        assert response.data["statusDetails"]["inCommit"]["id"] == commit.key
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        link = GroupLink.objects.get(group_id=group.id)
        assert link.project_id == self.project.id
        assert link.linked_type == GroupLink.LinkedType.commit
        assert link.relationship == GroupLink.Relationship.resolves
        assert link.linked_id == commit.id

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=ActivityType.SET_RESOLVED_IN_COMMIT.value)
        assert activity.data["commit"] == commit.id

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved

    def test_set_resolved_in_explicit_commit_missing(self):
        repo = self.create_repo(project=self.project, name=self.project.name)
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url,
            data={
                "status": "resolved",
                "statusDetails": {"inCommit": {"commit": "a" * 40, "repository": repo.name}},
            },
            format="json",
        )
        assert response.status_code == 400
        assert (
            response.data["statusDetails"]["inCommit"]["commit"][0]
            == "Unable to find the given commit."
        )

    def test_set_unresolved(self):
        release = self.create_release(project=self.project, version="abc")
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(group=group, release=release)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "unresolved"}, format="json")
        assert response.status_code == 200
        assert response.data == {"status": "unresolved", "statusDetails": {}}

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

        self.assertNoResolution(group)

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group, is_active=True
        ).exists()

    def test_set_unresolved_on_snooze(self):
        group = self.create_group(status=GroupStatus.IGNORED)

        GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(days=1))

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "unresolved"}, format="json")
        assert response.status_code == 200
        assert response.data == {"status": "unresolved", "statusDetails": {}}

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

    def test_basic_ignore(self):
        group = self.create_group(status=GroupStatus.RESOLVED)

        snooze = GroupSnooze.objects.create(group=group, until=timezone.now())

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "ignored"}, format="json")

        assert response.status_code == 200

        # existing snooze objects should be cleaned up
        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.IGNORED

        assert response.data == {"status": "ignored", "statusDetails": {}, "inbox": None}

    def test_snooze_duration(self):
        group = self.create_group(status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url, data={"status": "ignored", "ignoreDuration": 30}, format="json"
        )

        assert response.status_code == 200

        snooze = GroupSnooze.objects.get(group=group)

        now = timezone.now()

        assert snooze.count is None
        assert snooze.until is not None
        assert snooze.until > now + timedelta(minutes=29)
        assert snooze.until < now + timedelta(minutes=31)
        assert snooze.user_count is None
        assert snooze.user_window is None
        assert snooze.window is None

        assert response.data["status"] == "ignored"
        assert response.data["statusDetails"]["ignoreCount"] == snooze.count
        assert response.data["statusDetails"]["ignoreWindow"] == snooze.window
        assert response.data["statusDetails"]["ignoreUserCount"] == snooze.user_count
        assert response.data["statusDetails"]["ignoreUserWindow"] == snooze.user_window
        assert response.data["statusDetails"]["ignoreUntil"] == snooze.until
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)

    def test_snooze_count(self):
        group = self.create_group(status=GroupStatus.RESOLVED, times_seen=1)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url, data={"status": "ignored", "ignoreCount": 100}, format="json"
        )

        assert response.status_code == 200

        snooze = GroupSnooze.objects.get(group=group)
        assert snooze.count == 100
        assert snooze.until is None
        assert snooze.user_count is None
        assert snooze.user_window is None
        assert snooze.window is None
        assert snooze.state is not None
        assert snooze.state["times_seen"] == 1

        assert response.data["status"] == "ignored"
        assert response.data["statusDetails"]["ignoreCount"] == snooze.count
        assert response.data["statusDetails"]["ignoreWindow"] == snooze.window
        assert response.data["statusDetails"]["ignoreUserCount"] == snooze.user_count
        assert response.data["statusDetails"]["ignoreUserWindow"] == snooze.user_window
        assert response.data["statusDetails"]["ignoreUntil"] == snooze.until
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)

    def test_snooze_user_count(self):
        for i in range(10):
            event = self.store_event(
                data={
                    "fingerprint": ["put-me-in-group-1"],
                    "user": {"id": str(i)},
                    "timestamp": iso_format(self.min_ago + timedelta(seconds=i)),
                },
                project_id=self.project.id,
            )

        group = Group.objects.get(id=event.group.id)
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save()

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url, data={"status": "ignored", "ignoreUserCount": 10}, format="json"
        )

        assert response.status_code == 200

        snooze = GroupSnooze.objects.get(group=group)
        assert snooze.count is None
        assert snooze.until is None
        assert snooze.user_count == 10
        assert snooze.user_window is None
        assert snooze.window is None
        assert snooze.state is not None
        assert snooze.state["users_seen"] == 10

        assert response.data["status"] == "ignored"
        assert response.data["statusDetails"]["ignoreCount"] == snooze.count
        assert response.data["statusDetails"]["ignoreWindow"] == snooze.window
        assert response.data["statusDetails"]["ignoreUserCount"] == snooze.user_count
        assert response.data["statusDetails"]["ignoreUserWindow"] == snooze.user_window
        assert response.data["statusDetails"]["ignoreUntil"] == snooze.until
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)

    def test_set_bookmarked(self):
        group1 = self.create_group(status=GroupStatus.RESOLVED)
        group2 = self.create_group(status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"isBookmarked": "true"}, format="json")
        assert response.status_code == 200
        assert response.data == {"isBookmarked": True}

        bookmark1 = GroupBookmark.objects.filter(group=group1, user_id=self.user.id)
        assert bookmark1.exists()

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group1, is_active=True
        ).exists()

        bookmark2 = GroupBookmark.objects.filter(group=group2, user_id=self.user.id)
        assert bookmark2.exists()

        assert GroupSubscription.objects.filter(
            user_id=self.user.id, group=group2, is_active=True
        ).exists()

        bookmark3 = GroupBookmark.objects.filter(group=group3, user_id=self.user.id)
        assert not bookmark3.exists()

        bookmark4 = GroupBookmark.objects.filter(group=group4, user_id=self.user.id)
        assert not bookmark4.exists()

    def test_subscription(self):
        group1 = self.create_group()
        group2 = self.create_group()
        group3 = self.create_group()
        group4 = self.create_group(project=self.create_project(slug="foo"))

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"isSubscribed": "true"}, format="json")
        assert response.status_code == 200
        assert response.data == {"isSubscribed": True, "subscriptionDetails": {"reason": "unknown"}}

        assert GroupSubscription.objects.filter(
            group=group1, user_id=self.user.id, is_active=True
        ).exists()

        assert GroupSubscription.objects.filter(
            group=group2, user_id=self.user.id, is_active=True
        ).exists()

        assert not GroupSubscription.objects.filter(group=group3, user_id=self.user.id).exists()

        assert not GroupSubscription.objects.filter(group=group4, user_id=self.user.id).exists()

    def test_set_public(self):
        group1 = self.create_group()
        group2 = self.create_group()

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}"
        response = self.client.put(url, data={"isPublic": "true"}, format="json")
        assert response.status_code == 200
        assert response.data["isPublic"] is True
        assert "shareId" in response.data

        new_group1 = Group.objects.get(id=group1.id)
        assert bool(new_group1.get_share_id())

        new_group2 = Group.objects.get(id=group2.id)
        assert bool(new_group2.get_share_id())

    def test_set_private(self):
        group1 = self.create_group()
        group2 = self.create_group()

        # Manually mark them as shared
        for g in group1, group2:
            GroupShare.objects.create(project_id=g.project_id, group=g)
            assert bool(g.get_share_id())

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}"
        response = self.client.put(url, data={"isPublic": "false"}, format="json")
        assert response.status_code == 200
        assert response.data == {"isPublic": False, "shareId": None}

        new_group1 = Group.objects.get(id=group1.id)
        assert not bool(new_group1.get_share_id())

        new_group2 = Group.objects.get(id=group2.id)
        assert not bool(new_group2.get_share_id())

    def test_set_has_seen(self):
        group1 = self.create_group(status=GroupStatus.RESOLVED)
        group2 = self.create_group(status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"hasSeen": "true"}, format="json")
        assert response.status_code == 200
        assert response.data == {"hasSeen": True}

        r1 = GroupSeen.objects.filter(group=group1, user_id=self.user.id)
        assert r1.exists()

        r2 = GroupSeen.objects.filter(group=group2, user_id=self.user.id)
        assert r2.exists()

        r3 = GroupSeen.objects.filter(group=group3, user_id=self.user.id)
        assert not r3.exists()

        r4 = GroupSeen.objects.filter(group=group4, user_id=self.user.id)
        assert not r4.exists()

    def test_inbox_fields(self):
        group1 = self.create_group(status=GroupStatus.UNRESOLVED)
        add_group_to_inbox(group1, GroupInboxReason.NEW)
        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}"
        response = self.client.put(url, data={"status": "resolved"}, format="json")
        assert "inbox" in response.data
        assert response.data["inbox"] is None

        group2 = self.create_group(status=GroupStatus.RESOLVED)
        add_group_to_inbox(group2, GroupInboxReason.NEW)
        self.login_as(user=self.user)
        url = f"{self.path}?id={group2.id}"
        response = self.client.put(url, data={"status": "resolved"}, format="json")
        assert "inbox" not in response.data

    @patch("sentry.issues.merge.uuid4")
    @patch("sentry.issues.merge.merge_groups")
    @patch("sentry.eventstream.backend")
    def test_merge(self, mock_eventstream, merge_groups, mock_uuid4):
        eventstream_state = object()
        mock_eventstream.start_merge = Mock(return_value=eventstream_state)

        mock_uuid4.return_value = self.get_mock_uuid()
        group1 = self.create_group(times_seen=1)
        group2 = self.create_group(times_seen=50)
        group3 = self.create_group(times_seen=2)
        self.create_group()

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&id={group3.id}"
        response = self.client.put(url, data={"merge": "1"}, format="json")
        assert response.status_code == 200
        assert response.data["merge"]["parent"] == str(group2.id)
        assert sorted(response.data["merge"]["children"]) == sorted(
            [str(group1.id), str(group3.id)]
        )

        mock_eventstream.start_merge.assert_called_once_with(
            group1.project_id, [group3.id, group1.id], group2.id
        )

        assert len(merge_groups.mock_calls) == 1
        merge_groups.delay.assert_any_call(
            from_object_ids=[group3.id, group1.id],
            to_object_id=group2.id,
            transaction_id="abc123",
            eventstream_state=eventstream_state,
        )

    @patch("sentry.issues.merge.uuid4")
    @patch("sentry.issues.merge.merge_groups")
    @patch("sentry.eventstream.backend")
    def test_merge_performance_issues(self, mock_eventstream, merge_groups, mock_uuid4):
        eventstream_state = object()
        mock_eventstream.start_merge = Mock(return_value=eventstream_state)

        mock_uuid4.return_value = self.get_mock_uuid()
        group1 = self.create_group(times_seen=1, type=PerformanceSlowDBQueryGroupType.type_id)
        group2 = self.create_group(times_seen=50, type=PerformanceSlowDBQueryGroupType.type_id)
        group3 = self.create_group(times_seen=2, type=PerformanceSlowDBQueryGroupType.type_id)
        self.create_group()

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&id={group3.id}"
        response = self.client.put(url, data={"merge": "1"}, format="json")

        assert response.status_code == 400, response.content

    def test_assign(self):
        group1 = self.create_group(is_public=True)
        group2 = self.create_group(is_public=True)
        user = self.user

        self.login_as(user=user)
        url = f"{self.path}?id={group1.id}"
        response = self.client.put(url, data={"assignedTo": user.username})

        assert response.status_code == 200
        assert response.data["assignedTo"]["id"] == str(user.id)
        assert response.data["assignedTo"]["type"] == "user"
        assert GroupAssignee.objects.filter(group=group1, user_id=user.id).exists()

        assert not GroupAssignee.objects.filter(group=group2, user_id=user.id).exists()

        assert (
            Activity.objects.filter(
                group=group1, user_id=user.id, type=ActivityType.ASSIGNED.value
            ).count()
            == 1
        )

        assert GroupSubscription.objects.filter(
            user_id=user.id, group=group1, is_active=True
        ).exists()

        response = self.client.put(url, data={"assignedTo": ""}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["assignedTo"] is None

        assert not GroupAssignee.objects.filter(group=group1, user_id=user.id).exists()

    def test_assign_non_member(self):
        group = self.create_group(is_public=True)
        member = self.user
        non_member = self.create_user("bar@example.com")

        self.login_as(user=member)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"assignedTo": non_member.username}, format="json")

        assert response.status_code == 400, response.content

    def test_assign_team(self):
        self.login_as(user=self.user)

        group = self.create_group()
        other_member = self.create_user("bar@example.com")
        team = self.create_team(
            organization=group.project.organization, members=[self.user, other_member]
        )

        group.project.add_team(team)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"assignedTo": f"team:{team.id}"})

        assert response.status_code == 200
        assert response.data["assignedTo"]["id"] == str(team.id)
        assert response.data["assignedTo"]["type"] == "team"
        assert GroupAssignee.objects.filter(group=group, team=team).exists()

        assert Activity.objects.filter(group=group, type=ActivityType.ASSIGNED.value).count() == 1

        assert GroupSubscription.objects.filter(group=group, is_active=True).count() == 2

        response = self.client.put(url, data={"assignedTo": ""}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["assignedTo"] is None

    def test_discard(self):
        group1 = self.create_group(is_public=True)
        group2 = self.create_group(is_public=True)
        group_hash = GroupHash.objects.create(hash="x" * 32, project=group1.project, group=group1)
        user = self.user

        self.login_as(user=user)
        url = f"{self.path}?id={group1.id}"
        with self.tasks():
            with self.feature("projects:discard-groups"):
                response = self.client.put(url, data={"discard": True})

        assert response.status_code == 204
        assert not Group.objects.filter(id=group1.id).exists()
        assert Group.objects.filter(id=group2.id).exists()
        assert GroupHash.objects.filter(id=group_hash.id).exists()
        tombstone = GroupTombstone.objects.get(
            id=GroupHash.objects.get(id=group_hash.id).group_tombstone_id
        )
        assert tombstone.message == group1.message
        assert tombstone.culprit == group1.culprit
        assert tombstone.project == group1.project
        assert tombstone.data == group1.data

    @patch(
        "sentry.models.OrganizationMember.get_scopes",
        return_value=frozenset(s for s in settings.SENTRY_SCOPES if s != "event:admin"),
    )
    def test_discard_requires_events_admin(self, mock_get_scopes):
        group1 = self.create_group(is_public=True)
        user = self.user

        self.login_as(user=user)

        url = f"{self.path}?id={group1.id}"
        with self.tasks(), self.feature("projects:discard-groups"):
            response = self.client.put(url, data={"discard": True})

        assert response.status_code == 400
        assert Group.objects.filter(id=group1.id).exists()


class GroupDeleteTest(APITestCase, SnubaTestCase):
    @cached_property
    def path(self):
        return f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/"

    def create_groups(
        self, groups_to_create: Sequence[tuple[int, Project, int | str | None]]
    ) -> list[Group]:
        groups = []
        for status, project, type in groups_to_create:
            if type is None:
                groups.append(self.create_group(status=status, project=project))
            else:
                groups.append(self.create_group(status=status, project=project, type=type))

        for g in groups:
            hash = uuid4().hex
            GroupHash.objects.create(project=g.project, hash=hash, group=g)

        return groups

    def assert_groups_being_deleted(self, groups: Sequence[Group]) -> None:
        for g in groups:
            assert Group.objects.get(id=g.id).status == GroupStatus.PENDING_DELETION
            assert not GroupHash.objects.filter(group_id=g.id).exists()

        # XXX: I do not understand why this update is necessary for the tests to function
        Group.objects.filter(id__in=[g.id for g in groups]).update(status=GroupStatus.UNRESOLVED)

    def assert_groups_are_gone(self, groups: Sequence[Group]) -> None:
        for g in groups:
            assert not Group.objects.filter(id=g.id).exists()
            assert not GroupHash.objects.filter(group_id=g.id).exists()

    def assert_groups_not_deleted(self, groups: Sequence[Group]) -> None:
        for g in groups:
            assert Group.objects.filter(id=g.id).exists()
            assert Group.objects.get(id=g.id).status != GroupStatus.PENDING_DELETION
            assert GroupHash.objects.filter(group_id=g.id).exists()

    @patch("sentry.eventstream.backend")
    def test_delete_by_id(self, mock_eventstream):
        eventstream_state = {"event_stream_state": uuid4()}
        mock_eventstream.start_delete_groups = Mock(return_value=eventstream_state)

        groups = self.create_groups(
            [
                (GroupStatus.RESOLVED, self.project, None),
                (GroupStatus.UNRESOLVED, self.project, None),
                (GroupStatus.IGNORED, self.project, None),
                (GroupStatus.UNRESOLVED, self.create_project(slug="foo"), None),
            ],
        )
        group1, group2, group3, group4 = groups

        self.login_as(user=self.user)
        # Group 4 will not be deleted because it belongs to a different project
        url = f"{self.path}?id={group1.id}&id={group2.id}&id={group4.id}"

        response = self.client.delete(url, format="json")

        mock_eventstream.start_delete_groups.assert_called_once_with(
            group1.project_id, [group1.id, group2.id]
        )

        assert response.status_code == 204

        self.assert_groups_being_deleted([group1, group2])
        # Group 4 is not deleted because it belongs to a different project
        self.assert_groups_not_deleted([group3, group4])

        with self.tasks():
            response = self.client.delete(url, format="json")

        # XXX(markus): Something is sending duplicated replacements to snuba --
        # once from within tasks.deletions.groups and another time from
        # sentry.deletions.defaults.groups
        assert mock_eventstream.end_delete_groups.call_args_list == [
            call(eventstream_state),
            call(eventstream_state),
        ]

        assert response.status_code == 204

        self.assert_groups_are_gone([group1, group2])
        self.assert_groups_not_deleted([group3, group4])

    @patch("sentry.eventstream.backend")
    def test_delete_performance_issue_by_id(self, mock_eventstream):
        eventstream_state = {"event_stream_state": uuid4()}
        mock_eventstream.start_delete_groups = Mock(return_value=eventstream_state)

        group1, group2 = self.create_groups(
            [
                (GroupStatus.RESOLVED, self.project, PerformanceSlowDBQueryGroupType.type_id),
                (GroupStatus.UNRESOLVED, self.project, PerformanceSlowDBQueryGroupType.type_id),
            ],
        )

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}"

        response = self.client.delete(url, format="json")

        # We do not support issue platform deletions
        assert response.status_code == 400
        self.assert_groups_not_deleted([group1, group2])

        # We are allowed to delete the groups with the feature flag enabled
        with Feature({"organizations:issue-platform-deletion": True}), self.tasks():
            response = self.client.delete(url, format="json")
            assert response.status_code == 204
            self.assert_groups_are_gone([group1, group2])

    def test_bulk_delete(self):
        groups_to_create = []
        for _ in range(10, 41):
            groups_to_create.append((GroupStatus.RESOLVED, self.project, None))
        groups = self.create_groups(groups_to_create)

        self.login_as(user=self.user)

        # if query is '' it defaults to is:unresolved
        url = self.path + "?query="
        response = self.client.delete(url, format="json")

        assert response.status_code == 204
        self.assert_groups_being_deleted(groups)

        with self.tasks():
            response = self.client.delete(url, format="json")

        assert response.status_code == 204
        self.assert_groups_are_gone(groups)

    def test_bulk_delete_performance_issues(self):
        groups_to_create = []
        for _ in range(10, 41):
            groups_to_create.append(
                (GroupStatus.RESOLVED, self.project, PerformanceSlowDBQueryGroupType.type_id)
            )
        groups = self.create_groups(groups_to_create)

        self.login_as(user=self.user)

        # if query is '' it defaults to is:unresolved
        url = self.path + "?query="
        response = self.client.delete(url, format="json")
        # We do not support issue platform deletions
        assert response.status_code == 400
        self.assert_groups_not_deleted(groups)

        # We are allowed to delete the groups with the feature flag enabled
        with Feature({"organizations:issue-platform-deletion": True}), self.tasks():
            response = self.client.delete(url, format="json")
            assert response.status_code == 204
            self.assert_groups_are_gone(groups)
