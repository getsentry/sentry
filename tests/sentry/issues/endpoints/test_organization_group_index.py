from __future__ import annotations

import functools
from collections.abc import Sequence
from datetime import datetime, timedelta
from time import sleep
from unittest.mock import MagicMock, Mock, call, patch
from uuid import uuid4

from django.db import OperationalError
from django.urls import reverse
from django.utils import timezone

from sentry import options
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, create_feedback_issue
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.issues.grouptype import (
    FeedbackGroup,
    PerformanceNPlusOneGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.models.activity import Activity
from sentry.models.apitoken import ApiToken
from sentry.models.environment import Environment
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphash import GroupHash
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import (
    GroupInbox,
    GroupInboxReason,
    InboxReasonDetails,
    add_group_to_inbox,
    remove_group_from_inbox,
)
from sentry.models.grouplink import GroupLink
from sentry.models.groupopenperiod import GroupOpenPeriod, get_latest_open_period
from sentry.models.groupowner import GROUP_OWNER_TYPE, GroupOwner, GroupOwnerType
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.grouptombstone import GroupTombstone
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseStages
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.search.events.constants import (
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.snuba.executors import GroupAttributesPostgresSnubaQueryExecutor
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import Feature, apply_feature_flag_on_cls, with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel
from sentry.users.models.user_option import UserOption
from sentry.utils import json
from tests.sentry.feedback.usecases.test_create_feedback import mock_feedback_event
from tests.sentry.issues.test_utils import SearchIssueTestMixin


@apply_feature_flag_on_cls("organizations:issue-search-snuba")
@patch(
    "sentry.search.snuba.executors.GroupAttributesPostgresSnubaQueryExecutor.query",
    side_effect=GroupAttributesPostgresSnubaQueryExecutor.query,
    autospec=True,
)
class GroupListTest(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    endpoint = "sentry-api-0-organization-group-index"

    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def _parse_links(self, header: str) -> dict[str | None, dict[str, str | None]]:
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

    def test_sort_by_date_with_tag(self, _: MagicMock) -> None:
        # XXX(dcramer): this tests a case where an ambiguous column name existed
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": before_now(seconds=1).isoformat()},
            project_id=self.project.id,
        )
        group = event.group
        self.login_as(user=self.user)

        response = self.get_success_response(sort_by="date", query="is:unresolved")
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group.id)

    def test_query_for_archived(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": before_now(seconds=1).isoformat()},
            project_id=self.project.id,
        )
        group = event.group
        group.status = GroupStatus.IGNORED
        group.substatus = None
        group.save()
        self.login_as(user=self.user)

        response = self.get_success_response(sort_by="date", query="is:archived")
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group.id)

    def test_sort_by_trends(self, mock_query: MagicMock) -> None:
        group = self.store_event(
            data={
                "timestamp": before_now(seconds=10).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        self.store_event(
            data={
                "timestamp": before_now(seconds=10).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(hours=13).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        group_2 = self.store_event(
            data={
                "timestamp": before_now(seconds=5).isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        self.store_event(
            data={
                "timestamp": before_now(hours=13).isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        aggregate_kwargs: dict[str, str] = {
            "log_level": "3",
            "has_stacktrace": "5",
            "relative_volume": "1",
            "event_halflife_hours": "4",
            "issue_halflife_hours": "4",
            "v2": "true",
            "norm": "False",
        }

        response = self.get_success_response(
            sort="trends",
            query="is:unresolved",
            limit=25,
            start=before_now(days=1).isoformat(),
            end=before_now(seconds=1).isoformat(),
            **aggregate_kwargs,
        )
        assert len(response.data) == 2
        assert [item["id"] for item in response.data] == [str(group.id), str(group_2.id)]
        assert not mock_query.called

    def test_sort_by_inbox(self, _: MagicMock) -> None:
        group_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        inbox_1 = add_group_to_inbox(group_1, GroupInboxReason.NEW)
        group_2 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        ).group
        inbox_2 = add_group_to_inbox(group_2, GroupInboxReason.NEW)
        inbox_2.update(date_added=inbox_1.date_added - timedelta(hours=1))

        self.login_as(user=self.user)
        response = self.get_success_response(
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

    def test_sort_by_inbox_me_or_none(self, _: MagicMock) -> None:
        group_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        ).group
        inbox_1 = add_group_to_inbox(group_1, GroupInboxReason.NEW)
        group_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
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
            user_id=self.user.id,
        )
        owner_by_other = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
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
            user_id=other_user.id,
        )

        owned_me_assigned_to_other = self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
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
            user_id=self.user.id,
        )

        unowned_assigned_to_other = self.store_event(
            data={
                "event_id": "e" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["group-5"],
            },
            project_id=self.project.id,
        ).group
        inbox_5 = add_group_to_inbox(unowned_assigned_to_other, GroupInboxReason.NEW)
        inbox_5.update(date_added=inbox_1.date_added - timedelta(hours=1))
        GroupAssignee.objects.assign(unowned_assigned_to_other, other_user)

        self.login_as(user=self.user)
        response = self.get_success_response(
            sort="inbox",
            query="is:unresolved is:for_review assigned_or_suggested:[me, none]",
            limit=10,
        )
        assert [item["id"] for item in response.data] == [str(group_1.id), str(group_2.id)]

    def test_trace_search(self, _: MagicMock) -> None:
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
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
        response = self.get_success_response(
            sort_by="date", query="is:unresolved trace:a7d67cf796774551a95be6543cacd459"
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)

        response = self.get_success_response(
            sort_by="date",
            query="is:unresolved trace:a7d67cf796774551a95be6543cacd459",
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)

    def test_feature_gate(self, _: MagicMock) -> None:
        # ensure there are two or more projects
        self.create_project(organization=self.project.organization)
        self.login_as(user=self.user)

        response = self.get_response()
        assert response.status_code == 400
        assert response.data["detail"] == "You do not have the multi project stream feature enabled"

        with self.feature("organizations:global-views"):
            response = self.get_response()
            assert response.status_code == 200

    def test_replay_feature_gate(self, _: MagicMock) -> None:
        # allow replays to query for backend
        self.create_project(organization=self.project.organization)
        self.login_as(user=self.user)
        self.get_success_response(extra_headers={"HTTP_X-Sentry-Replay-Request": "1"})

    def test_with_all_projects(self, _: MagicMock) -> None:
        # ensure there are two or more projects
        self.create_project(organization=self.project.organization)
        self.login_as(user=self.user)

        with self.feature("organizations:global-views"):
            response = self.get_success_response(project_id=[-1])
            assert response.status_code == 200

    def test_boolean_search_feature_flag(self, _: MagicMock) -> None:
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

    def test_invalid_query(self, _: MagicMock) -> None:
        now = timezone.now()
        self.create_group(last_seen=now - timedelta(seconds=1))
        self.login_as(user=self.user)

        response = self.get_response(sort_by="date", query="timesSeen:>1t")
        assert response.status_code == 400
        assert "Invalid number" in response.data["detail"]

    def test_valid_numeric_query(self, _: MagicMock) -> None:
        now = timezone.now()
        self.create_group(last_seen=now - timedelta(seconds=1))
        self.login_as(user=self.user)

        response = self.get_response(sort_by="date", query="timesSeen:>1k")
        assert response.status_code == 200

    def test_invalid_sort_key(self, _: MagicMock) -> None:
        now = timezone.now()
        self.create_group(last_seen=now - timedelta(seconds=1))
        self.login_as(user=self.user)

        response = self.get_response(sort="meow", query="is:unresolved")
        assert response.status_code == 400

    def test_simple_pagination(self, _: MagicMock) -> None:
        event1 = self.store_event(
            data={"timestamp": before_now(seconds=2).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group1 = event1.group
        event2 = self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        group2 = event2.group
        self.login_as(user=self.user)
        response = self.get_success_response(sort_by="date", limit=1)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group2.id)

        links = self._parse_links(response["Link"])

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"
        assert links["next"]["href"] is not None

        response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group1.id)

        links = self._parse_links(response["Link"])

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

    def test_stats_period(self, _: MagicMock) -> None:
        # TODO(dcramer): this test really only checks if validation happens
        # on groupStatsPeriod
        now = timezone.now()
        self.create_group(last_seen=now - timedelta(seconds=1))
        self.create_group(last_seen=now)

        self.login_as(user=self.user)

        self.get_success_response(groupStatsPeriod="24h")
        self.get_success_response(groupStatsPeriod="14d")
        self.get_success_response(groupStatsPeriod="")
        response = self.get_response(groupStatsPeriod="48h")
        assert response.status_code == 400

    def test_environment(self, _: MagicMock) -> None:
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": self.min_ago.isoformat(),
                "environment": "production",
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group2"],
                "timestamp": self.min_ago.isoformat(),
                "environment": "staging",
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        sleep(1)

        response = self.get_success_response(environment="production")
        assert len(response.data) == 1

        response = self.get_response(environment="garbage")
        assert response.status_code == 404

    def test_project(self, _: MagicMock) -> None:
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": self.min_ago.isoformat(),
                "environment": "production",
            },
            project_id=self.project.id,
        )
        project = self.project

        self.login_as(user=self.user)
        response = self.get_success_response(query=f"project:{project.slug}")
        assert len(response.data) == 1

        response = self.get_success_response(query=f"project:{project.slug}")
        assert len(response.data) == 1

    def test_auto_resolved(self, _: MagicMock) -> None:
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": before_now(seconds=1).isoformat()},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"event_id": "b" * 32, "timestamp": before_now(seconds=1).isoformat()},
            project_id=project.id,
        )
        group2 = event2.group

        self.login_as(user=self.user)
        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group2.id)

    def test_perf_issue(self, _: MagicMock) -> None:
        perf_group = self.create_group(type=PerformanceNPlusOneGroupType.type_id)
        self.login_as(user=self.user)
        with self.feature(
            {
                "organizations:issue-search-allow-postgres-only-search": True,
                "organizations:issue-search-snuba": False,
            }
        ):
            response = self.get_success_response(query="issue.category:performance")
            assert len(response.data) == 1
            assert response.data[0]["id"] == str(perf_group.id)

    def test_lookup_by_event_id(self, _: MagicMock) -> None:
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        event_id = "c" * 32
        event = self.store_event(
            data={"event_id": event_id, "timestamp": self.min_ago.isoformat()},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        response = self.get_success_response(query="c" * 32)
        assert response["X-Sentry-Direct-Hit"] == "1"
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event_id

    def test_lookup_by_event_id_incorrect_project_id(self, _: MagicMock) -> None:
        self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago.isoformat()},
            project_id=self.project.id,
        )
        event_id = "b" * 32
        event = self.store_event(
            data={"event_id": event_id, "timestamp": self.min_ago.isoformat()},
            project_id=self.project.id,
        )

        other_project = self.create_project(teams=[self.team])
        user = self.create_user()
        self.create_member(organization=self.organization, teams=[self.team], user=user)
        self.login_as(user=user)

        with self.feature("organizations:global-views"):
            response = self.get_success_response(query=event_id, project=[other_project.id])
        assert response["X-Sentry-Direct-Hit"] == "1"
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event_id

    def test_lookup_by_event_id_with_whitespace(self, _: MagicMock) -> None:
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        event_id = "c" * 32
        event = self.store_event(
            data={"event_id": event_id, "timestamp": self.min_ago.isoformat()},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_success_response(query="  {}  ".format("c" * 32))
        assert response["X-Sentry-Direct-Hit"] == "1"
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group.id)
        assert response.data[0]["matchingEventId"] == event_id

    def test_lookup_by_unknown_event_id(self, _: MagicMock) -> None:
        project = self.project
        project.update_option("sentry:resolve_age", 1)
        self.create_group()
        self.create_group()

        self.login_as(user=self.user)
        response = self.get_success_response(query="c" * 32)
        assert len(response.data) == 0

    def test_lookup_by_short_id(self, _: MagicMock) -> None:
        group = self.group
        short_id = group.qualified_short_id

        self.login_as(user=self.user)
        response = self.get_success_response(query=short_id, shortIdLookup=1)
        assert len(response.data) == 1
        assert response["X-Sentry-Direct-Hit"] == "1"

    def test_lookup_by_short_id_alias(self, _: MagicMock) -> None:
        event_id = "f" * 32
        group = self.store_event(
            data={"event_id": event_id, "timestamp": before_now(seconds=1).isoformat()},
            project_id=self.project.id,
        ).group
        short_id = group.qualified_short_id

        self.login_as(user=self.user)
        response = self.get_success_response(query=f"issue:{short_id}", shortIdLookup=1)
        assert len(response.data) == 1
        assert response["X-Sentry-Direct-Hit"] == "1"

    def test_lookup_by_multiple_short_id_alias(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        project2 = self.create_project(name="baz", organization=project.organization)
        event = self.store_event(
            data={"timestamp": before_now(seconds=2).isoformat()},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat()},
            project_id=project2.id,
        )
        with self.feature("organizations:global-views"):
            response = self.get_success_response(
                query=f"issue:[{event.group.qualified_short_id},{event2.group.qualified_short_id}]",
                shortIdLookup=1,
            )
        assert len(response.data) == 2
        assert response.get("X-Sentry-Direct-Hit") != "1"

        with self.feature("organizations:global-views"):
            response = self.get_success_response(
                query=f"issue:[{event.group.qualified_short_id},{event2.group.qualified_short_id}]",
                shortIdLookup=1,
            )
        assert len(response.data) == 2
        assert response.get("X-Sentry-Direct-Hit") != "1"

    def test_lookup_by_short_id_ignores_project_list(self, _: MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        project2 = self.create_project(organization=organization)
        group = self.create_group(project=project2)
        user = self.create_user()
        self.create_member(organization=organization, user=user)

        short_id = group.qualified_short_id

        self.login_as(user=user)

        response = self.get_success_response(
            organization.slug, project=project.id, query=short_id, shortIdLookup=1
        )
        assert len(response.data) == 1
        assert response.get("X-Sentry-Direct-Hit") == "1"

    def test_lookup_by_short_id_no_perms(self, _: MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(organization=organization, user=user, has_global_access=False)

        short_id = group.qualified_short_id

        self.login_as(user=user)

        response = self.get_success_response(organization.slug, query=short_id, shortIdLookup=1)
        assert len(response.data) == 0
        assert response.get("X-Sentry-Direct-Hit") != "1"

    def test_lookup_by_group_id(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        response = self.get_success_response(group=self.group.id)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.group.id)
        group_2 = self.create_group()
        response = self.get_success_response(group=[self.group.id, group_2.id])
        assert {g["id"] for g in response.data} == {str(self.group.id), str(group_2.id)}

    def test_lookup_by_group_id_no_perms(self, _: MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(organization=organization, user=user, has_global_access=False)
        self.login_as(user=user)
        response = self.get_response(group=[group.id])
        assert response.status_code == 403

    def test_lookup_by_first_release(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        project2 = self.create_project(name="baz", organization=project.organization)
        release = Release.objects.create(organization=project.organization, version="12345")
        release.add_project(project)
        release.add_project(project2)
        event = self.store_event(
            data={"release": release.version, "timestamp": before_now(seconds=2).isoformat()},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"release": release.version, "timestamp": before_now(seconds=1).isoformat()},
            project_id=project2.id,
        )

        with self.feature("organizations:global-views"):
            response = self.get_success_response(
                **{"query": 'first-release:"%s"' % release.version}
            )
        issues = json.loads(response.content)
        assert len(issues) == 2
        assert int(issues[0]["id"]) == event2.group.id
        assert int(issues[1]["id"]) == event.group.id

        with self.feature("organizations:global-views"):
            response = self.get_success_response(
                **{"query": 'first-release:"%s"' % release.version}
            )
        issues = json.loads(response.content)
        assert len(issues) == 2
        assert int(issues[0]["id"]) == event2.group.id
        assert int(issues[1]["id"]) == event.group.id

    def test_lookup_by_release(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        release = Release.objects.create(organization=project.organization, version="12345")
        release.add_project(project)
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "tags": {"sentry:release": release.version},
            },
            project_id=project.id,
        )

        response = self.get_success_response(release=release.version)
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event.group.id

    def test_release_package_in(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        release1 = Release.objects.create(organization=project.organization, version="foo@1.0.0.0")
        release2 = Release.objects.create(organization=project.organization, version="bar@1.2.0.0")
        release3 = Release.objects.create(organization=project.organization, version="cat@1.2.0.0")

        release1.add_project(project)
        release2.add_project(project)

        event1 = self.store_event(
            data={
                "release": release1.version,
                "timestamp": before_now(seconds=3).isoformat(),
                "fingerprint": ["1"],
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "release": release2.version,
                "timestamp": before_now(seconds=2).isoformat(),
                "fingerprint": ["2"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "release": release3.version,
                "timestamp": before_now(seconds=2).isoformat(),
                "fingerprint": ["3"],
            },
            project_id=project.id,
        )

        with self.feature("organizations:global-views"):
            response = self.get_success_response(**{"query": 'release.package:["foo", "bar"]'})
        issues = json.loads(response.content)
        assert len(issues) == 2
        assert int(issues[0]["id"]) == event2.group.id
        assert int(issues[1]["id"]) == event1.group.id

    def test_lookup_by_release_wildcard(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        release = Release.objects.create(organization=project.organization, version="12345")
        release.add_project(project)
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "tags": {"sentry:release": release.version},
            },
            project_id=project.id,
        )

        response = self.get_success_response(release=release.version[:3] + "*")
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event.group.id

    def test_lookup_by_regressed_in_release(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        release = self.create_release()
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "tags": {"sentry:release": release.version},
            },
            project_id=project.id,
        )
        record_group_history(event.group, GroupHistoryStatus.REGRESSED, release=release)
        response = self.get_success_response(query=f"regressed_in_release:{release.version}")
        issues = json.loads(response.content)
        assert [int(issue["id"]) for issue in issues] == [event.group.id]

    def test_pending_delete_pending_merge_excluded(self, _: MagicMock) -> None:
        events = []
        for i in "abcd":
            events.append(
                self.store_event(
                    data={
                        "event_id": i * 32,
                        "fingerprint": [i],
                        "timestamp": self.min_ago.isoformat(),
                    },
                    project_id=self.project.id,
                )
            )
        events[0].group.update(status=GroupStatus.PENDING_DELETION, substatus=None)
        events[2].group.update(status=GroupStatus.DELETION_IN_PROGRESS, substatus=None)
        events[3].group.update(status=GroupStatus.PENDING_MERGE, substatus=None)

        self.login_as(user=self.user)

        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(events[1].group.id)

    def test_filters_based_on_retention(self, _: MagicMock) -> None:
        self.login_as(user=self.user)

        self.create_group(last_seen=timezone.now() - timedelta(days=2))

        with self.options({"system.event-retention-days": 1}):
            response = self.get_success_response()

        assert len(response.data) == 0

    def test_token_auth(self, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read"])
        response = self.client.get(
            reverse("sentry-api-0-organization-group-index", args=[self.project.organization.slug]),
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code == 200, response.content

    def test_date_range(self, _: MagicMock) -> None:
        with self.options({"system.event-retention-days": 2}):
            event = self.store_event(
                data={"timestamp": before_now(hours=5).isoformat()}, project_id=self.project.id
            )
            group = event.group

            self.login_as(user=self.user)

            response = self.get_success_response(statsPeriod="6h")
            assert len(response.data) == 1
            assert response.data[0]["id"] == str(group.id)

            response = self.get_success_response(statsPeriod="1h")
            assert len(response.data) == 0

    @patch("sentry.analytics.record")
    def test_advanced_search_errors(self, mock_record: MagicMock, _: MagicMock) -> None:
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
    @with_feature({"organizations:issue-search-snuba": False})
    def test_assigned_to_pagination(self, patched_params_update: MagicMock, _: MagicMock) -> None:
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
                    "timestamp": before_now(days=day).isoformat(),
                    "fingerprint": [f"group-{day}"],
                },
                project_id=self.project.id,
            ).group
            groups.append(group)

        assigned_groups = groups[:2]
        for ag in assigned_groups:
            ag.update(
                status=GroupStatus.RESOLVED, resolved_at=before_now(seconds=5), substatus=None
            )
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

    def test_assigned_me_none(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        groups = []
        for i in range(5):
            group = self.store_event(
                data={
                    "timestamp": before_now(minutes=10, days=i).isoformat(),
                    "fingerprint": [f"group-{i}"],
                },
                project_id=self.project.id,
            ).group
            groups.append(group)

        assigned_groups = groups[:2]
        for ag in assigned_groups:
            GroupAssignee.objects.assign(ag, self.user)

        response = self.get_response(limit=10, query="assigned:me")
        assert [row["id"] for row in response.data] == [str(g.id) for g in assigned_groups]

        response = self.get_response(limit=10, query="assigned:[me, none]")
        assert len(response.data) == 5

        GroupAssignee.objects.assign(assigned_groups[1], self.create_user("other@user.com"))
        sleep(1)

        response = self.get_response(limit=10, query="assigned:[me, none]")
        assert len(response.data) == 4

    def test_seen_stats(self, _: MagicMock) -> None:
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        before_now_300_seconds = before_now(seconds=300).isoformat()
        before_now_350_seconds = before_now(seconds=350).isoformat()
        event2 = self.store_event(
            data={"timestamp": before_now_300_seconds, "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        group2 = event2.group
        group2.first_seen = datetime.fromisoformat(before_now_350_seconds)
        group2.times_seen = 55
        group2.save()
        before_now_250_seconds = before_now(seconds=250).replace(microsecond=0).isoformat()
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
                "timestamp": before_now(seconds=200).isoformat(),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )
        before_now_150_seconds = before_now(seconds=150).replace(microsecond=0).isoformat()
        self.store_event(
            data={
                "timestamp": before_now_150_seconds,
                "fingerprint": ["group-2"],
                "tags": {"trace": "ribbit", "server": "example.com"},
            },
            project_id=self.project.id,
        )
        before_now_100_seconds = before_now(seconds=100).replace(microsecond=0).isoformat()
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

        assert response.data[0]["lifetime"]["firstSeen"] == datetime.fromisoformat(
            before_now_350_seconds  # Should match overridden value, not event value
        )
        assert response.data[0]["lifetime"]["lastSeen"] == datetime.fromisoformat(
            before_now_100_seconds
        )
        assert response.data[0]["lifetime"]["count"] == "55"

        assert response.data[0]["filtered"]["count"] == "2"
        assert response.data[0]["filtered"]["firstSeen"] == datetime.fromisoformat(
            before_now_250_seconds
        )
        assert response.data[0]["filtered"]["lastSeen"] == datetime.fromisoformat(
            before_now_150_seconds
        )

        # Empty filter test:
        response = self.get_response(sort_by="date", limit=10, query="")
        assert response.status_code == 200
        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == group2.id
        assert response.data[0]["lifetime"] is not None
        assert response.data[0]["filtered"] is None
        assert response.data[0]["lifetime"]["stats"] is None

        assert response.data[0]["lifetime"]["count"] == "55"
        assert response.data[0]["lifetime"]["firstSeen"] == datetime.fromisoformat(
            before_now_350_seconds  # Should match overridden value, not event value
        )
        assert response.data[0]["lifetime"]["lastSeen"] == datetime.fromisoformat(
            before_now_100_seconds
        )

        # now with useGroupSnubaDataset = 1
        response = self.get_response(sort_by="date", limit=10, query="server:example.com")

        assert response.status_code == 200
        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == group2.id

    def test_semver_seen_stats(self, _: MagicMock) -> None:
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        release_3 = self.create_release(version="test@1.2.5")

        release_1_e_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=5).replace(microsecond=0).isoformat(),
                "fingerprint": ["group-1"],
                "release": release_1.version,
            },
            project_id=self.project.id,
        )
        group_1 = release_1_e_1.group

        release_2_e_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=3).replace(microsecond=0).isoformat(),
                "fingerprint": ["group-1"],
                "release": release_2.version,
            },
            project_id=self.project.id,
        )

        release_3_e_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).replace(microsecond=0).isoformat(),
                "fingerprint": ["group-1"],
                "release": release_3.version,
            },
            project_id=self.project.id,
        )

        group_1.update(times_seen=3)

        self.login_as(user=self.user)
        response = self.get_success_response(
            sort_by="date", limit=10, query="release.version:1.2.3"
        )
        assert [int(row["id"]) for row in response.data] == [group_1.id]
        group_data = response.data[0]
        assert group_data["lifetime"]["firstSeen"] == release_1_e_1.datetime
        assert group_data["filtered"]["firstSeen"] == release_1_e_1.datetime
        assert group_data["lifetime"]["lastSeen"] == release_3_e_1.datetime
        assert group_data["filtered"]["lastSeen"] == release_1_e_1.datetime
        assert int(group_data["lifetime"]["count"]) == 3
        assert int(group_data["filtered"]["count"]) == 1

        response = self.get_success_response(
            sort_by="date", limit=10, query="release.version:>=1.2.3"
        )
        assert [int(row["id"]) for row in response.data] == [group_1.id]
        group_data = response.data[0]
        assert group_data["lifetime"]["firstSeen"] == release_1_e_1.datetime
        assert group_data["filtered"]["firstSeen"] == release_1_e_1.datetime
        assert group_data["lifetime"]["lastSeen"] == release_3_e_1.datetime
        assert group_data["filtered"]["lastSeen"] == release_3_e_1.datetime
        assert int(group_data["lifetime"]["count"]) == 3
        assert int(group_data["filtered"]["count"]) == 3

        response = self.get_success_response(
            sort_by="date", limit=10, query="release.version:=1.2.4"
        )
        assert [int(row["id"]) for row in response.data] == [group_1.id]
        group_data = response.data[0]
        assert group_data["lifetime"]["firstSeen"] == release_1_e_1.datetime
        assert group_data["filtered"]["firstSeen"] == release_2_e_1.datetime
        assert group_data["lifetime"]["lastSeen"] == release_3_e_1.datetime
        assert group_data["filtered"]["lastSeen"] == release_2_e_1.datetime
        assert int(group_data["lifetime"]["count"]) == 3
        assert int(group_data["filtered"]["count"]) == 1

    def test_inbox_search(self, _: MagicMock) -> None:
        self.store_event(
            data={
                "timestamp": before_now(seconds=200).isoformat(),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        event = self.store_event(
            data={
                "timestamp": before_now(seconds=200).isoformat(),
                "fingerprint": ["group-2"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "timestamp": before_now(seconds=200).isoformat(),
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

    def test_inbox_search_outside_retention(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        response = self.get_response(
            sort="inbox",
            limit=10,
            query="is:unresolved is:for_review",
            collapse="stats",
            expand=["inbox", "owners"],
            start=before_now(days=20).isoformat(),
            end=before_now(days=15).isoformat(),
        )
        assert response.status_code == 200
        assert len(response.data) == 0

    @with_feature({"organizations:issue-search-snuba": False})
    def test_assigned_or_suggested_search(self, _: MagicMock) -> None:
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=180).isoformat(),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )
        event1 = self.store_event(
            data={
                "timestamp": before_now(seconds=185).isoformat(),
                "fingerprint": ["group-2"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "timestamp": before_now(seconds=190).isoformat(),
                "fingerprint": ["group-3"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        assigned_event = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
                "fingerprint": ["group-4"],
            },
            project_id=self.project.id,
        )

        assigned_to_other_event = self.store_event(
            data={
                "timestamp": before_now(seconds=195).isoformat(),
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
            user_id=other_user.id,
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
            group=assigned_event.group, project=assigned_event.group.project, user_id=self.user.id
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
            sort_by="date", limit=10, query="assigned_or_suggested:[me, none]"
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
            sort_by="date", limit=10, query="assigned_or_suggested:[me, none]"
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
            sort_by="date", limit=10, query="assigned_or_suggested:[me, none]"
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
            user_id=other_user.id,
        )
        response = self.get_response(
            sort_by="date", limit=10, query=f"assigned_or_suggested:#{self.team.slug}"
        )
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_semver(self, _: MagicMock) -> None:
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        release_3 = self.create_release(version="test@1.2.5")

        release_1_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-1"],
                "release": release_1.version,
            },
            project_id=self.project.id,
        ).group.id
        release_1_g_2 = self.store_event(
            data={
                "timestamp": before_now(minutes=2).isoformat(),
                "fingerprint": ["group-2"],
                "release": release_1.version,
            },
            project_id=self.project.id,
        ).group.id
        release_2_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=3).isoformat(),
                "fingerprint": ["group-3"],
                "release": release_2.version,
            },
            project_id=self.project.id,
        ).group.id
        release_2_g_2 = self.store_event(
            data={
                "timestamp": before_now(minutes=4).isoformat(),
                "fingerprint": ["group-4"],
                "release": release_2.version,
            },
            project_id=self.project.id,
        ).group.id
        release_3_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=5).isoformat(),
                "fingerprint": ["group-5"],
                "release": release_3.version,
            },
            project_id=self.project.id,
        ).group.id
        release_3_g_2 = self.store_event(
            data={
                "timestamp": before_now(minutes=6).isoformat(),
                "fingerprint": ["group-6"],
                "release": release_3.version,
            },
            project_id=self.project.id,
        ).group.id
        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_ALIAS}:>1.2.3")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            release_2_g_1,
            release_2_g_2,
            release_3_g_1,
            release_3_g_2,
        ]

        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_ALIAS}:>=1.2.3")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            release_1_g_1,
            release_1_g_2,
            release_2_g_1,
            release_2_g_2,
            release_3_g_1,
            release_3_g_2,
        ]

        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_ALIAS}:<1.2.4")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [release_1_g_1, release_1_g_2]

        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_ALIAS}:<1.0")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == []

        response = self.get_response(sort_by="date", limit=10, query=f"!{SEMVER_ALIAS}:1.2.4")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            release_1_g_1,
            release_1_g_2,
            release_3_g_1,
            release_3_g_2,
        ]

    def test_release_stage(self, _: MagicMock) -> None:
        replaced_release = self.create_release(
            version="replaced_release",
            environments=[self.environment],
            adopted=timezone.now(),
            unadopted=timezone.now(),
        )
        adopted_release = self.create_release(
            version="adopted_release",
            environments=[self.environment],
            adopted=timezone.now(),
        )
        self.create_release(version="not_adopted_release", environments=[self.environment])

        adopted_release_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-1"],
                "release": adopted_release.version,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).group.id
        adopted_release_g_2 = self.store_event(
            data={
                "timestamp": before_now(minutes=2).isoformat(),
                "fingerprint": ["group-2"],
                "release": adopted_release.version,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).group.id
        replaced_release_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=3).isoformat(),
                "fingerprint": ["group-3"],
                "release": replaced_release.version,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).group.id
        replaced_release_g_2 = self.store_event(
            data={
                "timestamp": before_now(minutes=4).isoformat(),
                "fingerprint": ["group-4"],
                "release": replaced_release.version,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        ).group.id

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            query=f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}",
            environment=self.environment.name,
        )
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            adopted_release_g_1,
            adopted_release_g_2,
        ]

        response = self.get_response(
            sort_by="date",
            limit=10,
            query=f"!{RELEASE_STAGE_ALIAS}:{ReleaseStages.LOW_ADOPTION.value}",
            environment=self.environment.name,
        )
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            adopted_release_g_1,
            adopted_release_g_2,
            replaced_release_g_1,
            replaced_release_g_2,
        ]

        response = self.get_response(
            sort_by="date",
            limit=10,
            query=f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED.value}, {ReleaseStages.REPLACED.value}]",
            environment=self.environment.name,
        )
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            adopted_release_g_1,
            adopted_release_g_2,
            replaced_release_g_1,
            replaced_release_g_2,
        ]

        response = self.get_response(
            sort_by="date",
            limit=10,
            query=f"!{RELEASE_STAGE_ALIAS}:[{ReleaseStages.LOW_ADOPTION.value}, {ReleaseStages.REPLACED.value}]",
            environment=self.environment.name,
        )
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            adopted_release_g_1,
            adopted_release_g_2,
        ]

    def test_semver_package(self, _: MagicMock) -> None:
        release_1 = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test2@1.2.4")

        release_1_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-1"],
                "release": release_1.version,
            },
            project_id=self.project.id,
        ).group.id
        release_1_g_2 = self.store_event(
            data={
                "timestamp": before_now(minutes=2).isoformat(),
                "fingerprint": ["group-2"],
                "release": release_1.version,
            },
            project_id=self.project.id,
        ).group.id
        release_2_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=3).isoformat(),
                "fingerprint": ["group-3"],
                "release": release_2.version,
            },
            project_id=self.project.id,
        ).group.id
        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_PACKAGE_ALIAS}:test")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            release_1_g_1,
            release_1_g_2,
        ]

        response = self.get_response(
            sort_by="date", limit=10, query=f"{SEMVER_PACKAGE_ALIAS}:test2"
        )
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            release_2_g_1,
        ]

    def test_semver_build(self, _: MagicMock) -> None:
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test2@1.2.4+124")

        release_1_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-1"],
                "release": release_1.version,
            },
            project_id=self.project.id,
        ).group.id
        release_1_g_2 = self.store_event(
            data={
                "timestamp": before_now(minutes=2).isoformat(),
                "fingerprint": ["group-2"],
                "release": release_1.version,
            },
            project_id=self.project.id,
        ).group.id
        release_2_g_1 = self.store_event(
            data={
                "timestamp": before_now(minutes=3).isoformat(),
                "fingerprint": ["group-3"],
                "release": release_2.version,
            },
            project_id=self.project.id,
        ).group.id
        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_BUILD_ALIAS}:123")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            release_1_g_1,
            release_1_g_2,
        ]

        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_BUILD_ALIAS}:124")
        assert response.status_code == 200, response.content
        assert [int(r["id"]) for r in response.json()] == [
            release_2_g_1,
        ]

        response = self.get_response(sort_by="date", limit=10, query=f"{SEMVER_BUILD_ALIAS}:[124]")
        assert response.status_code == 400, response.content

    def test_aggregate_stats_regression_test(self, _: MagicMock) -> None:
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="times_seen:>0 last_seen:-1h date:-1h"
        )

        assert response.status_code == 200
        assert len(response.data) == 1

    def test_skipped_fields(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=200).isoformat(),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        query = "server:example.com"
        query += " status:unresolved"
        query += " first_seen:" + before_now(seconds=500).isoformat()

        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query=query)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["lifetime"] is not None
        assert response.data[0]["filtered"] is not None

    def test_inbox_fields(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
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
        snooze_details: InboxReasonDetails = {
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

    def test_inbox_fields_issue_states(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        add_group_to_inbox(event.group, GroupInboxReason.NEW)
        query = "status:unresolved"
        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query=query, expand=["inbox"])

        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["inbox"]["reason"] == GroupInboxReason.NEW.value
        remove_group_from_inbox(event.group)
        snooze_details: InboxReasonDetails = {
            "until": None,
            "count": 3,
            "window": None,
            "user_count": None,
            "user_window": 5,
        }
        add_group_to_inbox(event.group, GroupInboxReason.ONGOING, snooze_details)
        response = self.get_response(sort_by="date", limit=10, query=query, expand=["inbox"])

        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["inbox"] is not None
        assert response.data[0]["inbox"]["reason"] == GroupInboxReason.ONGOING.value
        assert response.data[0]["inbox"]["reason_details"] == snooze_details

    def test_expand_string(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
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

    def test_expand_plugin_actions_and_issues(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        query = "status:unresolved"
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["pluginActions", "pluginIssues"]
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["pluginActions"] is not None
        assert response.data[0]["pluginIssues"] is not None

        # Test with no expand
        response = self.get_response(sort_by="date", limit=10, query=query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "pluginActions" not in response.data[0]
        assert "pluginIssues" not in response.data[0]

    def test_expand_integration_issues(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        query = "status:unresolved"
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["integrationIssues"]
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["integrationIssues"] is not None

        # Test with no expand
        response = self.get_response(sort_by="date", limit=10, query=query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "integrationIssues" not in response.data[0]

        integration_jira = self.create_integration(
            organization=event.group.organization,
            provider="jira",
            external_id="jira_external_id",
            name="Jira",
            metadata={"base_url": "https://example.com", "domain_name": "test/"},
        )
        external_issue_1 = self.create_integration_external_issue(
            group=event.group,
            integration=integration_jira,
            key="APP-123-JIRA",
            title="jira issue 1",
            description="this is an example description",
        )
        external_issue_2 = self.create_integration_external_issue(
            group=event.group,
            integration=integration_jira,
            key="APP-456-JIRA",
            title="jira issue 2",
            description="this is an example description",
        )
        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["integrationIssues"]
        )
        assert response.status_code == 200
        assert len(response.data[0]["integrationIssues"]) == 2
        assert response.data[0]["integrationIssues"][0]["title"] == external_issue_1.title
        assert response.data[0]["integrationIssues"][1]["title"] == external_issue_2.title

    def test_expand_sentry_app_issues(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        query = "status:unresolved"
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["sentryAppIssues"]
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["sentryAppIssues"] is not None

        # Test with no expand
        response = self.get_response(sort_by="date", limit=10, query=query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "sentryAppIssues" not in response.data[0]

        issue_1 = PlatformExternalIssue.objects.create(
            group_id=event.group.id,
            project_id=event.group.project.id,
            service_type="sentry-app",
            display_name="App#issue-1",
            web_url="https://example.com/app/issues/1",
        )
        issue_2 = PlatformExternalIssue.objects.create(
            group_id=event.group.id,
            project_id=event.group.project.id,
            service_type="sentry-app-2",
            display_name="App#issue-2",
            web_url="https://example.com/app/issues/1",
        )
        PlatformExternalIssue.objects.create(
            group_id=1234,
            project_id=event.group.project.id,
            service_type="sentry-app-3",
            display_name="App#issue-1",
            web_url="https://example.com/app/issues/1",
        )

        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["sentryAppIssues"]
        )
        assert response.status_code == 200
        assert len(response.data[0]["sentryAppIssues"]) == 2
        assert response.data[0]["sentryAppIssues"][0]["issueId"] == str(issue_1.group_id)
        assert response.data[0]["sentryAppIssues"][1]["issueId"] == str(issue_2.group_id)
        assert response.data[0]["sentryAppIssues"][0]["displayName"] == issue_1.display_name
        assert response.data[0]["sentryAppIssues"][1]["displayName"] == issue_2.display_name

    @with_feature("organizations:event-attachments")
    def test_expand_latest_event_has_attachments(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        query = "status:unresolved"
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["latestEventHasAttachments"]
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        # No attachments
        assert response.data[0]["latestEventHasAttachments"] is False

        # Test with no expand
        response = self.get_response(sort_by="date", limit=10, query=query)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "latestEventHasAttachments" not in response.data[0]

        # Add 1 attachment
        file_attachment = File.objects.create(name="hello.png", type="image/png")
        EventAttachment.objects.create(
            group_id=event.group.id,
            event_id=event.event_id,
            project_id=event.project_id,
            file_id=file_attachment.id,
            type=file_attachment.type,
            name="hello.png",
        )

        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["latestEventHasAttachments"]
        )
        assert response.status_code == 200
        assert response.data[0]["latestEventHasAttachments"] is True

    @with_feature("organizations:event-attachments")
    @patch("sentry.models.Group.get_latest_event", return_value=None)
    def test_expand_no_latest_event_has_no_attachments(
        self, _: MagicMock, mock_latest_event: MagicMock
    ) -> None:
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        query = "status:unresolved"
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query=query, expand=["latestEventHasAttachments"]
        )
        assert response.status_code == 200

        # Expand should not execute since there is no latest event
        assert "latestEventHasAttachments" not in response.data[0]

    def test_expand_owners(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
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
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            team=self.team,
        )
        GroupOwner.objects.create(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.CODEOWNERS.value,
            team=self.team,
        )
        GroupOwner.objects.create(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=None,
            team=None,
        )
        response = self.get_response(sort_by="date", limit=10, query=query, expand="owners")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["owners"] is not None
        assert len(response.data[0]["owners"]) == 3
        assert response.data[0]["owners"][0]["owner"] == f"user:{self.user.id}"
        assert response.data[0]["owners"][1]["owner"] == f"team:{self.team.id}"
        assert response.data[0]["owners"][2]["owner"] == f"team:{self.team.id}"
        assert (
            response.data[0]["owners"][0]["type"] == GROUP_OWNER_TYPE[GroupOwnerType.SUSPECT_COMMIT]
        )
        assert (
            response.data[0]["owners"][1]["type"] == GROUP_OWNER_TYPE[GroupOwnerType.OWNERSHIP_RULE]
        )
        assert response.data[0]["owners"][2]["type"] == GROUP_OWNER_TYPE[GroupOwnerType.CODEOWNERS]

    def test_default_search(self, _: MagicMock) -> None:
        event1 = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        event2.group.update(status=GroupStatus.RESOLVED, substatus=None)

        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, expand="inbox", collapse="stats")
        assert response.status_code == 200
        assert [int(r["id"]) for r in response.data] == [event1.group.id]

    def test_default_search_with_priority(self, _: MagicMock) -> None:
        event1 = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event1.group.priority = PriorityLevel.HIGH
        event1.group.save()
        event2 = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-3"]},
            project_id=self.project.id,
        )
        event2.group.status = GroupStatus.RESOLVED
        event2.group.substatus = None
        event2.group.priority = PriorityLevel.HIGH
        event2.group.save()

        event3 = self.store_event(
            data={"timestamp": before_now(seconds=400).isoformat(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        event3.group.priority = PriorityLevel.LOW
        event3.group.save()

        self.login_as(user=self.user)
        sleep(1)

        response = self.get_response(sort_by="date", limit=10, expand="inbox", collapse="stats")
        assert response.status_code == 200
        assert [int(r["id"]) for r in response.data] == [event1.group.id]

    def test_collapse_stats(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
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
        assert "userCount" not in response.data[0]
        assert "lifetime" not in response.data[0]
        assert "filtered" not in response.data[0]

    def test_collapse_lifetime(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
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

    def test_collapse_filtered(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
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

    def test_collapse_lifetime_and_filtered(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
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

    def test_collapse_base(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
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

    def test_collapse_stats_group_snooze_bug(self, _: MagicMock) -> None:
        # There was a bug where we tried to access attributes on seen_stats if this feature is active
        # but seen_stats could be null when we collapse stats.
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
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

    def test_collapse_unhandled(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date", limit=10, query="is:unresolved", collapse=["unhandled"]
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert "isUnhandled" not in response.data[0]

    def test_selected_saved_search(self, _: MagicMock) -> None:
        saved_search = SavedSearch.objects.create(
            name="Saved Search",
            query="ZeroDivisionError",
            organization=self.organization,
            owner_id=self.user.id,
        )
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-1"],
                "message": "ZeroDivisionError",
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-2"],
                "message": "TypeError",
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            collapse=["unhandled"],
            savedSearch=0,
            searchId=saved_search.id,
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

    def test_pinned_saved_search(self, _: MagicMock) -> None:
        SavedSearch.objects.create(
            name="Saved Search",
            query="ZeroDivisionError",
            organization=self.organization,
            owner_id=self.user.id,
            visibility=Visibility.OWNER_PINNED,
        )
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-1"],
                "message": "ZeroDivisionError",
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-2"],
                "message": "TypeError",
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            collapse=["unhandled"],
            savedSearch=0,
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

    def test_pinned_saved_search_with_query(self, _: MagicMock) -> None:
        SavedSearch.objects.create(
            name="Saved Search",
            query="TypeError",
            organization=self.organization,
            owner_id=self.user.id,
            visibility=Visibility.OWNER_PINNED,
        )
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-1"],
                "message": "ZeroDivisionError",
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-2"],
                "message": "TypeError",
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            collapse=["unhandled"],
            query="ZeroDivisionError",
            savedSearch=0,
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

    @with_feature("organizations:issue-stream-custom-views")
    def test_user_default_custom_view_query(self, _: MagicMock) -> None:
        SavedSearch.objects.create(
            name="Saved Search",
            query="TypeError",
            organization=self.organization,
            owner_id=self.user.id,
            visibility=Visibility.OWNER_PINNED,
        )
        default_view = GroupSearchView.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            name="Default View",
            query="ZeroDivisionError",
            query_sort="date",
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            position=0,
            group_search_view=default_view,
        )
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-1"],
                "message": "ZeroDivisionError",
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-2"],
                "message": "TypeError",
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            collapse=["unhandled"],
            savedSearch=0,
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

    @with_feature("organizations:issue-stream-custom-views")
    def test_non_default_custom_view_query(self, _: MagicMock) -> None:
        GroupSearchView.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            name="Default View",
            query="TypeError",
            query_sort="date",
        )

        view = GroupSearchView.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            name="Custom View",
            query="ZeroDivisionError",
            query_sort="date",
        )

        event = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-1"],
                "message": "ZeroDivisionError",
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            collapse=["unhandled"],
            viewId=view.id,
            savedSearch=0,
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id

    @with_feature("organizations:issue-stream-custom-views")
    def test_global_default_custom_view_query(self, _: MagicMock) -> None:
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-1"],
                "message": "ZeroDivisionError",
            },
            project_id=self.project.id,
        )
        event.group.priority = PriorityLevel.LOW
        event.group.save()

        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, collapse=["unhandled"])

        # The request is not populated with a query, or a searchId to extract a query from, so the
        # query used should be the global default, the Prioritized query. Since the only event is a low priority event,
        # we should expect no results here.
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_query_status_and_substatus_overlapping(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event.group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        self.login_as(user=self.user)

        get_query_response = functools.partial(
            self.get_response, sort_by="date", limit=10, expand="inbox", collapse="stats"
        )

        response0 = get_query_response(
            query="is:unresolved",
        )

        response1 = get_query_response(
            query="is:ongoing"
        )  # (status=unresolved, substatus=(ongoing))
        response2 = get_query_response(query="is:unresolved")  # (status=unresolved, substatus=*)
        response3 = get_query_response(
            query="is:unresolved is:ongoing !is:regressed"
        )  # (status=unresolved, substatus=(ongoing, !regressed))
        response4 = get_query_response(
            query="is:unresolved is:ongoing !is:ignored"
        )  # (status=unresolved, substatus=(ongoing, !ignored))
        response5 = get_query_response(
            query="!is:regressed is:unresolved"
        )  # (status=unresolved, substatus=(!regressed))
        response6 = get_query_response(
            query="!is:archived_until_escalating"
        )  # (status=(!unresolved), substatus=(!archived_until_escalating))

        assert (
            response0.status_code
            == response1.status_code
            == response2.status_code
            == response3.status_code
            == response4.status_code
            == response5.status_code
            == response6.status_code
            == 200
        )
        assert (
            [int(r["id"]) for r in response0.data]
            == [int(r["id"]) for r in response1.data]
            == [int(r["id"]) for r in response2.data]
            == [int(r["id"]) for r in response3.data]
            == [int(r["id"]) for r in response4.data]
            == [int(r["id"]) for r in response5.data]
            == [int(r["id"]) for r in response6.data]
            == [event.group.id]
        )

    def test_query_status_and_substatus_nonoverlapping(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event.group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        self.login_as(user=self.user)

        get_query_response = functools.partial(
            self.get_response, sort_by="date", limit=10, expand="inbox", collapse="stats"
        )

        response1 = get_query_response(query="is:escalating")
        response2 = get_query_response(query="is:new")
        response3 = get_query_response(query="is:regressed")
        response4 = get_query_response(query="is:archived_forever")
        response5 = get_query_response(query="is:archived_until_condition_met")
        response6 = get_query_response(query="is:archived_until_escalating")
        response7 = get_query_response(query="is:resolved")
        response8 = get_query_response(query="is:ignored")
        response9 = get_query_response(query="is:muted")
        response10 = get_query_response(query="!is:unresolved")

        assert (
            response1.status_code
            == response2.status_code
            == response3.status_code
            == response4.status_code
            == response5.status_code
            == response6.status_code
            == response7.status_code
            == response8.status_code
            == response9.status_code
            == response10.status_code
            == 200
        )
        assert (
            [int(r["id"]) for r in response1.data]
            == [int(r["id"]) for r in response2.data]
            == [int(r["id"]) for r in response3.data]
            == [int(r["id"]) for r in response4.data]
            == [int(r["id"]) for r in response5.data]
            == [int(r["id"]) for r in response6.data]
            == [int(r["id"]) for r in response7.data]
            == [int(r["id"]) for r in response8.data]
            == [int(r["id"]) for r in response9.data]
            == [int(r["id"]) for r in response10.data]
            == []
        )

    def test_use_group_snuba_dataset(self, mock_query: MagicMock) -> None:
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)
        response = self.get_success_response(query="")
        assert len(response.data) == 1
        assert mock_query.call_count == 1

    def test_snuba_order_by_first_seen_of_issue(self, _: MagicMock) -> None:
        # issue 1: issue 10 minutes ago
        time = datetime.now() - timedelta(minutes=10)
        event1 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        # issue 2: events 90 minutes ago and 1 minute ago
        time = datetime.now() - timedelta(minutes=90)
        event2 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        time = datetime.now() - timedelta(minutes=1)
        self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )

        sleep(1)
        self.login_as(user=self.user)
        response = self.get_success_response(
            sort="new",
            statsPeriod="1h",
            query="",
        )

        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == event1.group.id
        assert int(response.data[1]["id"]) == event2.group.id

    def test_snuba_order_by_freq(self, mock_query: MagicMock) -> None:
        event1 = self.store_event(
            data={"timestamp": before_now(seconds=3).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": before_now(seconds=2).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_success_response(
            sort="freq",
            statsPeriod="1h",
            query="",
        )

        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == event1.group.id
        assert int(response.data[1]["id"]) == event2.group.id
        assert mock_query.call_count == 1

    def test_snuba_order_by_user_count(self, mock_query: MagicMock) -> None:
        user1 = {
            "email": "foo@example.com",
        }
        user2 = {
            "email": "test@example.com",
        }
        user3 = {
            "email": "test2@example.com",
        }

        # 2 events, 2 users
        event1 = self.store_event(
            data={
                "timestamp": before_now(seconds=6).isoformat(),
                "fingerprint": ["group-1"],
                "user": user2,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=5).isoformat(),
                "fingerprint": ["group-1"],
                "user": user3,
            },
            project_id=self.project.id,
        )

        # 3 events, 1 user for group 1
        event2 = self.store_event(
            data={
                "timestamp": before_now(seconds=4).isoformat(),
                "fingerprint": ["group-2"],
                "user": user1,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=3).isoformat(),
                "fingerprint": ["group-2"],
                "user": user1,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=2).isoformat(),
                "fingerprint": ["group-2"],
                "user": user1,
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_success_response(
            sort="user",
            query="",
        )

        assert len(response.data) == 2
        assert int(response.data[0]["id"]) == event1.group.id
        assert int(response.data[1]["id"]) == event2.group.id
        assert mock_query.call_count == 1

    def test_snuba_assignee_filter(self, _: MagicMock) -> None:

        # issue 1: assigned to user
        time = datetime.now() - timedelta(minutes=10)
        event1 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event1.group, self.user)

        # issue 2: assigned to team
        time = datetime.now() - timedelta(minutes=9)
        event2 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event2.group, self.team)

        # issue 3: suspect commit for user
        time = datetime.now() - timedelta(minutes=8)
        event3 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-3"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event3.group,
            project=event3.group.project,
            organization=event3.group.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            team_id=None,
            user_id=self.user.id,
        )

        # issue 4: ownership rule for team
        time = datetime.now() - timedelta(minutes=7)
        event4 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-4"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event4.group,
            project=event4.group.project,
            organization=event4.group.project.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            team_id=self.team.id,
            user_id=None,
        )

        # issue 5: assigned to another user
        time = datetime.now() - timedelta(minutes=6)
        event5 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-5"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event5.group, self.create_user())

        # issue 6: assigned to another team
        time = datetime.now() - timedelta(minutes=5)
        event6 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-6"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event6.group, self.create_team())

        # issue 7: suggested to another user
        time = datetime.now() - timedelta(minutes=4)
        event7 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-7"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event7.group,
            project=event7.group.project,
            organization=event7.group.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            team_id=None,
            user_id=self.create_user().id,
        )
        # issue 8: suggested to another team
        time = datetime.now() - timedelta(minutes=3)
        event8 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-8"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event8.group,
            project=event8.group.project,
            organization=event8.group.project.organization,
            type=GroupOwnerType.CODEOWNERS.value,
            team_id=self.create_team().id,
            user_id=None,
        )

        # issue 9: unassigned
        time = datetime.now() - timedelta(minutes=2)
        event9 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-9"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        queries_with_expected_ids = [
            ("assigned_or_suggested:[me]", [event3.group.id, event1.group.id]),
            ("assigned_or_suggested:[my_teams]", [event4.group.id, event2.group.id]),
            (
                "assigned_or_suggested:[me, my_teams]",
                [event4.group.id, event3.group.id, event2.group.id, event1.group.id],
            ),
            (
                "assigned_or_suggested:[me, my_teams, none]",
                [
                    event9.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                    event1.group.id,
                ],
            ),
            ("assigned_or_suggested:none", [event9.group.id]),
            ("assigned:[me]", [event1.group.id]),
            ("assigned:[my_teams]", [event2.group.id]),
            ("assigned:[me, my_teams]", [event2.group.id, event1.group.id]),
            (
                "assigned:[me, my_teams, none]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                    event1.group.id,
                ],
            ),
            (
                "assigned:none",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event4.group.id,
                    event3.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[me]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event2.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event3.group.id,
                    event1.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[me, my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[me, my_teams, none]",
                [event8.group.id, event7.group.id, event6.group.id, event5.group.id],
            ),
            (
                "!assigned_or_suggested:none",
                [
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                    event1.group.id,
                ],
            ),
            (
                "!assigned:[me]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                ],
            ),
            (
                "!assigned:[my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                    event1.group.id,
                ],
            ),
            (
                "!assigned:[me, my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                ],
            ),
            ("!assigned:[me, my_teams, none]", [event6.group.id, event5.group.id]),
            (
                "!assigned:none",
                [event6.group.id, event5.group.id, event2.group.id, event1.group.id],
            ),
        ]

        for query, expected_group_ids in queries_with_expected_ids:
            response = self.get_success_response(
                sort="new",
                query=query,
            )
            assert [int(row["id"]) for row in response.data] == expected_group_ids

    def test_snuba_unassigned(self, _: MagicMock) -> None:
        # issue 1: assigned to user
        time = datetime.now() - timedelta(minutes=10)
        event1 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event1.group, self.user)

        # issue 2: assigned to team
        time = datetime.now() - timedelta(minutes=9)
        event2 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event2.group, self.team)

        # issue 3: unassigned
        time = datetime.now() - timedelta(minutes=2)
        event3 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-3"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        queries_with_expected_ids = [
            ("is:assigned", [event1.group.id, event2.group.id]),
            ("!is:assigned", [event3.group.id]),
            ("!is:unassigned", [event1.group.id, event2.group.id]),
            ("is:unassigned", [event3.group.id]),
        ]

        for query, expected_group_ids in queries_with_expected_ids:
            response = self.get_success_response(
                sort="new",
                query=query,
            )
            assert {int(row["id"]) for row in response.data} == set(expected_group_ids)

    def test_snuba_query_title(self, mock_query: MagicMock) -> None:
        self.project = self.create_project(organization=self.organization)
        event1 = self.store_event(
            data={"fingerprint": ["group-1"], "message": "MyMessage"},
            project_id=self.project.id,
        )
        self.store_event(
            data={"fingerprint": ["group-2"], "message": "AnotherMessage"},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)
        # give time for consumers to run and propogate changes to clickhouse
        sleep(1)
        response = self.get_success_response(
            sort="new",
            query="title:MyMessage",
        )
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event1.group.id
        assert mock_query.call_count == 1

    def test_snuba_query_priority(self, mock_query: MagicMock) -> None:
        self.project = self.create_project(organization=self.organization)
        event1 = self.store_event(
            data={"fingerprint": ["group-1"], "message": "MyMessage"},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        # give time for consumers to run and propogate changes to clickhouse
        sleep(1)
        response = self.get_success_response(
            sort="new",
            query="issue.priority:high",
        )
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event1.group.id

        response = self.get_success_response(
            sort="new",
            query="priority:medium",
        )
        assert len(response.data) == 0

    def test_snuba_query_first_release_no_environments(self, mock_query: MagicMock) -> None:
        self.project = self.create_project(organization=self.organization)
        old_release = Release.objects.create(organization_id=self.organization.id, version="abc")
        old_release.add_project(self.project)

        new_release = Release.objects.create(organization_id=self.organization.id, version="def")
        new_release.add_project(self.project)

        event1 = self.store_event(
            data={"fingerprint": ["group-1"], "message": "MyMessage"},
            project_id=self.project.id,
        )
        event1.group.first_release = new_release
        event1.group.save()

        self.login_as(user=self.user)

        # give time for consumers to run and propogate changes to clickhouse
        sleep(1)
        for release, expected_groups in (
            ("fake", []),
            (old_release.version, []),
            ("latest", [event1.group.id]),
            (new_release.version, [event1.group.id]),
        ):
            response = self.get_success_response(
                sort="new",
                query=f"first_release:{release}",
            )
            assert len(response.data) == len(expected_groups)
            assert {int(r["id"]) for r in response.data} == set(expected_groups)

    def test_snuba_query_first_release_with_environments(self, mock_query: MagicMock) -> None:
        self.project = self.create_project(organization=self.organization)
        release = Release.objects.create(organization_id=self.organization.id, version="release1")
        release.add_project(self.project)
        Environment.objects.create(organization_id=self.organization.id, name="production")

        event = self.store_event(
            data={"fingerprint": ["group-1"], "message": "MyMessage", "environment": "development"},
            project_id=self.project.id,
        )
        GroupEnvironment.objects.filter(group_id=event.group.id).update(first_release=release)
        event.group.first_release = release
        event.group.save()

        self.login_as(user=self.user)

        # give time for consumers to run and propogate changes to clickhouse
        sleep(1)

        for release_s, environment, expected_groups in (
            (release.version, "development", [event.group.id]),
            (release.version, "production", []),
        ):
            response = self.get_success_response(
                sort="new",
                query=f"first_release:{release_s}",
                environment=environment,
            )
            assert len(response.data) == len(expected_groups)
            assert {int(r["id"]) for r in response.data} == set(expected_groups)

    def test_snuba_query_unlinked(self, mock_query: MagicMock) -> None:
        self.project = self.create_project(organization=self.organization)
        event1 = self.store_event(
            data={"fingerprint": ["group-1"], "message": "MyMessage"},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"fingerprint": ["group-2"], "message": "AnotherMessage"},
            project_id=self.project.id,
        )
        PlatformExternalIssue.objects.create(project_id=self.project.id, group_id=event1.group.id)
        self.external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.integration.id, key="123"
        )
        GroupLink.objects.create(
            project_id=self.project.id,
            group_id=event1.group.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=self.external_issue.id,
        )

        self.login_as(user=self.user)
        # give time for consumers to run and propogate changes to clickhouse
        sleep(1)

        for value in [0, 5]:
            with override_options({"snuba.search.max-pre-snuba-candidates": value}):
                response = self.get_success_response(
                    sort="new",
                    useGroupSnubaDataset=1,
                    query="is:linked",
                )
                assert len(response.data) == 1
                assert int(response.data[0]["id"]) == event1.group.id

                response = self.get_success_response(
                    sort="new",
                    useGroupSnubaDataset=1,
                    query="is:unlinked",
                )
                assert len(response.data) == 1
                assert int(response.data[0]["id"]) == event2.group.id

    def test_snuba_perf_issue(self, mock_query: MagicMock) -> None:
        self.project = self.create_project(organization=self.organization)
        # create a performance issue
        _, _, group_info = self.store_search_issue(
            self.project.id,
            233,
            [f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"],
            user={"email": "myemail@example.com"},
            event_data={
                "type": "transaction",
                "start_timestamp": (datetime.now() - timedelta(minutes=1)).isoformat(),
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
        )

        # make mypy happy
        perf_group_id = group_info.group.id if group_info else None

        # create an error issue with the same tag
        error_event = self.store_event(
            data={
                "fingerprint": ["error-issue"],
                "event_id": "e" * 32,
                "user": {"email": "myemail@example.com"},
            },
            project_id=self.project.id,
        )
        # another error issue with a different tag
        self.store_event(
            data={
                "fingerprint": ["error-issue-2"],
                "event_id": "e" * 32,
                "user": {"email": "different@example.com"},
            },
            project_id=self.project.id,
        )

        assert Group.objects.filter(id=perf_group_id).exists()
        self.login_as(user=self.user)
        # give time for consumers to run and propogate changes to clickhouse
        sleep(1)
        response = self.get_success_response(
            sort="new",
            query="user.email:myemail@example.com",
        )
        assert len(response.data) == 2
        assert {r["id"] for r in response.data} == {
            str(perf_group_id),
            str(error_event.group.id),
        }
        assert mock_query.call_count == 1

    @patch("sentry.issues.ingest.should_create_group", return_value=True)
    @with_feature(PerformanceRenderBlockingAssetSpanGroupType.build_visible_feature_name())
    @with_feature(PerformanceNPlusOneGroupType.build_visible_feature_name())
    def test_snuba_type_and_category(
        self,
        mock_should_create_group: MagicMock,
        mock_query: MagicMock,
    ) -> None:
        self.project = self.create_project(organization=self.organization)
        # create a render blocking issue
        _, _, group_info = self.store_search_issue(
            self.project.id,
            2,
            [f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"],
            event_data={
                "type": "transaction",
                "start_timestamp": (datetime.now() - timedelta(minutes=1)).isoformat(),
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            override_occurrence_data={
                "type": PerformanceRenderBlockingAssetSpanGroupType.type_id,
            },
        )
        # make mypy happy
        blocking_asset_group_id = group_info.group.id if group_info else None

        _, _, group_info = self.store_search_issue(
            self.project.id,
            2,
            [f"{PerformanceNPlusOneGroupType.type_id}-group2"],
            event_data={
                "type": "transaction",
                "start_timestamp": (datetime.now() - timedelta(minutes=1)).isoformat(),
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            override_occurrence_data={
                "type": PerformanceNPlusOneGroupType.type_id,
            },
        )
        # make mypy happy
        np1_group_id = group_info.group.id if group_info else None

        # create an error issue
        error_event = self.store_event(
            data={
                "fingerprint": ["error-issue"],
                "event_id": "e" * 32,
            },
            project_id=self.project.id,
        )
        error_group_id = error_event.group.id

        self.login_as(user=self.user)
        # give time for consumers to run and propogate changes to clickhouse
        sleep(1)
        assert Group.objects.filter(id=np1_group_id).exists()

        # first test just the category
        response = self.get_success_response(
            sort="new",
            query="issue.category:performance",
        )
        assert len(response.data) == 2
        assert {r["id"] for r in response.data} == {
            str(blocking_asset_group_id),
            str(np1_group_id),
        }
        assert mock_query.call_count == 1

        # now ask for the type
        response = self.get_success_response(
            sort="new",
            query="issue.type:performance_n_plus_one_db_queries",
        )
        assert len(response.data) == 1
        assert {r["id"] for r in response.data} == {
            str(np1_group_id),
        }

        # now ask for the type and category in a way that should return no results
        response = self.get_success_response(
            sort="new",
            query="issue.category:replay issue.type:performance_n_plus_one_db_queries",
        )
        assert len(response.data) == 0

        response = self.get_success_response(
            sort="new",
            query="issue.category:error",
        )
        assert len(response.data) == 1
        assert {r["id"] for r in response.data} == {str(error_group_id)}

        response = self.get_success_response(
            sort="new",
            query="!issue.category:performance",
        )
        assert len(response.data) == 1
        assert {r["id"] for r in response.data} == {str(error_group_id)}

        response = self.get_success_response(
            sort="new",
            query="!issue.category:error",
        )
        assert len(response.data) == 2
        assert {r["id"] for r in response.data} == {
            str(blocking_asset_group_id),
            str(np1_group_id),
        }

        response = self.get_success_response(
            sort="new",
            query="!issue.category:performance",
        )
        assert len(response.data) == 1
        assert {r["id"] for r in response.data} == {str(error_group_id)}

        response = self.get_success_response(
            sort="new",
            query="!issue.category:[performance,cron]",
        )
        assert len(response.data) == 1
        assert {r["id"] for r in response.data} == {str(error_group_id)}

    def test_pagination_and_x_hits_header(self, _: MagicMock) -> None:
        # Create 30 issues
        for i in range(30):
            self.store_event(
                data={
                    "timestamp": before_now(seconds=i).isoformat(),
                    "fingerprint": [f"group-{i}"],
                },
                project_id=self.project.id,
            )

        self.login_as(user=self.user)
        sleep(1)

        # Request the first page with a limit of 10
        response = self.get_success_response(limit=10, sort="new")
        assert response.status_code == 200
        assert len(response.data) == 10
        assert response.headers.get("X-Hits") == "30"
        assert "Link" in response.headers

        # Parse the Link header to get the cursor for the next page
        header_links = parse_link_header(response.headers["Link"])
        next_obj = [link for link in header_links.values() if link["rel"] == "next"][0]
        assert next_obj["results"] == "true"
        cursor = next_obj["cursor"]
        prev_obj = [link for link in header_links.values() if link["rel"] == "previous"][0]
        assert prev_obj["results"] == "false"

        # Request the second page using the cursor
        response = self.get_success_response(limit=10, cursor=cursor)
        assert response.status_code == 200
        assert len(response.data) == 10

        # Check for the presence of the next cursor
        header_links = parse_link_header(response.headers["Link"])
        next_obj = [link for link in header_links.values() if link["rel"] == "next"][0]
        assert next_obj["results"] == "true"
        cursor = next_obj["cursor"]
        prev_obj = [link for link in header_links.values() if link["rel"] == "previous"][0]
        assert prev_obj["results"] == "true"

        # Request the third page using the cursor
        response = self.get_success_response(limit=10, cursor=cursor)
        assert response.status_code == 200
        assert len(response.data) == 10

        # Check that there is no next page
        header_links = parse_link_header(response.headers["Link"])
        next_obj = [link for link in header_links.values() if link["rel"] == "next"][0]
        assert next_obj["results"] == "false"
        prev_obj = [link for link in header_links.values() if link["rel"] == "previous"][0]
        assert prev_obj["results"] == "true"

    def test_find_error_by_message_with_snuba_only_search(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        project = self.project
        # Simulate sending an event with Kafka enabled
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "message": "OutOfMemoryError",
                "tags": {"level": "error"},
            },
            project_id=project.id,
        )
        # Simulate sending another event that matches the wildcard filter
        event2 = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "message": "MemoryError",
                "tags": {"level": "error"},
            },
            project_id=project.id,
        )

        # Simulate sending another event that doesn't match the filter
        self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "message": "NullPointerException",
                "tags": {"level": "error"},
            },
            project_id=project.id,
        )

        # Retrieve the event based on its message
        response = self.get_success_response(query="OutOfMemoryError")
        assert response.status_code == 200
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event.group.id

        # Retrieve events based on a wildcard match for any *Error in the message
        response = self.get_success_response(query="*Error")
        assert response.status_code == 200
        issues = json.loads(response.content)
        assert len(issues) >= 2  # Expecting at least two issues: OutOfMemoryError and MemoryError
        assert any(int(issue["id"]) == event.group.id for issue in issues)
        assert any(int(issue["id"]) == event2.group.id for issue in issues)

    def test_first_seen_and_last_seen_filters(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        project = self.project
        # Create 4 issues at different times
        times = [
            (before_now(hours=1), before_now(hours=1)),  # Two events for issue 0
            (before_now(hours=6), before_now(hours=3)),  # Two events for issue 1
            (before_now(hours=11), before_now(hours=10)),  # Two events for issue 2
            (before_now(hours=23), before_now(minutes=30)),  # Two events for issue 3
        ]
        for i, (time1, time2) in enumerate(times):
            self.store_event(
                data={
                    "timestamp": time1.isoformat(),
                    "message": f"Error {i}",
                    "fingerprint": [f"group-{i}"],
                },
                project_id=project.id,
            )
            self.store_event(
                data={
                    "timestamp": time2.isoformat(),
                    "message": f"Error {i} - additional event",
                    "fingerprint": [f"group-{i}"],
                },
                project_id=project.id,
            )

        # Test firstSeen filter
        twenty_four_hours_ago = before_now(hours=24).isoformat()
        response = self.get_success_response(query=f"firstSeen:<{twenty_four_hours_ago}")
        assert len(response.data) == 0
        response = self.get_success_response(query="firstSeen:-24h")
        assert len(response.data) == 4

        # Test lastSeen filter
        response = self.get_success_response(query="lastSeen:-6h")
        assert len(response.data) == 3

        response = self.get_success_response(query="lastSeen:-12h")
        assert len(response.data) == 4

        # Test lastSeen filter with an absolute date using before_now
        absolute_date = before_now(days=1).isoformat()  # Assuming 365 days before now as an example
        response = self.get_success_response(query=f"lastSeen:>{absolute_date}")
        assert len(response.data) == 4
        response = self.get_success_response(query=f"lastSeen:<{absolute_date}")
        assert len(response.data) == 0

    def test_filter_by_bookmarked_by(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        project = self.project
        user2 = self.create_user(email="user2@example.com")

        # Create two issues, one bookmarked by each user
        event1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "Error 1",
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        group1 = event1.group
        GroupBookmark.objects.create(user_id=self.user.id, group=group1, project_id=project.id)

        event2 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "Error 2",
                "fingerprint": ["group-2"],
            },
            project_id=project.id,
        )
        group2 = event2.group
        GroupBookmark.objects.create(user_id=user2.id, group=group2, project_id=project.id)

        # Filter by bookmarked_by the first user
        response = self.get_success_response(query=f"bookmarked_by:{self.user.email}")
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == group1.id

        # Filter by bookmarked_by the second user
        response = self.get_success_response(query=f"bookmarked_by:{user2.email}")
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == group2.id

    def test_filter_by_linked(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        project = self.project

        # Create two issues, one linked and one not linked
        event1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "Error 1",
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        group1 = event1.group
        GroupLink.objects.create(
            group_id=group1.id,
            project=project,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=1,
        )
        event2 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "Error 2",
                "fingerprint": ["group-2"],
            },
            project_id=project.id,
        )
        group2 = event2.group

        # Filter by linked issues
        response = self.get_success_response(query="is:linked")
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == group1.id

        # Ensure the unlinked issue is not returned
        response = self.get_success_response(query="is:unlinked")
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == group2.id

    def test_filter_by_subscribed_by(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        project = self.project

        # Create two issues, one subscribed by user1 and one not subscribed
        event1 = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "Error 1",
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        group1 = event1.group
        GroupSubscription.objects.create(
            user_id=self.user.id,
            group=group1,
            project=project,
            is_active=True,
        )
        self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "Error 2",
                "fingerprint": ["group-2"],
            },
            project_id=project.id,
        )

        # Filter by subscriptions
        response = self.get_success_response(query=f"subscribed:{self.user.email}")
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == group1.id

        # ensure we don't return ny results
        response = self.get_success_response(query="subscribed:fake@fake.com")
        assert len(response.data) == 0

    def test_snuba_search_lookup_by_regressed_in_release(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        release = self.create_release()
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "tags": {"sentry:release": release.version},
            },
            project_id=project.id,
        )
        record_group_history(event.group, GroupHistoryStatus.REGRESSED, release=release)
        response = self.get_success_response(query=f"regressed_in_release:{release.version}")
        issues = json.loads(response.content)
        assert [int(issue["id"]) for issue in issues] == [event.group.id]

    def test_lookup_by_release_build(self, _: MagicMock) -> None:

        for i in range(3):
            j = 119 + i
            self.create_release(version=f"steve@1.2.{i}+{j}")

        self.login_as(self.user)
        project = self.project
        release = self.create_release(version="steve@1.2.7+123")
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "tags": {"sentry:release": release.version},
            },
            project_id=project.id,
        )

        response = self.get_success_response(query="release.build:123")
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event.group.id

        response = self.get_success_response(query="release.build:122")
        issues = json.loads(response.content)
        assert len(issues) == 0

    def test_snuba_search_lookup_by_stack_filename(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "fingerprint": ["unique-fingerprint-1"],
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "filename": "example.py",
                                        "lineno": 29,
                                        "colno": 10,
                                        "function": "test_function",
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=2).isoformat(),
                "fingerprint": ["unique-fingerprint-2"],
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "filename": "different_example.py",
                                        "lineno": 45,
                                        "colno": 10,
                                        "function": "another_test_function",
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=project.id,
        )

        response = self.get_success_response(query="stack.filename:example.py")
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event.group.id
        response = self.get_success_response(query="stack.filename:nonexistent.py")
        issues = json.loads(response.content)
        assert len(issues) == 0

    def test_error_main_thread_condition(self, _: MagicMock) -> None:
        self.login_as(user=self.user)
        project = self.project
        # Simulate sending an event with main_thread set to true
        event1 = self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "message": "MainThreadError",
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "value": "Error in main thread",
                            "thread_id": 1,
                        }
                    ]
                },
                "threads": {"values": [{"id": 1, "main": True}]},
            },
            project_id=project.id,
        )
        # Simulate sending an event with main_thread set to false
        event2 = self.store_event(
            data={
                "timestamp": before_now(seconds=2).isoformat(),
                "message": "WorkerThreadError",
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "value": "Error in worker thread",
                            "thread_id": 2,
                        }
                    ]
                },
                "threads": {"values": [{"id": 2, "main": False}]},
            },
            project_id=project.id,
        )

        # Query for events where main_thread is true
        response = self.get_success_response(query="error.main_thread:true")
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event1.group.id

        # Query for events where main_thread is false
        response = self.get_success_response(query="error.main_thread:false")
        issues = json.loads(response.content)
        assert len(issues) == 1
        assert int(issues[0]["id"]) == event2.group.id

    def test_snuba_heavy_search_aggregate_stats_regression_test(self, _: MagicMock) -> None:
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            query="times_seen:>0 last_seen:-1h date:-1h",
        )

        assert response.status_code == 200
        assert len(response.data) == 1

    def test_snuba_heavy_search_inbox_search(self, _: MagicMock) -> None:
        self.store_event(
            data={
                "timestamp": before_now(seconds=200).isoformat(),
                "fingerprint": ["group-1"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        event = self.store_event(
            data={
                "timestamp": before_now(seconds=200).isoformat(),
                "fingerprint": ["group-2"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "timestamp": before_now(seconds=200).isoformat(),
                "fingerprint": ["group-3"],
                "tags": {"server": "example.com", "trace": "woof", "message": "foo"},
            },
            project_id=self.project.id,
        )

        add_group_to_inbox(event.group, GroupInboxReason.NEW)

        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            query="is:unresolved is:for_review",
            expand=["inbox"],
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == event.group.id
        assert response.data[0]["inbox"] is not None
        assert response.data[0]["inbox"]["reason"] == GroupInboxReason.NEW.value

    @patch("sentry.analytics.record")
    def test_snuba_heavy_advanced_search_errors(self, mock_record: MagicMock, _: MagicMock) -> None:
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

    def test_snuba_heavy_filter_not_unresolved(self, _: MagicMock) -> None:
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event.group.update(status=GroupStatus.RESOLVED, substatus=None)
        self.login_as(user=self.user)
        response = self.get_response(
            sort_by="date",
            limit=10,
            query="!is:unresolved",
            expand="inbox",
            collapse="stats",
        )
        assert response.status_code == 200
        assert [int(r["id"]) for r in response.data] == [event.group.id]

    def test_snuba_heavy_sdk_name_with_negations_and_positive_checks(self, _: MagicMock) -> None:
        # Store an event with sdk.name as sentry.python
        event_python = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-1"],
                "sdk": {"name": "sentry.python", "version": "0.13.19"},
            },
            project_id=self.project.id,
        )

        # Store another event with sdk.name as sentry.javascript
        event_javascript = self.store_event(
            data={
                "timestamp": before_now(seconds=400).isoformat(),
                "fingerprint": ["group-2"],
                "sdk": {"name": "sentry.javascript", "version": "2.1.1"},
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        # Query for events not using sentry.javascript SDK
        response_negation = self.get_response(
            sort_by="date",
            limit=10,
            query="!sdk.name:sentry.javascript",
        )
        assert response_negation.status_code == 200
        assert len(response_negation.data) == 1
        assert [int(r["id"]) for r in response_negation.data] == [event_python.group.id]

        # Query for events specifically using sentry.python SDK
        response_positive = self.get_response(
            sort_by="date",
            query="sdk.name:sentry.javascript",
        )
        assert response_positive.status_code == 200
        assert len(response_negation.data) == 1
        assert [int(r["id"]) for r in response_positive.data] == [event_javascript.group.id]

        # Query for events specifically using sentry.python SDK
        response_positive = self.get_response(
            sort_by="date",
            query="sdk.name:sentry.*",
        )
        assert response_positive.status_code == 200
        assert len(response_positive.data) == 2
        assert {int(r["id"]) for r in response_positive.data} == {
            event_python.group.id,
            event_javascript.group.id,
        }

    def test_snuba_heavy_error_handled_boolean(self, _: MagicMock) -> None:
        # Create an event with an unhandled exception
        unhandled_event = self.store_event(
            data={
                "timestamp": before_now(seconds=300).isoformat(),
                "level": "error",
                "fingerprint": ["unhandled-group"],
                "exception": {
                    "values": [
                        {
                            "type": "UncaughtExceptionHandler",
                            "value": "Unhandled exception",
                            "mechanism": {"handled": False, "type": "generic"},
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )

        # Create an event with a handled exception
        handled_event = self.store_event(
            data={
                "timestamp": before_now(seconds=300).isoformat(),
                "fingerprint": ["handled-group"],
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "value": "Handled exception",
                            "mechanism": {"handled": True, "type": "generic"},
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        # Fetch unhandled exceptions
        response_unhandled = self.get_response(query="error.handled:false")
        assert response_unhandled.status_code == 200
        assert len(response_unhandled.data) == 1
        assert int(response_unhandled.data[0]["id"]) == unhandled_event.group.id

        # Fetch handled exceptions
        response_handled = self.get_response(query="error.handled:true")
        assert response_handled.status_code == 200
        assert len(response_handled.data) == 1
        assert int(response_handled.data[0]["id"]) == handled_event.group.id

        # Test for error.unhandled:1 (equivalent to error.handled:false)
        response_unhandled_1 = self.get_response(query="error.unhandled:1")
        assert response_unhandled_1.status_code == 200
        assert len(response_unhandled_1.data) == 1
        assert int(response_unhandled_1.data[0]["id"]) == unhandled_event.group.id

        # Test for error.unhandled:0 (equivalent to error.handled:true)
        response_handled_0 = self.get_response(query="error.unhandled:0")
        assert response_handled_0.status_code == 200
        assert len(response_handled_0.data) == 1
        assert int(response_handled_0.data[0]["id"]) == handled_event.group.id

    def run_feedback_filtered_by_default_test(self, use_group_snuba_dataset: bool) -> None:
        with Feature(
            {
                FeedbackGroup.build_visible_feature_name(): True,
                FeedbackGroup.build_ingest_feature_name(): True,
                "organizations:issue-search-snuba": use_group_snuba_dataset,
            }
        ):
            event = self.store_event(
                data={"event_id": uuid4().hex, "timestamp": before_now(seconds=1).isoformat()},
                project_id=self.project.id,
            )
            assert event.group is not None

            feedback_event = mock_feedback_event(self.project.id, before_now(seconds=1))
            create_feedback_issue(
                feedback_event, self.project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )
            self.login_as(user=self.user)
            res = self.get_success_response(useGroupSnubaDataset=use_group_snuba_dataset)

        # test that the issue returned is NOT the feedback issue.
        assert len(res.data) == 1
        issue = res.data[0]
        feedback_group = Group.objects.get(type=FeedbackGroup.type_id)
        assert int(issue["id"]) != feedback_group.id
        assert issue["issueCategory"] != "feedback"

    def test_feedback_filtered_by_default_no_snuba_search(self, _: MagicMock) -> None:
        self.run_feedback_filtered_by_default_test(False)

    def test_feedback_filtered_by_default_use_snuba_search(self, _: MagicMock) -> None:
        self.run_feedback_filtered_by_default_test(True)

    def run_feedback_category_filter_test(self, use_group_snuba_dataset: bool) -> None:
        with Feature(
            {
                FeedbackGroup.build_visible_feature_name(): True,
                FeedbackGroup.build_ingest_feature_name(): True,
                "organizations:issue-search-snuba": use_group_snuba_dataset,
            }
        ):
            event = self.store_event(
                data={"event_id": uuid4().hex, "timestamp": before_now(seconds=1).isoformat()},
                project_id=self.project.id,
            )
            assert event.group is not None

            feedback_event = mock_feedback_event(self.project.id, before_now(seconds=1))
            create_feedback_issue(
                feedback_event, self.project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )
            self.login_as(user=self.user)
            res = self.get_success_response(
                query="issue.category:feedback", useGroupSnubaDataset=use_group_snuba_dataset
            )

        # test that the issue returned IS the feedback issue.
        assert len(res.data) == 1
        issue = res.data[0]
        feedback_group = Group.objects.get(type=FeedbackGroup.type_id)
        assert int(issue["id"]) == feedback_group.id
        assert issue["issueCategory"] == "feedback"

    def test_feedback_category_filter_no_snuba_search(self, _: MagicMock) -> None:
        self.run_feedback_category_filter_test(False)

    def test_feedback_category_filter_use_snuba_search(self, _: MagicMock) -> None:
        self.run_feedback_category_filter_test(True)

    def test_flags_and_tags_query(self, _: MagicMock) -> None:
        self.login_as(self.user)
        project = self.project
        self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "contexts": {"flags": {"values": [{"flag": "test:flag", "result": True}]}},
            },
            project_id=project.id,
        )

        with self.feature({"organizations:issue-search-snuba": False}):
            response = self.get_success_response(query='flags["test:flag"]:true')
            assert len(json.loads(response.content)) == 1
            response = self.get_success_response(query='flags["test:flag"]:false')
            assert len(json.loads(response.content)) == 0

        with self.feature({"organizations:issue-search-snuba": True}):
            response = self.get_success_response(query='flags["test:flag"]:true')
            assert len(json.loads(response.content)) == 1
            response = self.get_success_response(query='flags["test:flag"]:false')
            assert len(json.loads(response.content)) == 0

    def test_postgres_query_timeout(self, mock_query: MagicMock) -> None:
        """Test that a Postgres OperationalError with QueryCanceled pgcode becomes a 429 error
        only when it's a statement timeout, and remains a 500 for user cancellation"""

        class TimeoutError(OperationalError):
            def __str__(self):
                return "canceling statement due to statement timeout"

        class UserCancelError(OperationalError):
            def __str__(self):
                return "canceling statement due to user request"

        self.login_as(user=self.user)

        mock_query.side_effect = TimeoutError()
        response = self.get_response()
        assert response.status_code == 429
        assert (
            response.data["detail"]
            == "Query timeout. Please try with a smaller date range or fewer conditions."
        )

        mock_query.side_effect = UserCancelError()
        response = self.get_response()
        assert response.status_code == 500

    def test_assigned_to_removed_team_in_project_filter(self):
        """
        Test that issues assigned to teams that have been removed from a project
        can still be found when searching within that specific project.

        This reproduces the bug reported in the Slack thread where a team was
        removed from a project but issues assigned to that team couldn't be found
        when searching within the project filter.
        """
        # Create a team and add it to the project initially
        removed_team = self.create_team(organization=self.organization, slug="removed-team")
        self.create_team_membership(team=removed_team, user=self.user)
        self.create_project_team(project=self.project, team=removed_team)

        # Create an issue and assign it to the team
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=100).isoformat(),
                "fingerprint": ["assigned-to-removed-team"],
            },
            project_id=self.project.id,
        )
        group = event.group

        # Assign the issue to the team
        from sentry.models.groupassignee import GroupAssignee
        GroupAssignee.objects.assign(group, removed_team)

        # Verify assignment works when team is still in project
        self.login_as(user=self.user)
        response = self.get_response(
            project=self.project.id,
            query=f"assigned:#{removed_team.slug}",
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group.id)

        # Remove the team from the project
        from sentry.models.projectteam import ProjectTeam
        ProjectTeam.objects.filter(project=self.project, team=removed_team).delete()

        # Verify we can still find the issue when searching within the project
        # This should work after the fix - before the fix this would return no results
        response = self.get_response(
            project=self.project.id,
            query=f"assigned:#{removed_team.slug}",
        )
        assert response.status_code == 200
        assert len(response.data) == 1, "Issue assigned to removed team should still be findable in project"
        assert response.data[0]["id"] == str(group.id)

        # Also verify it works without project filter (All Projects)
        response = self.get_response(
            query=f"assigned:#{removed_team.slug}",
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(group.id)

    def test_snuba_assignee_filter(self, _: MagicMock) -> None:

        # issue 1: assigned to user
        time = datetime.now() - timedelta(minutes=10)
        event1 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event1.group, self.user)

        # issue 2: assigned to team
        time = datetime.now() - timedelta(minutes=9)
        event2 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event2.group, self.team)

        # issue 3: suspect commit for user
        time = datetime.now() - timedelta(minutes=8)
        event3 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-3"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event3.group,
            project=event3.group.project,
            organization=event3.group.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            team_id=None,
            user_id=self.user.id,
        )

        # issue 4: ownership rule for team
        time = datetime.now() - timedelta(minutes=7)
        event4 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-4"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event4.group,
            project=event4.group.project,
            organization=event4.group.project.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            team_id=self.team.id,
            user_id=None,
        )

        # issue 5: assigned to another user
        time = datetime.now() - timedelta(minutes=6)
        event5 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-5"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event5.group, self.create_user())

        # issue 6: assigned to another team
        time = datetime.now() - timedelta(minutes=5)
        event6 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-6"]},
            project_id=self.project.id,
        )
        GroupAssignee.objects.assign(event6.group, self.create_team())

        # issue 7: suggested to another user
        time = datetime.now() - timedelta(minutes=4)
        event7 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-7"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event7.group,
            project=event7.group.project,
            organization=event7.group.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            team_id=None,
            user_id=self.create_user().id,
        )
        # issue 8: suggested to another team
        time = datetime.now() - timedelta(minutes=3)
        event8 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-8"]},
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event8.group,
            project=event8.group.project,
            organization=event8.group.project.organization,
            type=GroupOwnerType.CODEOWNERS.value,
            team_id=self.create_team().id,
            user_id=None,
        )

        # issue 9: unassigned
        time = datetime.now() - timedelta(minutes=2)
        event9 = self.store_event(
            data={"timestamp": time.timestamp(), "fingerprint": ["group-9"]},
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        queries_with_expected_ids = [
            ("assigned_or_suggested:[me]", [event3.group.id, event1.group.id]),
            ("assigned_or_suggested:[my_teams]", [event4.group.id, event2.group.id]),
            (
                "assigned_or_suggested:[me, my_teams]",
                [event4.group.id, event3.group.id, event2.group.id, event1.group.id],
            ),
            (
                "assigned_or_suggested:[me, my_teams, none]",
                [
                    event9.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                    event1.group.id,
                ],
            ),
            ("assigned_or_suggested:none", [event9.group.id]),
            ("assigned:[me]", [event1.group.id]),
            ("assigned:[my_teams]", [event2.group.id]),
            ("assigned:[me, my_teams]", [event2.group.id, event1.group.id]),
            (
                "assigned:[me, my_teams, none]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                    event1.group.id,
                ],
            ),
            (
                "assigned:none",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event4.group.id,
                    event3.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[me]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event2.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event3.group.id,
                    event1.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[me, my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                ],
            ),
            (
                "!assigned_or_suggested:[me, my_teams, none]",
                [event8.group.id, event7.group.id, event6.group.id, event5.group.id],
            ),
            (
                "!assigned_or_suggested:none",
                [
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                    event1.group.id,
                ],
            ),
            (
                "!assigned:[me]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                    event2.group.id,
                ],
            ),
            (
                "!assigned:[my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                    event1.group.id,
                ],
            ),
            (
                "!assigned:[me, my_teams]",
                [
                    event9.group.id,
                    event8.group.id,
                    event7.group.id,
                    event6.group.id,
                    event5.group.id,
                    event4.group.id,
                    event3.group.id,
                ],
            ),
            ("!assigned:[me, my_teams, none]", [event6.group.id, event5.group.id]),
            (
                "!assigned:none",
                [event6.group.id, event5.group.id, event2.group.id, event1.group.id],
            ),
        ]

        for query, expected_group_ids in queries_with_expected_ids:
            response = self.get_success_response(
                sort="new",
                query=query,
            )
            assert [int(row["id"]) for row in response.data] == expected_group_ids
