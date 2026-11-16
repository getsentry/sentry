from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import connections, router
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

import sentry.apidocs.extensions  # noqa: F401
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.deletions.tasks.scheduled import run_deletion, run_scheduled_deletions
from sentry.inbox.endpoints.organization_inbox import OrganizationInboxIndexEndpoint
from sentry.inbox.endpoints.organization_inbox_count import (
    OrganizationInboxCountEndpoint,
)
from sentry.inbox.endpoints.organization_inbox_item_events import (
    OrganizationInboxItemEventsEndpoint,
)
from sentry.inbox.event_retention import cleanup_inbox_item_events
from sentry.inbox.issue import ISSUE_PR_READY_FOR_REVIEW, IssuePRReadyForReviewData
from sentry.inbox.types import SYSTEM_ACTOR
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.link_header import parse_link_header
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token
from tests.sentry.apidocs import generate_schema


@pytest.mark.parametrize(
    "route, endpoint",
    [
        ("organizations/<str:organization_id_or_slug>/inbox/", OrganizationInboxIndexEndpoint),
        (
            "organizations/<str:organization_id_or_slug>/inbox/count/",
            OrganizationInboxCountEndpoint,
        ),
        (
            "organizations/<str:organization_id_or_slug>/inbox/<str:item_id>/events/",
            OrganizationInboxItemEventsEndpoint,
        ),
    ],
)
def test_read_api_schema(route: str, endpoint: type) -> None:
    schema = generate_schema(route, view=endpoint)
    assert schema["paths"]


def test_delete_api_schema() -> None:
    schema = generate_schema(
        "organizations/<str:organization_id_or_slug>/inbox/", view=OrganizationInboxIndexEndpoint
    )
    operation = next(iter(schema["paths"].values()))["delete"]
    assert "204" in operation["responses"]
    assert "content" not in operation["responses"]["204"]
    assert "requestBody" not in operation
    assert {"id", "subject_type", "subject_id", "event_type", "recipient", "is_read"} <= {
        parameter["name"] for parameter in operation["parameters"]
    }


