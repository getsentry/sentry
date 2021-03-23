from datetime import timedelta
from dateutil.parser import parse as parse_datetime
from uuid import uuid4

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry import options
from sentry.models import (
    add_group_to_inbox,
    Activity,
    ApiToken,
    ExternalIssue,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupHash,
    GroupInbox,
    GroupInboxReason,
    GroupLink,
    GroupOwner,
    GroupOwnerType,
    GROUP_OWNER_TYPE,
    GroupSeen,
    GroupShare,
    GroupSnooze,
    GroupStatus,
    GroupResolution,
    GroupSubscription,
    GroupTombstone,
    Integration,
    OrganizationIntegration,
    UserOption,
    Release,
    remove_group_from_inbox,
)
from sentry.utils import json
from sentry.utils.compat.mock import patch, Mock

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupListTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-group-index"

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

    def get_response(self, *args, **kwargs):
        if not args:
            org = self.project.organization.slug
        else:
            org = args[0]
        return super().get_response(org, **kwargs)

    def test_sort_by_date_with_tag(self):
        # XXX(dcramer): this tests a case where an ambiguous column name existed
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": iso_format(before_now(seconds=1))},
            project_id=self.project.id,
        )
        group = event.group
        self.login_as(user=self.user)

        response = self.get_valid_response(sort_by="date", query="is:unresolved")
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group.id)

    def test_sort_by_trend(self):
        group = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(hours=13)),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        group_2 = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=5)),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        self.store_event(
            data={
                "timestamp": iso_format(before_now(hours=13)),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        response = self.get_valid_response(
            sort="trend",
            query="is:unresolved",
            limit=1,
            start=iso_format(before_now(days=1)),
            end=iso_format(before_now(seconds=1)),
        )
        assert len(response.data) == 1
        assert [item["id"] for item in response.data] == [str(group.id)]

        header_links = parse_link_header(response["Link"])
        cursor = [link for link in header_links.values() if link["rel"] == "next"][0]["cursor"]
        response = self.get_valid_response(
            sort="trend",
            query="is:unresolved",
            limit=1,
            start=iso_format(before_now(days=1)),
            end=iso_format(before_now(seconds=1)),
            cursor=cursor,
        )
        assert [item["id"] for item in response.data] == [str(group_2.id)]

    def test_sort_by_inbox(self):
        group_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        inbox_1 = add_group_to_inbox(group_1, GroupInboxReason.NEW)
        group_2 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        inbox_2 = add_group_to_inbox(group_2, GroupInboxReason.NEW)
        inbox_2.update(date_added=inbox_1.date_added - timedelta(hours=1))

        self.login_as(user=self.user)
        response = self.get_valid_response(
            sort="inbox", query="is:unresolved is:for_review", limit=1
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group_1.id)

        header_links = parse_link_header(response["Link"])
        cursor = [link for link in header_links.values() if link["rel"] == "next"][0]["cursor"]
        response = self.get_response(
            sort="inbox", cursor=cursor, query="is:unresolved is:for_review", limit=1
        )
        assert [item["id"] for item in response.data] == [str(group_2.id)]

    def test_sort_by_inbox_me_or_none(self):
        group_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        inbox_1 = add_group_to_inbox(group_1, GroupInboxReason.NEW)
        group_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        inbox_2 = add_group_to_inbox(group_2, GroupInboxReason.NEW)
        inbox_2.update(date_added=inbox_1.date_added - timedelta(hours=1))
        GroupOwner.objects.create(
            group=group_2,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user=self.user,
        )
        owner_by_other = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-3"],
            },
            project_id=self.project.id,
        ).group
        inbox_3 = add_group_to_inbox(owner_by_other, GroupInboxReason.NEW)
        inbox_3.update(date_added=inbox_1.date_added - timedelta(hours=1))
        other_user = self.create_user()
        GroupOwner.objects.create(
            group=owner_by_other,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user=other_user,
        )

        owned_me_assigned_to_other = self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-4"],
            },
            project_id=self.project.id,
        ).group
        inbox_4 = add_group_to_inbox(owned_me_assigned_to_other, GroupInboxReason.NEW)
        inbox_4.update(date_added=inbox_1.date_added - timedelta(hours=1))
        GroupAssignee.objects.assign(owned_me_assigned_to_other, other_user)
        GroupOwner.objects.create(
            group=owned_me_assigned_to_other,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user=self.user,
        )

        unowned_assigned_to_other = self.store_event(
            data={
                "event_id": "e" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
                "fingerprint": ["group-5"],
            },
            project_id=self.project.id,
        ).group
        inbox_5 = add_group_to_inbox(unowned_assigned_to_other, GroupInboxReason.NEW)
        inbox_5.update(date_added=inbox_1.date_added - timedelta(hours=1))
        GroupAssignee.objects.assign(unowned_assigned_to_other, other_user)

        self.login_as(user=self.user)
        response = self.get_valid_response(
            sort="inbox",
            query="is:unresolved is:for_review assigned_or_suggested:me_or_none",
            limit=10,
        )
        assert [item["id"] for item in response.data] == [str(group_1.id), str(group_2.id)]

    def test_trace_search(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(seconds=1)),
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
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_valid_response(
            sort_by="date", query="is:unresolved trace:a7d67cf796774551a95be6543cacd459"
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)

    def test_feature_gate(self):
        # ensure there are two or more projects
        self.create_project(organization=self.project.organization)
        self.login_as(user=self.user)

        response = self.get_response()
        assert response.status_code == 400
        assert response.data["detail"] == "You do not have the multi project stream feature enabled"

        with self.feature("organizations:global-views"):
            response = self.get_response()
            assert response.status_code == 200

    def test_with_all_projects(self):
        # ensure there are two or more projects
        self.create_project(organization=self.project.organization)
        self.login_as(user=self.user)

        with self.feature("organizations:global-views"):
            response = self.get_valid_response(project_id=[-1])
            assert response.status_code == 200

    def test_boolean_search_feature_flag(self):
        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", query="title:hello OR title:goodbye")
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == 'Error parsing search query: Boolean statements containing "OR" or "AND" are not supported in this search'
        )

        response = self.get_response(sort_by="date", query="title:hello AND title:goodbye")
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == 'Error parsing search query: Boolean statements containing "OR" or "AND" are not supported in this search'
        )

    def test_invalid_query(self):
        now = timezone.now()
        self.create_group(checksum="a" * 32, last_seen=now - timedelta(seconds=1))
        self.login_as(user=self.user)

        response = self.get_response(sort_by="date", query="timesSeen:>1t")
        assert response.status_code == 400
        assert "Invalid number" in response.data["detail"]

    def test_valid_numeric_query(self):
        now = timezone.now()
        self.create_group(checksum="a" * 32, last_seen=now - timedelta(seconds=1))
        self.login_as(user=self.user)

        response = self.get_response(sort_by="date", query="timesSeen:>1k")
        assert response.status_code == 200

    def test_invalid_sort_key(self):
        now = timezone.now()
        self.create_group(checksum="a" * 32, last_seen=now - timedelta(seconds=1))
        self.login_as(user=self.user)

        response = self.get_response(sort="meow", query="is:unresolved")
        assert response.status_code == 400

    def test_simple_pagination(self):
        event1 = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=2)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group1 = event1.group
        event2 = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=1)), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        group2 = event2.group
        self.login_as(user=self.user)
        response = self.get_valid_response(sort_by="date", limit=1)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group2.id)

        links = self._parse_links(response["Link"])

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group1.id)

        links = self._parse_links(response["Link"])

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

    def test_stats_period(self):
        # TODO(dcramer): this test really only checks if validation happens
        # on groupStatsPeriod
        now = timezone.now()
        self.create_group(checksum="a" * 32, last_seen=now - timedelta(seconds=1))
        self.create_group(checksum="b" * 32, last_seen=now)

        self.login_as(user=self.user)

        self.get_valid_response(groupStatsPeriod="24h")
        self.get_valid_response(groupStatsPeriod="14d")
        self.get_valid_response(groupStatsPeriod="")
        response = self.get_response(groupStatsPeriod="48h")
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

        response = self.get_valid_response(environment="production")
        assert len(response.data) == 1

        response = self.get_response(environment="garbage")
        assert response.status_code == 404

    def test_auto_resolved(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"event_id": "b" * 32, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        )
        group2 = event2.group

        self.login_as(user=self.user)
        response = self.get_valid_response()
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

        response = self.get_valid_response(query="c" * 32)
        assert response["X-Sentry-Direct-Hit"] == "1"
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event_id

    def test_lookup_by_event_id_incorrect_project_id(self):
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )
        event_id = "b" * 32
        event = self.store_event(
            data={"event_id": event_id, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )

        other_project = self.create_project(teams=[self.team])
        user = self.create_user()
        self.create_member(organization=self.organization, teams=[self.team], user=user)
        self.login_as(user=user)

        with self.feature("organizations:global-views"):
            response = self.get_valid_response(query=event_id, project=[other_project.id])
        assert response["X-Sentry-Direct-Hit"] == "1"
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event_id

    def test_lookup_by_event_id_with_whitespace(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        event_id = "c" * 32
        event = self.store_event(
            data={"event_id": event_id, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_valid_response(query="  {}  ".format("c" * 32))
        assert response["X-Sentry-Direct-Hit"] == "1"
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event_id

    def test_lookup_by_unknown_event_id(self):
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        self.create_group(checksum="a" * 32)
        self.create_group(checksum="b" * 32)

        self.login_as(user=self.user)
        response = self.get_valid_response(query="c" * 32)
        assert len(response.data) == 0

    def test_lookup_by_short_id(self):
        group = self.group
        short_id = group.qualified_short_id

        self.login_as(user=self.user)
        response = self.get_valid_response(query=short_id, shortIdLookup=1)
        assert len(response.data) == 1

    def test_lookup_by_short_id_ignores_project_list(self):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        project2 = self.create_project(organization=organization)
        group = self.create_group(project=project2)
        user = self.create_user()
        self.create_member(organization=organization, user=user)

        short_id = group.qualified_short_id

        self.login_as(user=user)

        response = self.get_valid_response(
            organization.slug, project=project.id, query=short_id, shortIdLookup=1
        )
        assert len(response.data) == 1

    def test_lookup_by_short_id_no_perms(self):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(organization=organization, user=user, has_global_access=False)

        short_id = group.qualified_short_id

        self.login_as(user=user)

        response = self.get_valid_response(organization.slug, query=short_id, shortIdLookup=1)
        assert len(response.data) == 0

    def test_lookup_by_group_id(self):
        self.login_as(user=self.user)
        response = self.get_valid_response(group=self.group.id)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.group.id)
        group_2 = self.create_group()
        response = self.get_valid_response(group=[self.group.id, group_2.id])
        assert {g["id"] for g in response.data} == {str(self.group.id), str(group_2.id)}

    def test_lookup_by_group_id_no_perms(self):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(organization=organization, user=user, has_global_access=False)
        self.login_as(user=user)
        response = self.get_response(group=[group.id])
        assert response.status_code == 403

    def test_lookup_by_first_release(self):
        self.login_as(self.user)
        project = self.project
        project2 = self.create_project(name="baz", organization=project.organization)
        release = Release.objects.create(organization=project.organization, version="12345")
        release.add_project(project)
        release.add_project(project2)
        event = self.store_event(
            data={"release": release.version, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"release": release.version, "timestamp": iso_format(before_now(seconds=1))},
            project_id=project2.id,
        )

        with self.feature("organizations:global-views"):
            response = self.get_valid_response(**{"query": 'first-release:"%s"' % release.version})
        issues = json.loads(response.content)
        assert len(issues) == 2
        assert int(issues[0]["id"]) == event2.group.id
        assert int(issues[1]["id"]) == event.group.id

    def test_lookup_by_release(self):
        self.login_as(self.user)
        project = self.project
        release = Release.objects.create(organization=project.organization, version="12345")
        release.add_project(project)
        event = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=1)),
                "tags": {"sentry:release": release.version},
            },
            project_id=project.id,
        )

        response = self.get_valid_response(release=release.version)
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event.group.id

    def test_pending_delete_pending_merge_excluded(self):
        events = []
        for i in "abcd":
            events.append(
                self.store_event(
                    data={
                        "event_id": i * 32,
                        "fingerprint": [i],
                        "timestamp": iso_format(self.min_ago),
                    },
                    project_id=self.project.id,
                )
            )
        events[0].group.update(status=GroupStatus.PENDING_DELETION)
        events[2].group.update(status=GroupStatus.DELETION_IN_PROGRESS)
        events[3].group.update(status=GroupStatus.PENDING_MERGE)

        self.login_as(user=self.user)

        response = self.get_valid_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(events[1].group.id)

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)

        self.create_group(last_seen=timezone.now() - timedelta(days=2))

        with self.options({"system.event-retention-days": 1}):
            response = self.get_valid_response()

        assert len(response.data) == 0

    def test_token_auth(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["event:read"])
        response = self.client.get(
            reverse("sentry-api-0-organization-group-index", args=[self.project.organization.slug]),
            format="json",
            HTTP_AUTHORIZATION="Bearer %s" % token.token,
        )
        assert response.status_code == 200, response.content

    def test_date_range(self):
        with self.options({"system.event-retention-days": 2}):
            event = self.store_event(
                data={"timestamp": iso_format(before_now(hours=5))}, project_id=self.project.id
            )
            group = event.group

            self.login_as(user=self.user)

            response = self.get_valid_response(statsPeriod="6h")
            assert len(response.data) == 1
            assert response.data[0]["id"] == str(group.id)

            response = self.get_valid_response(statsPeriod="1h")
            assert len(response.data) == 0

    @patch("sentry.analytics.record")
    def test_advanced_search_errors(self, mock_record):
        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", query="!has:user")
        assert response.status_code == 200, response.data
        assert not any(
            c[0][0] == "advanced_search.feature_gated" for c in mock_record.call_args_list
        )

        with self.feature({"organizations:advanced-search": False}):
            response = self.get_response(sort_by="date", query="!has:user")
            assert response.status_code == 400, response.data
            assert (
                "You need access to the advanced search feature to use negative "
                "search" == response.data["detail"]
            )

            mock_record.assert_called_with(
                "advanced_search.feature_gated",
                user_id=self.user.id,
                default_user_id=self.user.id,
                organization_id=self.organization.id,
            )

    # This seems like a random override, but this test needed a way to override
    # the orderby being sent to snuba for a certain call. This function has a simple
    # return value and can be used to set variables in the snuba payload.
    @patch("sentry.utils.snuba.get_query_params_to_update_for_projects")
    def test_assigned_to_pagination(self, patched_params_update):
        old_sample_size = options.get("snuba.search.hits-sample-size")
        assert options.set("snuba.search.hits-sample-size", 1)

        days = reversed(range(4))

        self.login_as(user=self.user)
        groups = []

        for day in days:
            patched_params_update.side_effect = [
                (self.organization.id, {"project": [self.project.id]})
            ]
            group = self.store_event(
                data={
                    "timestamp": iso_format(before_now(days=day)),
                    "fingerprint": [f"group-{day}"],
                },
                project_id=self.project.id,
            ).group
            groups.append(group)

        assigned_groups = groups[:2]
        for ag in assigned_groups:
            ag.update(status=GroupStatus.RESOLVED, resolved_at=before_now(seconds=5))
            GroupAssignee.objects.assign(ag, self.user)

        # This side_effect is meant to override the `calculate_hits` snuba query specifically.
        # If this test is failing it's because the -last_seen override is being applied to
        # different snuba query.
        def _my_patched_params(query_params, **kwargs):
            if query_params.aggregations == [
                ["uniq", "group_id", "total"],
                ["multiply(toUInt64(max(timestamp)), 1000)", "", "last_seen"],
            ]:
                return (
                    self.organization.id,
                    {"project": [self.project.id], "orderby": ["-last_seen"]},
                )
            else:
                return (self.organization.id, {"project": [self.project.id]})

        patched_params_update.side_effect = _my_patched_params

        response = self.get_response(limit=1, query=f"assigned:{self.user.email}")
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(assigned_groups[1].id)

        header_links = parse_link_header(response["Link"])
        cursor = [link for link in header_links.values() if link["rel"] == "next"][0]["cursor"]
        response = self.get_response(limit=1, cursor=cursor, query=f"assigned:{self.user.email}")
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(assigned_groups[0].id)

        assert options.set("snuba.search.hits-sample-size", old_sample_size)

    def test_assigned_me_or_none(self):
        self.login_as(user=self.user)
        groups = []
        for i in range(5):
            group = self.store_event(
                data={
                    "timestamp": iso_format(before_now(minutes=10, days=i)),
                    "fingerprint": [f"group-{i}"],
                },
                project_id=self.project.id,
            ).group
            groups.append(group)

        assigned_groups = groups[:2]
        for ag in assigned_groups:
            GroupAssignee.objects.assign(ag, self.user)

        response = self.get_response(limit=10, query="assigned:me")
        assert len(response.data) == 2

        response = self.get_response(limit=10, query="assigned:me_or_none")
        assert len(response.data) == 5

        GroupAssignee.objects.assign(assigned_groups[1], self.create_user("other@user.com"))
        response = self.get_response(limit=10, query="assigned:me_or_none")
        assert len(response.data) == 4

    def test_seen_stats(self):
        self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        before_now_300_seconds = iso_format(before_now(seconds=300))
        before_now_350_seconds = iso_format(before_now(seconds=350))
        event2 = self.store_event(
            data={"timestamp": before_now_300_seconds, "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        group2 = event2.group
        group2.first_seen = before_now_350_seconds
        group2.times_seen = 55
        group2.save()
        before_now_250_seconds = iso_format(before_now(seconds=250))
        self.store_event(
            data={
                "timestamp": before_now_250_seconds,
                "fingerprint": ["group-2"],
                "tags": {"server": "example.com", "trace": "meow", "message": "foo"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=200)),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )
        before_now_150_seconds = iso_format(before_now(seconds=150))
        self.store_event(
            data={
                "timestamp": before_now_150_seconds,
                "fingerprint": ["group-2"],
                "tags": {"trace": "ribbit", "server": "example.com"},
            },
            project_id=self.project.id,
        )
        before_now_100_seconds = iso_format(before_now(seconds=100))
        self.store_event(
            data={
                "timestamp": before_now_100_seconds,
                "fingerprint": ["group-2"],
                "tags": {"message": "foo", "trace": "meow"},
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query="server:example.com")

        assert response.status_code == 200
        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == group2.id
        assert response.data[0]["lifetime"] is not None
        assert response.data[0]["filtered"] is not None
        assert response.data[0]["filtered"]["stats"] is not None
        assert response.data[0]["lifetime"]["stats"] is None
        assert response.data[0]["filtered"]["stats"] != response.data[0]["stats"]

        assert response.data[0]["lifetime"]["firstSeen"] == parse_datetime(
            before_now_350_seconds  # Should match overridden value, not event value
        ).replace(tzinfo=timezone.utc)
        assert response.data[0]["lifetime"]["lastSeen"] == parse_datetime(
            before_now_100_seconds
        ).replace(tzinfo=timezone.utc)
        assert response.data[0]["lifetime"]["count"] == "55"

        assert response.data[0]["filtered"]["count"] == "2"
        assert response.data[0]["filtered"]["firstSeen"] == parse_datetime(
            before_now_250_seconds
        ).replace(tzinfo=timezone.utc)
        assert response.data[0]["filtered"]["lastSeen"] == parse_datetime(
            before_now_150_seconds
        ).replace(tzinfo=timezone.utc)

        # Empty filter test:
        response = self.get_response(sort_by="date", limit=10, query="")
        assert response.status_code == 200
        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == group2.id
        assert response.data[0]["lifetime"] is not None
        assert response.data[0]["filtered"] is None
        assert response.data[0]["lifetime"]["stats"] is None

        assert response.data[0]["lifetime"]["count"] == "55"
        assert response.data[0]["lifetime"]["firstSeen"] == parse_datetime(
            before_now_350_seconds  # Should match overridden value, not event value
        ).replace(tzinfo=timezone.utc)
        assert response.data[0]["lifetime"]["lastSeen"] == parse_datetime(
            before_now_100_seconds
        ).replace(tzinfo=timezone.utc)

    def test_inbox_search(self):
        with self.feature("organizations:inbox"):
            self.store_event(
                data={
                    "timestamp": iso_format(before_now(seconds=200)),
                    "fingerprint": ["group-1"],
                    "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
                },
                project_id=self.project.id,
            )

            event = self.store_event(
                data={
                    "timestamp": iso_format(before_now(seconds=200)),
                    "fingerprint": ["group-2"],
                    "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
                },
                project_id=self.project.id,
            )

            self.store_event(
                data={
                    "timestamp": iso_format(before_now(seconds=200)),
                    "fingerprint": ["group-3"],
                    "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
                },
                project_id=self.project.id,
            )

            add_group_to_inbox(event.group, GroupInboxReason.NEW)

            self.login_as(user=self.user)
            response = self.get_response(
                sort_by="date", limit=10, query="is:unresolved is:for_review", expand=["inbox"]
            )
            assert response.status_code == 200
            assert len(response.data) == 1
            assert int(response.data[0]["id"]) == event.group.id
            assert response.data[0]["inbox"] is not None
            assert response.data[0]["inbox"]["reason"] == GroupInboxReason.NEW.value

    def test_inbox_search_outside_retention(self):
        with self.feature("organizations:inbox"):
            self.login_as(user=self.user)
            response = self.get_response(
                sort="inbox",
                limit=10,
                query="is:unresolved is:for_review",
                collapse="stats",
                expand=["inbox", "owners"],
                start=iso_format(before_now(days=20)),
                end=iso_format(before_now(days=15)),
            )
            assert response.status_code == 200
            assert len(response.data) == 0

    def test_assigned_or_suggested_search(self):
        event = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=180)),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )
        event1 = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=185)),
                "fingerprint": ["group-2"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=190)),
                "fingerprint": ["group-3"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        assigned_event = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=195)),
                "fingerprint": ["group-4"],
            },
            project_id=self.project.id,
        )

        assigned_to_other_event = self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=195)),
                "fingerprint": ["group-5"],
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query="assigned_or_suggested:me")
        assert response.status_code == 200
        assert len(response.data) == 0

        GroupOwner.objects.create(
            group=assigned_to_other_event.group,
            project=assigned_to_other_event.group.project,
            organization=assigned_to_other_event.group.project.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=event.group,
            project=event.group.project,
            organization=event.group.project.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )

        response = self.get_response(sort_by="date", limit=10, query="assigned_or_suggested:me")
        assert response.status_code == 200
        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == event.group.id
        assert int(response.data[1]["id"]) == assigned_to_other_event.group.id

        # Because assigned_to_other_event is assigned to self.other_user, it should not show up in assigned_or_suggested search for anyone but self.other_user. (aka. they are now the only owner)
        other_user = self.create_user("other@user.com", is_superuser=False)
        GroupAssignee.objects.create(
            group=assigned_to_other_event.group,
            project=assigned_to_other_event.group.project,
            user=other_user,
        )
        response = self.get_response(sort_by="date", limit=10, query="assigned_or_suggested:me")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

        response = self.get_response(
            sort_by="date", limit=10, query=f"assigned_or_suggested:{other_user.email}"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == assigned_to_other_event.group.id

        GroupAssignee.objects.create(
            group=assigned_event.group, project=assigned_event.group.project, user=self.user
        )
        response = self.get_response(
            sort_by="date", limit=10, query=f"assigned_or_suggested:{self.user.email}"
        )
        assert response.status_code == 200
        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == event.group.id
        assert int(response.data[1]["id"]) == assigned_event.group.id

        response = self.get_response(
            sort_by="date", limit=10, query=f"assigned_or_suggested:#{self.team.slug}"
        )
        assert response.status_code == 200
        assert len(response.data) == 0
        GroupOwner.objects.create(
            group=event.group,
            project=event.group.project,
            organization=event.group.project.organization,
            type=0,
            team_id=self.team.id,
            user_id=None,
        )
        response = self.get_response(
            sort_by="date", limit=10, query=f"assigned_or_suggested:#{self.team.slug}"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

        response = self.get_response(
            sort_by="date", limit=10, query="assigned_or_suggested:me_or_none"
        )
        assert response.status_code == 200
        assert len(response.data) == 4
        assert int(response.data[0]["id"]) == event.group.id
        assert int(response.data[1]["id"]) == event1.group.id
        assert int(response.data[2]["id"]) == event2.group.id
        assert int(response.data[3]["id"]) == assigned_event.group.id

        not_me = self.create_user(email="notme@sentry.io")
        GroupOwner.objects.create(
            group=event2.group,
            project=event2.group.project,
            organization=event2.group.project.organization,
            type=0,
            team_id=None,
            user_id=not_me.id,
        )
        response = self.get_response(
            sort_by="date", limit=10, query="assigned_or_suggested:me_or_none"
        )
        assert response.status_code == 200
        assert len(response.data) == 3
        assert int(response.data[0]["id"]) == event.group.id
        assert int(response.data[1]["id"]) == event1.group.id
        assert int(response.data[2]["id"]) == assigned_event.group.id

        GroupOwner.objects.create(
            group=event2.group,
            project=event2.group.project,
            organization=event2.group.project.organization,
            type=0,
            team_id=None,
            user_id=self.user.id,
        )
        # Should now include event2 as it has shared ownership.
        response = self.get_response(
            sort_by="date", limit=10, query="assigned_or_suggested:me_or_none"
        )
        assert response.status_code == 200
        assert len(response.data) == 4
        assert int(response.data[0]["id"]) == event.group.id
        assert int(response.data[1]["id"]) == event1.group.id
        assert int(response.data[2]["id"]) == event2.group.id
        assert int(response.data[3]["id"]) == assigned_event.group.id

        # Assign group to another user and now it shouldn't show up in owner search for this team.
        GroupAssignee.objects.create(
            group=event.group,
            project=event.group.project,
            user=other_user,
        )
        response = self.get_response(
            sort_by="date", limit=10, query=f"assigned_or_suggested:#{self.team.slug}"
        )
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_aggregate_stats_regression_test(self):
        self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="times_seen:>0 last_seen:-1h date:-1h"
        )

        assert response.status_code == 200
        assert len(response.data) == 1

    def test_skipped_fields(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=200)),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        query = "server:example.com"
        query += " status:unresolved"
        query += " active_at:" + iso_format(before_now(seconds=350))
        query += " first_seen:" + iso_format(before_now(seconds=500))

        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query=query)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["lifetime"] is not None
        assert response.data[0]["filtered"] is not None

    def test_inbox_fields(self):
        with self.feature("organizations:inbox"):
            event = self.store_event(
                data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
                project_id=self.project.id,
            )
            add_group_to_inbox(event.group, GroupInboxReason.NEW)
            query = "status:unresolved"
            self.login_as(user=self.user)
            response = self.get_response(sort_by="date", limit=10, query=query, expand=["inbox"])

            assert response.status_code == 200
            assert len(response.data) == 1
            assert int(response.data[0]["id"]) == event.group.id
            assert response.data[0]["inbox"] is not None
            assert response.data[0]["inbox"]["reason"] == GroupInboxReason.NEW.value
            assert response.data[0]["inbox"]["reason_details"] is None
            remove_group_from_inbox(event.group)
            snooze_details = {
                "until": None,
                "count": 3,
                "window": None,
                "user_count": None,
                "user_window": 5,
            }
            add_group_to_inbox(event.group, GroupInboxReason.UNIGNORED, snooze_details)
            response = self.get_response(sort_by="date", limit=10, query=query, expand=["inbox"])

            assert response.status_code == 200
            assert len(response.data) == 1
            assert int(response.data[0]["id"]) == event.group.id
            assert response.data[0]["inbox"] is not None
            assert response.data[0]["inbox"]["reason"] == GroupInboxReason.UNIGNORED.value
            assert response.data[0]["inbox"]["reason_details"] == snooze_details

    def test_expand_string(self):
        with self.feature("organizations:inbox"):
            event = self.store_event(
                data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
                project_id=self.project.id,
            )
            add_group_to_inbox(event.group, GroupInboxReason.NEW)
            query = "status:unresolved"
            self.login_as(user=self.user)
            response = self.get_response(sort_by="date", limit=10, query=query, expand="inbox")
            assert response.status_code == 200
            assert len(response.data) == 1
            assert int(response.data[0]["id"]) == event.group.id
            assert response.data[0]["inbox"] is not None
            assert response.data[0]["inbox"]["reason"] == GroupInboxReason.NEW.value
            assert response.data[0]["inbox"]["reason_details"] is None

    def test_expand_owners(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        query = "status:unresolved"
        self.login_as(user=self.user)
        # Test with no owner
        response = self.get_response(sort_by="date", limit=10, query=query, expand="owners")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["owners"] is None

        # Test with owners
        GroupOwner.objects.create(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user=self.user,
        )
        GroupOwner.objects.create(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            team=self.team,
        )
        response = self.get_response(sort_by="date", limit=10, query=query, expand="owners")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["owners"] is not None
        assert len(response.data[0]["owners"]) == 2
        assert response.data[0]["owners"][0]["owner"] == f"user:{self.user.id}"
        assert response.data[0]["owners"][1]["owner"] == f"team:{self.team.id}"
        assert (
            response.data[0]["owners"][0]["type"] == GROUP_OWNER_TYPE[GroupOwnerType.SUSPECT_COMMIT]
        )
        assert (
            response.data[0]["owners"][1]["type"] == GROUP_OWNER_TYPE[GroupOwnerType.OWNERSHIP_RULE]
        )

    @patch(
        "sentry.api.helpers.group_index.ratelimiter.is_limited", autospec=True, return_value=True
    )
    def test_ratelimit(self, is_limited):
        self.login_as(user=self.user)
        self.get_valid_response(sort_by="date", limit=1, status_code=429)

    def test_collapse_stats(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="is:unresolved", expand="inbox", collapse="stats"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "stats" not in response.data[0]
        assert "firstSeen" not in response.data[0]
        assert "lastSeen" not in response.data[0]
        assert "count" not in response.data[0]
        assert "lifetime" not in response.data[0]
        assert "filtered" not in response.data[0]

    def test_collapse_lifetime(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="is:unresolved", collapse="lifetime"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "stats" in response.data[0]
        assert "firstSeen" in response.data[0]
        assert "lastSeen" in response.data[0]
        assert "count" in response.data[0]
        assert "lifetime" not in response.data[0]
        assert "filtered" in response.data[0]

    def test_collapse_filtered(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="is:unresolved", collapse="filtered"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "stats" in response.data[0]
        assert "firstSeen" in response.data[0]
        assert "lastSeen" in response.data[0]
        assert "count" in response.data[0]
        assert "lifetime" in response.data[0]
        assert "filtered" not in response.data[0]

    def test_collapse_lifetime_and_filtered(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="is:unresolved", collapse=["filtered", "lifetime"]
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "stats" in response.data[0]
        assert "firstSeen" in response.data[0]
        assert "lastSeen" in response.data[0]
        assert "count" in response.data[0]
        assert "lifetime" not in response.data[0]
        assert "filtered" not in response.data[0]

    def test_collapse_base(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="is:unresolved", collapse=["base"]
        )

        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "title" not in response.data[0]
        assert "hasSeen" not in response.data[0]
        assert "stats" in response.data[0]
        assert "firstSeen" in response.data[0]
        assert "lastSeen" in response.data[0]
        assert "count" in response.data[0]
        assert "lifetime" in response.data[0]
        assert "filtered" in response.data[0]

    def test_has_unhandled_flag_bug(self):
        # There was a bug where we tried to access attributes on seen_stats if this feature is active
        # but seen_stats could be null when we collapse stats.
        with self.feature(["organizations:inbox"]):
            self.test_collapse_stats()

    def test_collapse_stats_group_snooze_bug(self):
        # There was a bug where we tried to access attributes on seen_stats if this feature is active
        # but seen_stats could be null when we collapse stats.
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        GroupSnooze.objects.create(
            group=event.group,
            user_count=10,
            until=timezone.now() + timedelta(days=1),
            count=10,
            state={"times_seen": 0},
        )
        self.login_as(user=self.user)
        # The presence of the group above with attached GroupSnooze would have previously caused this error.
        response = self.get_response(
            sort_by="date", limit=10, query="is:unresolved", expand="inbox", collapse="stats"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id


class GroupUpdateTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-group-index"
    method = "put"

    def setUp(self):
        super().setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)

    def get_response(self, *args, **kwargs):
        if not args:
            org = self.project.organization.slug
        else:
            org = args[0]
        return super().get_response(org, **kwargs)

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
        response = self.get_valid_response(
            qs_params={"status": "unresolved", "project": self.project.id}, status="resolved"
        )
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

    def test_resolve_member(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)
        member = self.create_user()
        self.create_member(
            organization=self.organization, teams=group.project.teams.all(), user=member
        )

        self.login_as(user=member)
        response = self.get_valid_response(
            qs_params={"status": "unresolved", "project": self.project.id}, status="resolved"
        )
        assert response.data == {"status": "resolved", "statusDetails": {}}
        assert response.status_code == 200

    def test_bulk_resolve(self):
        self.login_as(user=self.user)

        for i in range(200):
            self.store_event(
                data={
                    "fingerprint": [i],
                    "timestamp": iso_format(self.min_ago - timedelta(seconds=i)),
                },
                project_id=self.project.id,
            )

        response = self.get_valid_response(query="is:unresolved", sort_by="date", method="get")
        assert len(response.data) == 100

        response = self.get_valid_response(qs_params={"status": "unresolved"}, status="resolved")
        assert response.data == {"status": "resolved", "statusDetails": {}}

        response = self.get_valid_response(query="is:unresolved", sort_by="date", method="get")
        assert len(response.data) == 0

    @patch("sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound")
    def test_resolve_with_integration(self, mock_sync_status_outbound):
        self.login_as(user=self.user)

        org = self.organization

        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)
        event = self.store_event(
            data={"timestamp": iso_format(self.min_ago)}, project_id=self.project.id
        )
        group = event.group

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

        response = self.get_valid_response(sort_by="date", query="is:unresolved", method="get")
        assert len(response.data) == 1

        with self.tasks():
            with self.feature({"organizations:integrations-issue-sync": True}):
                response = self.get_valid_response(
                    qs_params={"status": "unresolved"}, status="resolved"
                )
                group = Group.objects.get(id=group.id)
                assert group.status == GroupStatus.RESOLVED

                assert response.data == {"status": "resolved", "statusDetails": {}}
                mock_sync_status_outbound.assert_called_once_with(
                    external_issue, True, group.project_id
                )

        response = self.get_valid_response(sort_by="date", query="is:unresolved", method="get")
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

        with self.tasks():
            with self.feature({"organizations:integrations-issue-sync": True}):
                response = self.get_valid_response(qs_params={"id": group.id}, status="unresolved")
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
        response = self.get_valid_response(qs_params={"id": group.id}, status="resolved")
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

        response = self.get_valid_response(
            qs_params={"id": group.id}, status="resolvedInNextRelease"
        )
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
        with self.feature("organizations:global-views"):
            response = self.get_valid_response(
                qs_params={"id": [group1.id, group2.id], "group4": group4.id}, status="resolved"
            )
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

        response = self.get_valid_response(
            qs_params={"id": group.id}, status="resolved", statusDetails={"inRelease": "latest"}
        )
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

        response = self.get_valid_response(
            qs_params={"id": group.id},
            status="resolved",
            statusDetails={"inRelease": release.version},
        )
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

        response = self.get_valid_response(
            qs_params={"id": group.id}, status="resolved", statusDetails={"inNextRelease": True}
        )
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

        response = self.get_valid_response(
            qs_params={"id": group.id}, status="resolvedInNextRelease"
        )
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

        response = self.get_valid_response(
            qs_params={"id": group.id},
            status="resolved",
            statusDetails={"inCommit": {"commit": commit.key, "repository": repo.name}},
        )
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

        response = self.get_valid_response(
            qs_params={"id": group.id},
            status="resolved",
            statusDetails={"inCommit": {"commit": commit.key, "repository": repo.name}},
        )
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

        response = self.get_response(
            qs_params={"id": group.id},
            status="resolved",
            statusDetails={"inCommit": {"commit": "a" * 40, "repository": repo.name}},
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

        response = self.get_valid_response(qs_params={"id": group.id}, status="unresolved")
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

        response = self.get_valid_response(qs_params={"id": group.id}, status="unresolved")
        assert response.data == {"status": "unresolved", "statusDetails": {}}

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

    def test_basic_ignore(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)

        snooze = GroupSnooze.objects.create(group=group, until=timezone.now())

        self.login_as(user=self.user)

        response = self.get_valid_response(qs_params={"id": group.id}, status="ignored")
        # existing snooze objects should be cleaned up
        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.IGNORED

        assert response.data == {"status": "ignored", "statusDetails": {}}

    def test_snooze_duration(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.RESOLVED)

        self.login_as(user=self.user)

        response = self.get_valid_response(
            qs_params={"id": group.id}, status="ignored", ignoreDuration=30
        )
        snooze = GroupSnooze.objects.get(group=group)
        snooze.until = snooze.until

        now = timezone.now()

        assert snooze.count is None
        assert snooze.until > now + timedelta(minutes=29)
        assert snooze.until < now + timedelta(minutes=31)
        assert snooze.user_count is None
        assert snooze.user_window is None
        assert snooze.window is None

        response.data["statusDetails"]["ignoreUntil"] = response.data["statusDetails"][
            "ignoreUntil"
        ]

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

        response = self.get_valid_response(
            qs_params={"id": group.id}, status="ignored", ignoreCount=100
        )
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

        response = self.get_valid_response(
            qs_params={"id": group.id}, status="ignored", ignoreUserCount=10
        )
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
        with self.feature("organizations:global-views"):
            response = self.get_valid_response(
                qs_params={"id": [group1.id, group2.id], "group4": group4.id}, isBookmarked="true"
            )
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
        with self.feature("organizations:global-views"):
            response = self.get_valid_response(
                qs_params={"id": [group1.id, group2.id], "group4": group4.id}, isSubscribed="true"
            )
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
        response = self.get_valid_response(
            qs_params={"id": [group1.id, group2.id]}, isPublic="true"
        )
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
        response = self.get_valid_response(
            qs_params={"id": [group1.id, group2.id]}, isPublic="false"
        )
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
        with self.feature("organizations:global-views"):
            response = self.get_valid_response(
                qs_params={"id": [group1.id, group2.id], "group4": group4.id}, hasSeen="true"
            )
        assert response.data == {"hasSeen": True}

        r1 = GroupSeen.objects.filter(group=group1, user=self.user)
        assert r1.exists()

        r2 = GroupSeen.objects.filter(group=group2, user=self.user)
        assert r2.exists()

        r3 = GroupSeen.objects.filter(group=group3, user=self.user)
        assert not r3.exists()

        r4 = GroupSeen.objects.filter(group=group4, user=self.user)
        assert not r4.exists()

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
        response = self.get_valid_response(
            qs_params={"id": [group1.id, group2.id, group3.id]}, merge="1"
        )
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
        response = self.get_valid_response(qs_params={"id": group1.id}, assignedTo=user.username)
        assert response.data["assignedTo"]["id"] == str(user.id)
        assert response.data["assignedTo"]["type"] == "user"
        assert GroupAssignee.objects.filter(group=group1, user=user).exists()

        assert not GroupAssignee.objects.filter(group=group2, user=user).exists()

        assert Activity.objects.filter(group=group1, user=user, type=Activity.ASSIGNED).count() == 1

        assert GroupSubscription.objects.filter(user=user, group=group1, is_active=True).exists()

        response = self.get_valid_response(qs_params={"id": group1.id}, assignedTo="")
        assert response.data["assignedTo"] is None

        assert not GroupAssignee.objects.filter(group=group1, user=user).exists()

    def test_assign_non_member(self):
        group = self.create_group(checksum="a" * 32, is_public=True)
        member = self.user
        non_member = self.create_user("bar@example.com")

        self.login_as(user=member)

        response = self.get_response(qs_params={"id": group.id}, assignedTo=non_member.username)
        assert response.status_code == 400, response.content

    def test_assign_team(self):
        self.login_as(user=self.user)

        group = self.create_group()
        other_member = self.create_user("bar@example.com")
        team = self.create_team(
            organization=group.project.organization, members=[self.user, other_member]
        )

        group.project.add_team(team)

        response = self.get_valid_response(qs_params={"id": group.id}, assignedTo=f"team:{team.id}")
        assert response.data["assignedTo"]["id"] == str(team.id)
        assert response.data["assignedTo"]["type"] == "team"
        assert GroupAssignee.objects.filter(group=group, team=team).exists()

        assert Activity.objects.filter(group=group, type=Activity.ASSIGNED).count() == 1

        assert GroupSubscription.objects.filter(group=group, is_active=True).count() == 2

        response = self.get_valid_response(qs_params={"id": group.id}, assignedTo="")
        assert response.data["assignedTo"] is None

    def test_discard(self):
        group1 = self.create_group(checksum="a" * 32, is_public=True)
        group2 = self.create_group(checksum="b" * 32, is_public=True)
        group_hash = GroupHash.objects.create(hash="x" * 32, project=group1.project, group=group1)
        user = self.user

        self.login_as(user=user)
        with self.tasks():
            with self.feature("projects:discard-groups"):
                response = self.get_response(qs_params={"id": group1.id}, discard=True)

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
        "sentry.api.helpers.group_index.ratelimiter.is_limited", autospec=True, return_value=True
    )
    def test_ratelimit(self, is_limited):
        self.login_as(user=self.user)
        self.get_valid_response(sort_by="date", limit=1, status_code=429)

    def test_set_inbox(self):
        group1 = self.create_group(checksum="a" * 32)
        group2 = self.create_group(checksum="b" * 32)

        self.login_as(user=self.user)
        response = self.get_valid_response(qs_params={"id": [group1.id, group2.id]}, inbox="true")
        assert response.data == {"inbox": True}
        assert GroupInbox.objects.filter(group=group1).exists()
        assert GroupInbox.objects.filter(group=group2).exists()

        response = self.get_valid_response(qs_params={"id": [group2.id]}, inbox="false")
        assert response.data == {"inbox": False}
        assert GroupInbox.objects.filter(group=group1).exists()
        assert not GroupInbox.objects.filter(group=group2).exists()

    def test_set_resolved_inbox(self):
        group1 = self.create_group(checksum="a" * 32)
        group2 = self.create_group(checksum="b" * 32)

        self.login_as(user=self.user)
        with self.feature("organizations:inbox"):
            response = self.get_valid_response(
                qs_params={"id": [group1.id, group2.id]}, status="resolved"
            )
        assert response.data["inbox"] is None
        assert not GroupInbox.objects.filter(group=group1).exists()
        assert not GroupInbox.objects.filter(group=group2).exists()

        with self.feature("organizations:inbox"):
            response = self.get_valid_response(qs_params={"id": [group2.id]}, status="unresolved")
        assert not GroupInbox.objects.filter(group=group1).exists()
        assert not GroupInbox.objects.filter(group=group2).exists()


class GroupDeleteTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-group-index"
    method = "delete"

    def get_response(self, *args, **kwargs):
        if not args:
            org = self.project.organization.slug
        else:
            org = args[0]
        return super().get_response(org, **kwargs)

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
        with self.feature("organizations:global-views"):
            response = self.get_response(
                qs_params={"id": [group1.id, group2.id], "group4": group4.id}
            )

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
            with self.feature("organizations:global-views"):
                response = self.get_response(
                    qs_params={"id": [group1.id, group2.id], "group4": group4.id}
                )

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
        response = self.get_response(qs_params={"query": ""})
        assert response.status_code == 204

        for group in groups:
            assert Group.objects.get(id=group.id).status == GroupStatus.PENDING_DELETION
            assert not GroupHash.objects.filter(group_id=group.id).exists()

        Group.objects.filter(id__in=[group.id for group in groups]).update(
            status=GroupStatus.UNRESOLVED
        )

        with self.tasks():
            response = self.get_response(qs_params={"query": ""})

        assert response.status_code == 204

        for group in groups:
            assert not Group.objects.filter(id=group.id).exists()
            assert not GroupHash.objects.filter(group_id=group.id).exists()

    @patch(
        "sentry.api.helpers.group_index.ratelimiter.is_limited", autospec=True, return_value=True
    )
    def test_ratelimit(self, is_limited):
        self.login_as(user=self.user)
        self.get_valid_response(sort_by="date", limit=1, status_code=429)
