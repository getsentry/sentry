from datetime import timedelta
from uuid import uuid4

from urllib.parse import quote

from django.conf import settings
from django.utils import timezone
from exam import fixture
from sentry.utils.compat.mock import patch, Mock

from sentry.models import (
    Activity,
    ApiToken,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupHash,
    GroupLink,
    GroupResolution,
    GroupSeen,
    GroupShare,
    GroupSnooze,
    GroupStatus,
    GroupSubscription,
    GroupTombstone,
    ExternalIssue,
    Integration,
    Release,
    OrganizationIntegration,
    UserOption,
)
from sentry.models.groupinbox import add_group_to_inbox, GroupInboxReason
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import iso_format, before_now
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

    @fixture
    def path(self):
        return f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/"

    def test_sort_by_date_with_tag(self):
        # XXX(dcramer): this tests a case where an ambiguous column name existed
        group1 = self.create_group(checksum="a" * 32, last_seen=before_now(seconds=1))
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group1.id)

    def test_invalid_query(self):
        self.create_group(checksum="a" * 32, last_seen=before_now(seconds=1))
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
        self.create_group(checksum="a" * 32, last_seen=before_now(seconds=1))
        self.create_group(checksum="b" * 32, last_seen=timezone.now())

        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?statsPeriod=24h", format="json")
        assert response.status_code == 200

        response = self.client.get(f"{self.path}?statsPeriod=14d", format="json")
        assert response.status_code == 200

        response = self.client.get(f"{self.path}?statsPeriod=", format="json")
        assert response.status_code == 200

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
        self.create_group(checksum="a" * 32, last_seen=before_now(days=1))
        group2 = self.create_group(checksum="b" * 32, last_seen=timezone.now())

        self.login_as(user=self.user)
        response = self.client.get(self.path, format="json")
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
        self.create_group(checksum="a" * 32)
        self.create_group(checksum="b" * 32)

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

    def test_pending_delete_pending_merge_excluded(self):
        self.create_group(checksum="a" * 32, status=GroupStatus.PENDING_DELETION)
        group = self.create_group(checksum="b" * 32)
        self.create_group(checksum="c" * 32, status=GroupStatus.DELETION_IN_PROGRESS)
        self.create_group(checksum="d" * 32, status=GroupStatus.PENDING_MERGE)

        self.login_as(user=self.user)

        response = self.client.get(self.path, format="json")
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
        token = ApiToken.objects.create(user=self.user, scopes=256)
        response = self.client.get(
            self.path, format="json", HTTP_AUTHORIZATION="Bearer %s" % token.token
        )
        assert response.status_code == 200, response.content


class GroupUpdateTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    @fixture
    def path(self):
        return f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/"

    def assertNoResolution(self, group):
        assert not GroupResolution.objects.filter(group=group).exists()

    def test_global_resolve(self):
        group1 = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum="b" * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum="c" * 32, status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            checksum="b" * 32,
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        response = self.client.put(
            f"{self.path}?status=unresolved", data={"status": "resolved"}, format="json"
        )
        assert response.status_code == 200, response.data
        assert response.data == {"status": "resolved", "statusDetails": {}}

        # the previously resolved entry should not be included
        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.status == GroupStatus.RESOLVED
        assert new_group1.resolved_at is None

        # this wont exist because it wasn't affected
        assert not GroupSubscription.objects.filter(user=self.user, group=new_group1).exists()

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.status == GroupStatus.RESOLVED
        assert new_group2.resolved_at is not None

        assert GroupSubscription.objects.filter(
            user=self.user, group=new_group2, is_active=True
        ).exists()

        # the ignored entry should not be included
        new_group3 = Group.objects.get(id=group3.id)
        assert new_group3.status == GroupStatus.IGNORED
        assert new_group3.resolved_at is None

        assert not GroupSubscription.objects.filter(user=self.user, group=new_group3)

        new_group4 = Group.objects.get(id=group4.id)
        assert new_group4.status == GroupStatus.UNRESOLVED
        assert new_group4.resolved_at is None

        assert not GroupSubscription.objects.filter(user=self.user, group=new_group4)

    def test_bulk_resolve(self):
        self.login_as(user=self.user)

        for i in range(200):
            self.create_group(status=GroupStatus.UNRESOLVED)

        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")

        assert len(response.data) == 100

        response = self.client.put(
            f"{self.path}?status=unresolved", data={"status": "resolved"}, format="json"
        )
        assert response.status_code == 200, response.data

        assert response.data == {"status": "resolved", "statusDetails": {}}
        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")

        assert len(response.data) == 0

    @patch("sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound")
    def test_resolve_with_integration(self, mock_sync_status_outbound):
        self.login_as(user=self.user)

        org = self.organization

        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)
        group = self.create_group(status=GroupStatus.UNRESOLVED)

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
                    f"{self.path}?status=unresolved",
                    data={"status": "resolved"},
                    format="json",
                )
                assert response.status_code == 200, response.data

                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.RESOLVED

                assert response.data == {"status": "resolved", "statusDetails": {}}
                mock_sync_status_outbound.assert_called_once_with(
                    external_issue, True, group.project_id
                )

        response = self.client.get(f"{self.path}?sort_by=date&query=is:unresolved", format="json")
        assert len(response.data) == 0

    @patch("sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound")
    def test_set_unresolved_with_integration(self, mock_sync_status_outbound):
        release = self.create_release(project=self.project, version="abc")
        group = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
        org = self.organization
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
                    user=self.user, group=group, is_active=True
                ).exists()
                mock_sync_status_outbound.assert_called_once_with(
                    external_issue, False, group.project_id
                )

    def test_self_assign_issue(self):
        group = self.create_group(checksum="b" * 32, status=GroupStatus.UNRESOLVED)
        user = self.user

        uo1 = UserOption.objects.create(key="self_assign_issue", value="1", project=None, user=user)

        self.login_as(user=user)
        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "resolved"}, format="json")

        assert response.status_code == 200, response.data
        assert response.data["assignedTo"]["id"] == str(user.id)
        assert response.data["assignedTo"]["type"] == "user"
        assert response.data["status"] == "resolved"

        assert GroupAssignee.objects.filter(group=group, user=user).exists()

        assert GroupSubscription.objects.filter(user=user, group=group, is_active=True).exists()

        uo1.delete()

    def test_self_assign_issue_next_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

        uo1 = UserOption.objects.create(
            key="self_assign_issue", value="1", project=None, user=self.user
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
            user=self.user, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_RESOLVED_IN_RELEASE)
        assert activity.data["version"] == ""
        uo1.delete()

    def test_selective_status_update(self):
        group1 = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum="b" * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum="c" * 32, status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            checksum="b" * 32,
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        assert response.data == {"status": "resolved", "statusDetails": {}}

        new_group1 = Group.objects.get(id=group1.id)
        assert new_group1.resolved_at is not None
        assert new_group1.status == GroupStatus.RESOLVED

        new_group2 = Group.objects.get(id=group2.id)
        assert new_group2.resolved_at is not None
        assert new_group2.status == GroupStatus.RESOLVED

        assert GroupSubscription.objects.filter(
            user=self.user, group=new_group2, is_active=True
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

        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

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

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user=self.user, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_RESOLVED_IN_RELEASE)
        assert activity.data["version"] == release.version

    def test_set_resolved_in_explicit_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)
        release2 = Release.objects.create(organization_id=self.project.organization_id, version="b")
        release2.add_project(self.project)

        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

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

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user=self.user, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_RESOLVED_IN_RELEASE)
        assert activity.data["version"] == release.version

    def test_set_resolved_in_next_release(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

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

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.RESOLVED

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_next_release
        assert resolution.status == GroupResolution.Status.pending
        assert resolution.actor_id == self.user.id

        assert GroupSubscription.objects.filter(
            user=self.user, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_RESOLVED_IN_RELEASE)
        assert activity.data["version"] == ""

    def test_set_resolved_in_next_release_legacy(self):
        release = Release.objects.create(organization_id=self.project.organization_id, version="a")
        release.add_project(self.project)

        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

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
            user=self.user, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_RESOLVED_IN_RELEASE)
        assert activity.data["version"] == ""

    def test_set_resolved_in_explicit_commit_unreleased(self):
        repo = self.create_repo(project=self.project, name=self.project.name)
        commit = self.create_commit(project=self.project, repo=repo)
        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

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
            user=self.user, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_RESOLVED_IN_COMMIT)
        assert activity.data["commit"] == commit.id

    def test_set_resolved_in_explicit_commit_released(self):
        release = self.create_release(project=self.project)
        repo = self.create_repo(project=self.project, name=self.project.name)
        commit = self.create_commit(project=self.project, repo=repo, release=release)

        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

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
            user=self.user, group=group, is_active=True
        ).exists()

        activity = Activity.objects.get(group=group, type=Activity.SET_RESOLVED_IN_COMMIT)
        assert activity.data["commit"] == commit.id

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.status == GroupResolution.Status.resolved

    def test_set_resolved_in_explicit_commit_missing(self):
        repo = self.create_repo(project=self.project, name=self.project.name)
        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

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
        group = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
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
            user=self.user, group=group, is_active=True
        ).exists()

    def test_set_unresolved_on_snooze(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.IGNORED)

        GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(days=1))

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "unresolved"}, format="json")
        assert response.status_code == 200
        assert response.data == {"status": "unresolved", "statusDetails": {}}

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

    def test_basic_ignore(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)

        snooze = GroupSnooze.objects.create(group=group, until=timezone.now())

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(url, data={"status": "ignored"}, format="json")

        assert response.status_code == 200

        # existing snooze objects should be cleaned up
        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.IGNORED

        assert response.data == {"status": "ignored", "statusDetails": {}}

    def test_snooze_duration(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        url = f"{self.path}?id={group.id}"
        response = self.client.put(
            url, data={"status": "ignored", "ignoreDuration": 30}, format="json"
        )

        assert response.status_code == 200

        snooze = GroupSnooze.objects.get(group=group)

        now = timezone.now()

        assert snooze.count is None
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
        group = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED, times_seen=1)

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
        assert snooze.state["users_seen"] == 10

        assert response.data["status"] == "ignored"
        assert response.data["statusDetails"]["ignoreCount"] == snooze.count
        assert response.data["statusDetails"]["ignoreWindow"] == snooze.window
        assert response.data["statusDetails"]["ignoreUserCount"] == snooze.user_count
        assert response.data["statusDetails"]["ignoreUserWindow"] == snooze.user_window
        assert response.data["statusDetails"]["ignoreUntil"] == snooze.until
        assert response.data["statusDetails"]["actor"]["id"] == str(self.user.id)

    def test_set_bookmarked(self):
        group1 = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum="b" * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum="c" * 32, status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            checksum="b" * 32,
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"isBookmarked": "true"}, format="json")
        assert response.status_code == 200
        assert response.data == {"isBookmarked": True}

        bookmark1 = GroupBookmark.objects.filter(group=group1, user=self.user)
        assert bookmark1.exists()

        assert GroupSubscription.objects.filter(
            user=self.user, group=group1, is_active=True
        ).exists()

        bookmark2 = GroupBookmark.objects.filter(group=group2, user=self.user)
        assert bookmark2.exists()

        assert GroupSubscription.objects.filter(
            user=self.user, group=group2, is_active=True
        ).exists()

        bookmark3 = GroupBookmark.objects.filter(group=group3, user=self.user)
        assert not bookmark3.exists()

        bookmark4 = GroupBookmark.objects.filter(group=group4, user=self.user)
        assert not bookmark4.exists()

    def test_subscription(self):
        group1 = self.create_group(checksum="a" * 32)
        group2 = self.create_group(checksum="b" * 32)
        group3 = self.create_group(checksum="c" * 32)
        group4 = self.create_group(project=self.create_project(slug="foo"), checksum="b" * 32)

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"isSubscribed": "true"}, format="json")
        assert response.status_code == 200
        assert response.data == {"isSubscribed": True, "subscriptionDetails": {"reason": "unknown"}}

        assert GroupSubscription.objects.filter(
            group=group1, user=self.user, is_active=True
        ).exists()

        assert GroupSubscription.objects.filter(
            group=group2, user=self.user, is_active=True
        ).exists()

        assert not GroupSubscription.objects.filter(group=group3, user=self.user).exists()

        assert not GroupSubscription.objects.filter(group=group4, user=self.user).exists()

    def test_set_public(self):
        group1 = self.create_group(checksum="a" * 32)
        group2 = self.create_group(checksum="b" * 32)

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
        group1 = self.create_group(checksum="a" * 32)
        group2 = self.create_group(checksum="b" * 32)

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
        group1 = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum="b" * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum="c" * 32, status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            checksum="b" * 32,
            status=GroupStatus.UNRESOLVED,
        )

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"
        response = self.client.put(url, data={"hasSeen": "true"}, format="json")
        assert response.status_code == 200
        assert response.data == {"hasSeen": True}

        r1 = GroupSeen.objects.filter(group=group1, user=self.user)
        assert r1.exists()

        r2 = GroupSeen.objects.filter(group=group2, user=self.user)
        assert r2.exists()

        r3 = GroupSeen.objects.filter(group=group3, user=self.user)
        assert not r3.exists()

        r4 = GroupSeen.objects.filter(group=group4, user=self.user)
        assert not r4.exists()

    def test_inbox_fields(self):
        with self.feature("organizations:inbox"):
            group1 = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
            add_group_to_inbox(group1, GroupInboxReason.NEW)
            self.login_as(user=self.user)
            url = f"{self.path}?id={group1.id}"
            response = self.client.put(url, data={"status": "resolved"}, format="json")
            assert "inbox" in response.data
            assert response.data["inbox"] is None

    @patch("sentry.api.helpers.group_index.uuid4")
    @patch("sentry.api.helpers.group_index.merge_groups")
    @patch("sentry.api.helpers.group_index.eventstream")
    def test_merge(self, mock_eventstream, merge_groups, mock_uuid4):
        eventstream_state = object()
        mock_eventstream.start_merge = Mock(return_value=eventstream_state)

        mock_uuid4.return_value = self.get_mock_uuid()
        group1 = self.create_group(checksum="a" * 32, times_seen=1)
        group2 = self.create_group(checksum="b" * 32, times_seen=50)
        group3 = self.create_group(checksum="c" * 32, times_seen=2)
        self.create_group(checksum="d" * 32)

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

    def test_assign(self):
        group1 = self.create_group(checksum="a" * 32, is_public=True)
        group2 = self.create_group(checksum="b" * 32, is_public=True)
        user = self.user

        self.login_as(user=user)
        url = f"{self.path}?id={group1.id}"
        response = self.client.put(url, data={"assignedTo": user.username})

        assert response.status_code == 200
        assert response.data["assignedTo"]["id"] == str(user.id)
        assert response.data["assignedTo"]["type"] == "user"
        assert GroupAssignee.objects.filter(group=group1, user=user).exists()

        assert not GroupAssignee.objects.filter(group=group2, user=user).exists()

        assert Activity.objects.filter(group=group1, user=user, type=Activity.ASSIGNED).count() == 1

        assert GroupSubscription.objects.filter(user=user, group=group1, is_active=True).exists()

        response = self.client.put(url, data={"assignedTo": ""}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["assignedTo"] is None

        assert not GroupAssignee.objects.filter(group=group1, user=user).exists()

    def test_assign_non_member(self):
        group = self.create_group(checksum="a" * 32, is_public=True)
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

        assert Activity.objects.filter(group=group, type=Activity.ASSIGNED).count() == 1

        assert GroupSubscription.objects.filter(group=group, is_active=True).count() == 2

        response = self.client.put(url, data={"assignedTo": ""}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["assignedTo"] is None

    def test_discard(self):
        group1 = self.create_group(checksum="a" * 32, is_public=True)
        group2 = self.create_group(checksum="b" * 32, is_public=True)
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
        group1 = self.create_group(checksum="a" * 32, is_public=True)
        user = self.user

        self.login_as(user=user)

        url = f"{self.path}?id={group1.id}"
        with self.tasks(), self.feature("projects:discard-groups"):
            response = self.client.put(url, data={"discard": True})

        assert response.status_code == 400
        assert Group.objects.filter(id=group1.id).exists()


class GroupDeleteTest(APITestCase, SnubaTestCase):
    @fixture
    def path(self):
        return f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/"

    @patch("sentry.api.helpers.group_index.eventstream")
    @patch("sentry.eventstream")
    def test_delete_by_id(self, mock_eventstream_task, mock_eventstream_api):
        eventstream_state = {"event_stream_state": uuid4()}
        mock_eventstream_api.start_delete_groups = Mock(return_value=eventstream_state)

        group1 = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)
        group2 = self.create_group(checksum="b" * 32, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(checksum="c" * 32, status=GroupStatus.IGNORED)
        group4 = self.create_group(
            project=self.create_project(slug="foo"),
            checksum="b" * 32,
            status=GroupStatus.UNRESOLVED,
        )

        hashes = []
        for g in group1, group2, group3, group4:
            hash = uuid4().hex
            hashes.append(hash)
            GroupHash.objects.create(project=g.project, hash=hash, group=g)

        self.login_as(user=self.user)
        url = f"{self.path}?id={group1.id}&id={group2.id}&group4={group4.id}"

        response = self.client.delete(url, format="json")

        mock_eventstream_api.start_delete_groups.assert_called_once_with(
            group1.project_id, [group1.id, group2.id]
        )

        assert response.status_code == 204

        assert Group.objects.get(id=group1.id).status == GroupStatus.PENDING_DELETION
        assert not GroupHash.objects.filter(group_id=group1.id).exists()

        assert Group.objects.get(id=group2.id).status == GroupStatus.PENDING_DELETION
        assert not GroupHash.objects.filter(group_id=group2.id).exists()

        assert Group.objects.get(id=group3.id).status != GroupStatus.PENDING_DELETION
        assert GroupHash.objects.filter(group_id=group3.id).exists()

        assert Group.objects.get(id=group4.id).status != GroupStatus.PENDING_DELETION
        assert GroupHash.objects.filter(group_id=group4.id).exists()

        Group.objects.filter(id__in=(group1.id, group2.id)).update(status=GroupStatus.UNRESOLVED)

        with self.tasks():
            response = self.client.delete(url, format="json")

        mock_eventstream_task.end_delete_groups.assert_called_once_with(eventstream_state)

        assert response.status_code == 204

        assert not Group.objects.filter(id=group1.id).exists()
        assert not GroupHash.objects.filter(group_id=group1.id).exists()

        assert not Group.objects.filter(id=group2.id).exists()
        assert not GroupHash.objects.filter(group_id=group2.id).exists()

        assert Group.objects.filter(id=group3.id).exists()
        assert GroupHash.objects.filter(group_id=group3.id).exists()

        assert Group.objects.filter(id=group4.id).exists()
        assert GroupHash.objects.filter(group_id=group4.id).exists()

    def test_bulk_delete(self):
        groups = []
        for i in range(10, 41):
            groups.append(
                self.create_group(
                    project=self.project,
                    checksum=str(i).encode("utf-8") * 16,
                    status=GroupStatus.RESOLVED,
                )
            )

        hashes = []
        for group in groups:
            hash = uuid4().hex
            hashes.append(hash)
            GroupHash.objects.create(project=group.project, hash=hash, group=group)

        self.login_as(user=self.user)

        # if query is '' it defaults to is:unresolved
        url = self.path + "?query="
        response = self.client.delete(url, format="json")

        assert response.status_code == 204

        for group in groups:
            assert Group.objects.get(id=group.id).status == GroupStatus.PENDING_DELETION
            assert not GroupHash.objects.filter(group_id=group.id).exists()

        Group.objects.filter(id__in=[group.id for group in groups]).update(
            status=GroupStatus.UNRESOLVED
        )

        with self.tasks():
            response = self.client.delete(url, format="json")

        assert response.status_code == 204

        for group in groups:
            assert not Group.objects.filter(id=group.id).exists()
            assert not GroupHash.objects.filter(group_id=group.id).exists()