@with_feature("organizations:universal-inbox")
class OrganizationInboxIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-inbox"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_list_is_personal_and_organization_scoped(self) -> None:
        item = self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item_event(inbox_item=item, data={})
        self.create_inbox_item(user=self.create_user())
        self.create_inbox_item(organization=self.create_organization())
        self.create_inbox_item(subject_id="removed", status=ObjectStatus.PENDING_DELETION)

        response = self.get_success_response(self.organization.slug)

        assert [entry["id"] for entry in response.data] == [str(item.id)]
        assert response.data[0]["title"] == self.group.title
        assert response.data[0]["subtitle"] == "Assigned to you"

    def test_recording_works_while_ui_is_off(self) -> None:
        with self.feature(
            {
                "organizations:universal-inbox": False,
                "organizations:universal-inbox-recording": True,
            }
        ):
            ISSUE_PR_READY_FOR_REVIEW.record(
                subject=self.group,
                data=IssuePRReadyForReviewData(
                    pr_url="https://github.com/example/repo/pull/1",
                    seer_run_id=123,
                ),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
            self.get_error_response(self.organization.slug, status_code=404)

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1

    def test_event_retention_preserves_api_order_and_counts(self) -> None:
        timestamp = before_now(minutes=1)
        item = self.create_inbox_item(subject_id=str(self.group.id), last_activity_at=timestamp)
        events = [
            self.create_inbox_item_event(
                inbox_item=item,
                type="issue.user_mentioned",
                data={"comment_id": index},
            )
            for index in range(103)
        ]
        item.events.update(date_added=timestamp)
        with self.options({"cleanup.inbox-events.enabled": True}):
            cleanup_inbox_item_events(item_id=item.id)

        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["eventCount"] == 100
        assert response.data[0]["unreadEventCount"] == 100
        assert response.data[0]["latestEvent"]["id"] == str(events[-1].id)
        assert response.data[0]["latestEvent"]["data"]["commentId"] == "102"
        assert response.data[0]["subtitle"] == "Mentioned you in a comment"

        response = self.client.get(
            reverse(
                "sentry-api-0-organization-inbox-item-events",
                args=[self.organization.slug, item.id],
            ),
            {"per_page": 100},
        )
        assert response.status_code == 200, response.data
        assert [event["id"] for event in response.data] == [
            str(event.id) for event in reversed(events[-100:])
        ]

    def test_subject_lookup_does_not_return_another_users_item(self) -> None:
        self.create_inbox_item(user=self.create_user(), subject_id=str(self.group.id))

        response = self.get_success_response(
            self.organization.slug, subject_type="issue", subject_id=str(self.group.id)
        )
        assert response.data == []

        item = self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item_event(inbox_item=item, data={})
        response = self.get_success_response(
            self.organization.slug, subject_type="issue", subject_id=str(self.group.id)
        )
        assert [entry["id"] for entry in response.data] == [str(item.id)]

    def test_read_and_event_filters(self) -> None:
        unread = self.create_inbox_item(subject_id="1")
        self.create_inbox_item_event(
            inbox_item=unread,
            type="issue.pr_ready_for_review",
            data={},
        )
        self.create_inbox_item_event(
            inbox_item=unread,
            type="issue.pr_ready_for_review",
            data={},
        )
        read = self.create_inbox_item(subject_id="2", last_read_at=before_now(seconds=-10))
        self.create_inbox_item_event(inbox_item=read, data={})

        response = self.get_success_response(
            self.organization.slug, is_read="false", event_type="issue.pr_ready_for_review"
        )
        assert [entry["id"] for entry in response.data] == [str(unread.id)]
        response = self.get_success_response(self.organization.slug, is_read="true")
        assert [entry["id"] for entry in response.data] == [str(read.id)]
        response = self.get_success_response(self.organization.slug, id=[str(read.id)])
        assert [entry["id"] for entry in response.data] == [str(read.id)]
        response = self.get_success_response(
            self.organization.slug,
            id=[str(read.id), str(unread.id)],
            event_type=["issue.user_assigned", "issue.pr_ready_for_review"],
            subject_type=["issue", "issue"],
        )
        assert {entry["id"] for entry in response.data} == {str(read.id), str(unread.id)}

    def test_assignment_event_filters(self) -> None:
        individual = self.create_inbox_item(subject_id="1")
        self.create_inbox_item_event(inbox_item=individual, type="issue.user_assigned", data={})
        team = self.create_inbox_item(subject_id="2")
        self.create_inbox_item_event(
            inbox_item=team,
            type="issue.team_assigned",
            data={},
        )

        response = self.get_success_response(
            self.organization.slug, event_type="issue.user_assigned"
        )
        assert [entry["id"] for entry in response.data] == [str(individual.id)]

        response = self.get_success_response(
            self.organization.slug, event_type="issue.team_assigned"
        )
        assert [entry["id"] for entry in response.data] == [str(team.id)]

    def test_recipient_filter(self) -> None:
        items_by_recipient: dict[str, list[str]] = {"team": [], "user": []}
        for index, (recipient, event_type) in enumerate(
            [
                ("team", "issue.team_assigned"),
                ("team", "issue.team_mentioned"),
                ("team", "notebook.team_mentioned"),
                ("user", "issue.user_assigned"),
                ("user", "issue.user_mentioned"),
                ("user", "issue.pr_ready_for_review"),
                ("user", "notebook.completed"),
                ("user", "notebook.user_mentioned"),
                ("user", "notebook.participant_added"),
            ]
        ):
            item = self.create_inbox_item(
                subject_type=event_type.partition(".")[0], subject_id=str(index + 1)
            )
            self.create_inbox_item_event(
                inbox_item=item, type=event_type, data={"summary": "Inbox update"}
            )
            self.create_inbox_item_event(
                inbox_item=item, type=event_type, data={"summary": "Another inbox update"}
            )
            items_by_recipient[recipient].append(str(item.id))
        self.create_inbox_item_event(
            inbox_item=self.create_inbox_item(user=self.create_user()), type="issue.team_assigned"
        )
        self.create_inbox_item_event(
            inbox_item=self.create_inbox_item(organization=self.create_organization()),
            type="issue.user_assigned",
        )

        response = self.get_success_response(self.organization.slug, recipient="team")
        assert {entry["id"] for entry in response.data} == set(items_by_recipient["team"])

        response = self.get_success_response(self.organization.slug, recipient="user")
        assert {entry["id"] for entry in response.data} == set(items_by_recipient["user"])

        response = self.get_success_response(self.organization.slug, recipient=["team", "user"])
        assert {entry["id"] for entry in response.data} == set(
            items_by_recipient["team"] + items_by_recipient["user"]
        )

    def test_recipient_and_event_type_match_the_same_event(self) -> None:
        item = self.create_inbox_item()
        self.create_inbox_item_event(
            inbox_item=item, type="issue.team_mentioned", data={"summary": "Mentioned your team"}
        )
        self.create_inbox_item_event(
            inbox_item=item, type="issue.user_assigned", data={"summary": "Assigned to you"}
        )

        response = self.get_success_response(
            self.organization.slug, recipient="team", event_type="issue.user_assigned"
        )
        assert response.data == []

        response = self.get_success_response(
            self.organization.slug, recipient="team", event_type="issue.team_mentioned"
        )
        assert [entry["id"] for entry in response.data] == [str(item.id)]

        response = self.get_success_response(self.organization.slug, recipient="user")
        assert [entry["id"] for entry in response.data] == [str(item.id)]

    def test_invalid_filters(self) -> None:
        for params in (
            {"subject_type": "unknown"},
            {"event_type": "unknown"},
            {"event_type": ["issue.user_assigned", "unknown"]},
            {"recipient": "unknown"},
            {"recipient": ["team", "unknown"]},
            {"subject_id": "1"},
            {"subject_type": ["issue", "issue"], "subject_id": "1"},
            {"is_read": "unknown"},
            {"is_read": "1"},
            {"id": "invalid"},
            {"id": ["1", "invalid"]},
            {"cursor": "invalid:0:0"},
            {"cursor": "invalid_1:0:0"},
            {"cursor": "1577836800000000_invalid:0:0"},
            {"cursor": "1577836800000000_1:1:0"},
            {"cursor": "999999999999999999999999_1:0:0"},
            {"per_page": 0},
            {"per_page": 101},
        ):
            with self.subTest(params=params):
                response = self.get_error_response(
                    self.organization.slug, status_code=400, **params
                )
                assert "detail" in response.data

    def test_member_with_read_scope_and_no_project_membership(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        item = self.create_inbox_item(user=member, subject_id=str(self.group.id))
        self.create_inbox_item_event(inbox_item=item, actor=self.user, data={})
        token = self.create_user_auth_token(user=member, scope_list=["org:read"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()

        response = self.get_success_response(
            self.organization.slug, extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"}
        )

        assert [entry["id"] for entry in response.data] == [str(item.id)]
        assert response.data[0]["title"] == self.group.title
        assert response.data[0]["latestEvent"]["actor"]["id"] == str(self.user.id)

    def test_org_token_is_rejected(self) -> None:
        token = generate_token(self.organization.slug, "")
        self.create_org_auth_token(
            organization_id=self.organization.id,
            name="Inbox test token",
            token_hashed=hash_token(token),
            token_last_characters=token[-4:],
            scope_list=["org:read"],
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()

        self.get_error_response(
            self.organization.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token}"},
            status_code=403,
        )

    def test_stable_pagination_with_equal_timestamps(self) -> None:
        timestamp = before_now(minutes=1).replace(microsecond=123456)
        items = [
            self.create_inbox_item(subject_id=str(index), last_activity_at=timestamp)
            for index in range(4)
        ]
        for item in items:
            self.create_inbox_item_event(inbox_item=item, data={})

        first = self.get_success_response(self.organization.slug, per_page=2)
        assert [entry["id"] for entry in first.data] == [str(items[3].id), str(items[2].id)]
        next_url = next(
            url for url, attrs in parse_link_header(first["Link"]).items() if attrs["rel"] == "next"
        )
        second = self.client.get(next_url)
        assert second.status_code == 200, second.data
        assert [entry["id"] for entry in second.data] == [str(items[1].id), str(items[0].id)]
        previous_url = next(
            url
            for url, attrs in parse_link_header(second["Link"]).items()
            if attrs["rel"] == "previous"
        )
        back = self.client.get(previous_url)
        assert back.status_code == 200, back.data
        assert [entry["id"] for entry in back.data] == [str(items[3].id), str(items[2].id)]

    def test_partial_last_page(self) -> None:
        timestamp = before_now(minutes=1)
        items = [
            self.create_inbox_item(subject_id=str(index), last_activity_at=timestamp)
            for index in range(3)
        ]
        for item in items:
            self.create_inbox_item_event(inbox_item=item, data={})

        first = self.get_success_response(self.organization.slug, per_page=2)
        first_links = {
            attrs["rel"]: (url, attrs) for url, attrs in parse_link_header(first["Link"]).items()
        }
        assert first_links["previous"][1]["results"] == "false"
        assert first_links["next"][1]["results"] == "true"

        last = self.client.get(first_links["next"][0])
        assert last.status_code == 200, last.data
        assert [entry["id"] for entry in last.data] == [str(items[0].id)]
        last_links = {
            attrs["rel"]: (url, attrs) for url, attrs in parse_link_header(last["Link"]).items()
        }
        assert last_links["previous"][1]["results"] == "true"
        assert last_links["next"][1]["results"] == "false"

        back = self.client.get(last_links["previous"][0])
        assert back.status_code == 200, back.data
        assert [entry["id"] for entry in back.data] == [str(items[2].id), str(items[1].id)]

    def test_empty_inbox_pagination(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data == []
        links = parse_link_header(response["Link"])
        assert [attrs["results"] for attrs in links.values()] == ["false", "false"]
        for url in links:
            page = self.client.get(url)
            assert page.status_code == 200, page.data
            assert page.data == []

    def test_pagination_after_boundary_item_is_deleted(self) -> None:
        items = [self.create_inbox_item(subject_id=str(index)) for index in range(3)]
        for item in items:
            self.create_inbox_item_event(inbox_item=item, data={})

        first = self.get_success_response(self.organization.slug, per_page=1)
        assert [entry["id"] for entry in first.data] == [str(items[2].id)]
        next_url = next(
            url for url, attrs in parse_link_header(first["Link"]).items() if attrs["rel"] == "next"
        )
        items[2].delete()

        second = self.client.get(next_url)
        assert second.status_code == 200, second.data
        assert [entry["id"] for entry in second.data] == [str(items[1].id)]


@with_feature("organizations:universal-inbox")
class OrganizationInboxUpdateTest(APITestCase):
    endpoint = "sentry-api-0-organization-inbox"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    @freeze_time()
    def test_mark_all_read_in_one_update(self) -> None:
        items = [self.create_inbox_item(subject_id=str(index)) for index in range(3)]
        for _ in range(2):
            self.create_inbox_item_event(inbox_item=items[0], data={})
        other_user = self.create_inbox_item(user=self.create_user())
        other_org = self.create_inbox_item(organization=self.create_organization())
        removed = self.create_inbox_item(subject_id="removed", status=ObjectStatus.PENDING_DELETION)

        with CaptureQueriesContext(connections[router.db_for_write(InboxItem)]) as queries:
            response = self.get_success_response(self.organization.slug, isRead=True)

        assert response.data == {"updatedCount": 3}
        updates = [
            query
            for query in queries
            if query["sql"].startswith('UPDATE "notifications_inboxitem"')
        ]
        assert len(updates) == 1
        for item in items:
            item.refresh_from_db()
            assert item.last_read_at == timezone.now()
        for untouched in (other_user, other_org, removed):
            untouched.refresh_from_db()
            assert untouched.last_read_at is None
        response = self.client.get(
            reverse(
                "sentry-api-0-organization-inbox-item-events",
                args=[self.organization.slug, items[0].id],
            )
        )
        assert response.status_code == 200
        assert [event["isUnread"] for event in response.data] == [False, False]

    def test_mark_selected_items_unread(self) -> None:
        selected = self.create_inbox_item(last_read_at=timezone.now())
        other = self.create_inbox_item(subject_id="other", last_read_at=timezone.now())

        response = self.get_success_response(
            self.organization.slug, qs_params={"id": [selected.id]}, isRead=False
        )

        assert response.data == {"updatedCount": 1}
        selected.refresh_from_db()
        other.refresh_from_db()
        assert selected.last_read_at is None
        assert other.last_read_at is not None

    def test_restoring_is_personal_and_organization_scoped(self) -> None:
        removed = self.create_inbox_item(status=ObjectStatus.PENDING_DELETION)
        other_user = self.create_inbox_item(
            user=self.create_user(), status=ObjectStatus.PENDING_DELETION
        )
        other_org = self.create_inbox_item(
            organization=self.create_organization(), status=ObjectStatus.PENDING_DELETION
        )
        deleting = self.create_inbox_item(
            subject_id="deleting", status=ObjectStatus.DELETION_IN_PROGRESS
        )
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"id": [removed.id, other_user.id, other_org.id, deleting.id, 0]},
            undoRemoval=True,
        )

        assert response.data == {"updatedCount": 1}
        removed.refresh_from_db()
        assert removed.status == ObjectStatus.ACTIVE
        assert removed.last_read_at is None
        other_user.refresh_from_db()
        other_org.refresh_from_db()
        deleting.refresh_from_db()
        assert other_user.status == ObjectStatus.PENDING_DELETION
        assert other_org.status == ObjectStatus.PENDING_DELETION
        assert deleting.status == ObjectStatus.DELETION_IN_PROGRESS

    @freeze_time()
    def test_restore_and_mark_read(self) -> None:
        item = self.create_inbox_item(status=ObjectStatus.PENDING_DELETION)

        response = self.get_success_response(self.organization.slug, undoRemoval=True, isRead=True)

        assert response.data == {"updatedCount": 1}
        item.refresh_from_db()
        assert item.status == ObjectStatus.ACTIVE
        assert item.last_read_at == timezone.now()

    def test_undo_removal_false_has_no_effect(self) -> None:
        active = self.create_inbox_item(subject_id="active")
        removed = self.create_inbox_item(status=ObjectStatus.PENDING_DELETION)

        response = self.get_success_response(self.organization.slug, undoRemoval=False)

        assert response.data == {"updatedCount": 0}
        active.refresh_from_db()
        removed.refresh_from_db()
        assert active.status == ObjectStatus.ACTIVE
        assert active.last_read_at is None
        assert removed.status == ObjectStatus.PENDING_DELETION
        assert removed.last_read_at is None

    @freeze_time()
    def test_undo_removal_false_only_updates_active_items_read_state(self) -> None:
        active = self.create_inbox_item(subject_id="active")
        removed = self.create_inbox_item(status=ObjectStatus.PENDING_DELETION)

        response = self.get_success_response(self.organization.slug, undoRemoval=False, isRead=True)

        assert response.data == {"updatedCount": 1}
        active.refresh_from_db()
        removed.refresh_from_db()
        assert active.status == ObjectStatus.ACTIVE
        assert active.last_read_at == timezone.now()
        assert removed.status == ObjectStatus.PENDING_DELETION
        assert removed.last_read_at is None

    def test_shared_filters_intersect(self) -> None:
        target = self.create_inbox_item(subject_id="1")
        self.create_inbox_item_event(inbox_item=target, type="issue.user_assigned")
        self.create_inbox_item_event(inbox_item=target, type="issue.user_assigned")
        other_event = self.create_inbox_item(subject_id="2")
        self.create_inbox_item_event(inbox_item=other_event, type="issue.user_mentioned")
        already_read = self.create_inbox_item(
            subject_id="3", last_activity_at=before_now(minutes=1), last_read_at=timezone.now()
        )
        self.create_inbox_item_event(inbox_item=already_read, type="issue.user_assigned")

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "id": [target.id, other_event.id, already_read.id],
                "subject_type": ["issue"],
                "event_type": ["issue.user_assigned"],
                "is_read": "false",
            },
            isRead=True,
        )

        assert response.data == {"updatedCount": 1}
        target.refresh_from_db()
        other_event.refresh_from_db()
        assert target.last_read_at is not None
        assert other_event.last_read_at is None

    def test_recipient_filter(self) -> None:
        team = self.create_inbox_item(subject_id="team")
        self.create_inbox_item_event(inbox_item=team, type="issue.team_assigned")
        user = self.create_inbox_item(subject_id="user")
        self.create_inbox_item_event(inbox_item=user, type="issue.user_assigned")

        response = self.get_success_response(
            self.organization.slug, qs_params={"recipient": "team"}, isRead=True
        )

        assert response.data == {"updatedCount": 1}
        team.refresh_from_db()
        user.refresh_from_db()
        assert team.last_read_at is not None
        assert user.last_read_at is None

    def test_subject_filter(self) -> None:
        target = self.create_inbox_item(subject_id="1")
        other = self.create_inbox_item(subject_id="2")
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"subject_type": "issue", "subject_id": "1"},
            isRead=True,
        )
        assert response.data == {"updatedCount": 1}
        target.refresh_from_db()
        other.refresh_from_db()
        assert target.last_read_at is not None
        assert other.last_read_at is None

    def test_no_matches(self) -> None:
        item = self.create_inbox_item()
        response = self.get_success_response(
            self.organization.slug, qs_params={"id": [0]}, isRead=False
        )
        assert response.data == {"updatedCount": 0}
        item.refresh_from_db()
        assert item.last_read_at is None

    def test_invalid_body(self) -> None:
        item = self.create_inbox_item()
        for data in (
            {},
            {"isRead": None},
            {"isRead": "invalid"},
            {"undoRemoval": None},
            {"undoRemoval": "invalid"},
            {"isRead": True, "undoRemoval": "invalid"},
            {"isRemoved": False},
            {"isRemoved": True},
        ):
            with self.subTest(data=data):
                response = self.get_error_response(self.organization.slug, status_code=400, **data)
                assert "detail" in response.data
        item.refresh_from_db()
        assert item.last_read_at is None

    def test_invalid_filters(self) -> None:
        item = self.create_inbox_item()
        for filters in (
            {"recipient": "invalid"},
            {"id": "invalid"},
            {"subject_type": "unknown"},
            {"event_type": "unknown"},
            {"subject_id": "1"},
            {"is_read": "invalid"},
        ):
            with self.subTest(filters=filters):
                response = self.get_error_response(
                    self.organization.slug, qs_params=filters, isRead=True, status_code=400
                )
                assert "detail" in response.data
        item.refresh_from_db()
        assert item.last_read_at is None

    def test_member_with_read_scope_and_no_project_membership(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        item = self.create_inbox_item(user=member)
        token = self.create_user_auth_token(user=member, scope_list=["org:read"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()

        response = self.get_success_response(
            self.organization.slug,
            isRead=True,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

        assert response.data == {"updatedCount": 1}
        item.refresh_from_db()
        assert item.last_read_at is not None

    def test_org_token_is_rejected(self) -> None:
        token = generate_token(self.organization.slug, "")
        self.create_org_auth_token(
            organization_id=self.organization.id,
            name="Inbox test token",
            token_hashed=hash_token(token),
            token_last_characters=token[-4:],
            scope_list=["org:read"],
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
        self.get_error_response(
            self.organization.slug,
            isRead=True,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token}"},
            status_code=403,
        )

    def test_feature_disabled(self) -> None:
        with self.feature({"organizations:universal-inbox": False}):
            self.get_error_response(self.organization.slug, isRead=True, status_code=404)


@with_feature("organizations:universal-inbox")
class OrganizationInboxDeleteTest(APITestCase):
    endpoint = "sentry-api-0-organization-inbox"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    @freeze_time()
    def test_remove_all_is_scoped_and_uses_bulk_queries(self) -> None:
        items = [self.create_inbox_item(subject_id=str(index)) for index in range(3)]
        events = [self.create_inbox_item_event(item) for item in items]
        other_user = self.create_inbox_item(user=self.create_user())
        other_org = self.create_inbox_item(organization=self.create_organization())
        deleting = self.create_inbox_item(
            subject_id="deleting", status=ObjectStatus.DELETION_IN_PROGRESS
        )

        with CaptureQueriesContext(connections[router.db_for_write(InboxItem)]) as queries:
            self.get_success_response(self.organization.slug)

        updates = [
            query
            for query in queries
            if query["sql"].startswith('UPDATE "notifications_inboxitem"')
        ]
        inserts = [
            query
            for query in queries
            if query["sql"].startswith('INSERT INTO "sentry_regionscheduleddeletion"')
        ]
        assert len(updates) == 1
        assert len(inserts) == 1
        for item in items:
            item.refresh_from_db()
            assert item.status == ObjectStatus.PENDING_DELETION
            assert item.last_read_at is None
        for item in (other_user, other_org):
            item.refresh_from_db()
            assert item.status == ObjectStatus.ACTIVE
        deleting.refresh_from_db()
        assert deleting.status == ObjectStatus.DELETION_IN_PROGRESS
        scheduled = CellScheduledDeletion.objects.filter(model_name="InboxItem")
        assert {record.object_id for record in scheduled} == {item.id for item in items}
        for record in scheduled:
            assert record.app_label == InboxItem._meta.app_label
            assert record.date_scheduled == timezone.now() + timedelta(hours=1)
            assert record.actor_id == self.user.id
        assert InboxItemEvent.objects.filter(id__in=[event.id for event in events]).count() == 3

        response = self.client.get(reverse(self.endpoint, args=[self.organization.slug]))
        assert response.status_code == 200
        assert response.data == []
        response = self.client.get(
            reverse("sentry-api-0-organization-inbox-count", args=[self.organization.slug]),
            {"is_read": "false"},
        )
        assert response.status_code == 200
        assert response.data == {"count": 0}

    def test_selected_ids_cannot_remove_other_inboxes(self) -> None:
        target = self.create_inbox_item(subject_id="target")
        untouched = self.create_inbox_item(subject_id="untouched")
        other_user = self.create_inbox_item(user=self.create_user())
        other_org = self.create_inbox_item(organization=self.create_organization())

        self.get_success_response(
            self.organization.slug,
            qs_params={"id": [target.id, target.id, other_user.id, other_org.id, 0]},
        )

        target.refresh_from_db()
        assert target.status == ObjectStatus.PENDING_DELETION
        for item in (untouched, other_user, other_org):
            item.refresh_from_db()
            assert item.status == ObjectStatus.ACTIVE
        assert list(
            CellScheduledDeletion.objects.filter(model_name="InboxItem").values_list(
                "object_id", flat=True
            )
        ) == [target.id]

    def test_shared_filters_intersect(self) -> None:
        target = self.create_inbox_item(subject_id="1")
        self.create_inbox_item_event(target, type="issue.user_assigned")
        self.create_inbox_item_event(target, type="issue.user_assigned")
        other_event = self.create_inbox_item(subject_id="2")
        self.create_inbox_item_event(other_event, type="issue.user_mentioned")
        already_read = self.create_inbox_item(
            subject_id="3", last_activity_at=before_now(minutes=1), last_read_at=timezone.now()
        )
        self.create_inbox_item_event(already_read, type="issue.user_assigned")

        self.get_success_response(
            self.organization.slug,
            qs_params={
                "id": [target.id, other_event.id, already_read.id],
                "subject_type": ["issue"],
                "event_type": ["issue.user_assigned"],
                "is_read": "false",
            },
        )

        assert list(
            InboxItem.objects.filter(status=ObjectStatus.PENDING_DELETION).values_list(
                "id", flat=True
            )
        ) == [target.id]
        assert CellScheduledDeletion.objects.filter(model_name="InboxItem").count() == 1

    @freeze_time()
    def test_repeated_removal_does_not_extend_grace_period(self) -> None:
        item = self.create_inbox_item()
        self.get_success_response(self.organization.slug)
        scheduled = CellScheduledDeletion.objects.get(model_name="InboxItem", object_id=item.id)
        original_due = scheduled.date_scheduled

        with freeze_time(timezone.now() + timedelta(minutes=10)):
            self.get_success_response(self.organization.slug)

        scheduled.refresh_from_db()
        assert scheduled.date_scheduled == original_due
        assert CellScheduledDeletion.objects.filter(model_name="InboxItem").count() == 1

    @freeze_time()
    def test_events_and_item_are_deleted_only_after_grace_period(self) -> None:
        item = self.create_inbox_item()
        event = self.create_inbox_item_event(item)
        self.get_success_response(self.organization.slug)

        with freeze_time(timezone.now() + timedelta(minutes=59)), self.tasks():
            run_scheduled_deletions()
        assert InboxItem.objects.filter(id=item.id).exists()
        assert InboxItemEvent.objects.filter(id=event.id).exists()

        with freeze_time(timezone.now() + timedelta(hours=1)), self.tasks():
            run_scheduled_deletions()
        assert not InboxItem.objects.filter(id=item.id).exists()
        assert not InboxItemEvent.objects.filter(id=event.id).exists()
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    @freeze_time()
    def test_restoring_preserves_item_and_events(self) -> None:
        item = self.create_inbox_item()
        event = self.create_inbox_item_event(item)
        self.get_success_response(self.organization.slug)
        self.get_success_response(self.organization.slug, method="put", undoRemoval=True)

        with freeze_time(timezone.now() + timedelta(hours=1)), self.tasks():
            run_scheduled_deletions()

        item.refresh_from_db()
        assert item.status == ObjectStatus.ACTIVE
        assert InboxItemEvent.objects.filter(id=event.id).exists()
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    @freeze_time()
    def test_removing_a_restored_item_invalidates_queued_deletion(self) -> None:
        item = self.create_inbox_item()
        event = self.create_inbox_item_event(item)
        self.get_success_response(self.organization.slug)
        original = CellScheduledDeletion.objects.get(model_name="InboxItem", object_id=item.id)

        with freeze_time(original.date_scheduled):
            CellScheduledDeletion.objects.filter(id=original.id).update(in_progress=True)
            self.get_success_response(self.organization.slug, method="put", undoRemoval=True)
            self.get_success_response(self.organization.slug)
            scheduled = CellScheduledDeletion.objects.get(model_name="InboxItem", object_id=item.id)
            assert scheduled.date_scheduled == timezone.now() + timedelta(hours=1)
            with self.tasks():
                run_deletion(deletion_id=original.id)

        assert InboxItem.objects.filter(id=item.id, status=ObjectStatus.PENDING_DELETION).exists()
        assert InboxItemEvent.objects.filter(id=event.id).exists()
        assert CellScheduledDeletion.objects.filter(model_name="InboxItem").count() == 1

    def test_no_matches(self) -> None:
        item = self.create_inbox_item()
        self.get_success_response(self.organization.slug, qs_params={"id": [0]})
        item.refresh_from_db()
        assert item.status == ObjectStatus.ACTIVE
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    def test_recipient_filter(self) -> None:
        team = self.create_inbox_item(subject_id="team")
        self.create_inbox_item_event(inbox_item=team, type="issue.team_assigned")
        user = self.create_inbox_item(subject_id="user")
        self.create_inbox_item_event(inbox_item=user, type="issue.user_assigned")

        self.get_success_response(self.organization.slug, qs_params={"recipient": "team"})

        team.refresh_from_db()
        user.refresh_from_db()
        assert team.status == ObjectStatus.PENDING_DELETION
        assert user.status == ObjectStatus.ACTIVE
        assert list(
            CellScheduledDeletion.objects.filter(model_name="InboxItem").values_list(
                "object_id", flat=True
            )
        ) == [team.id]

    def test_invalid_filters_do_not_remove_items(self) -> None:
        item = self.create_inbox_item()
        for filters in (
            {"recipient": "invalid"},
            {"id": "invalid"},
            {"subject_type": "unknown"},
            {"event_type": "unknown"},
            {"subject_id": "1"},
            {"is_read": "invalid"},
        ):
            with self.subTest(filters=filters):
                response = self.get_error_response(
                    self.organization.slug, qs_params=filters, status_code=400
                )
                assert "detail" in response.data
        item.refresh_from_db()
        assert item.status == ObjectStatus.ACTIVE
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    def test_scheduling_failure_rolls_back_removal(self) -> None:
        item = self.create_inbox_item()
        with patch.object(
            CellScheduledDeletion.objects,
            "bulk_create",
            side_effect=RuntimeError("schedule failed"),
        ):
            self.get_error_response(self.organization.slug, status_code=500)
        item.refresh_from_db()
        assert item.status == ObjectStatus.ACTIVE
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    def test_member_with_read_scope_and_no_project_membership(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        item = self.create_inbox_item(user=member)
        token = self.create_user_auth_token(user=member, scope_list=["org:read"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()

        self.get_success_response(
            self.organization.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

        item.refresh_from_db()
        assert item.status == ObjectStatus.PENDING_DELETION

    def test_org_token_is_rejected(self) -> None:
        token = generate_token(self.organization.slug, "")
        self.create_org_auth_token(
            organization_id=self.organization.id,
            name="Inbox test token",
            token_hashed=hash_token(token),
            token_last_characters=token[-4:],
            scope_list=["org:read"],
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
        self.get_error_response(
            self.organization.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token}"},
            status_code=403,
        )

    def test_feature_disabled(self) -> None:
        with self.feature({"organizations:universal-inbox": False}):
            self.get_error_response(self.organization.slug, status_code=404)
