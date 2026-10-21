import pytest

import sentry.apidocs.extensions  # noqa: F401
from sentry.constants import ObjectStatus
from sentry.inbox.endpoints.organization_inbox import OrganizationInboxIndexEndpoint
from sentry.inbox.endpoints.organization_inbox_item_events import (
    OrganizationInboxItemEventsEndpoint,
)
from sentry.inbox.endpoints.organization_inbox_unread_count import (
    OrganizationInboxUnreadCountEndpoint,
)
from sentry.inbox.issue import ISSUE_PR_READY_FOR_REVIEW, IssuePRReadyForReviewData
from sentry.inbox.types import SYSTEM_ACTOR
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
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
            "organizations/<str:organization_id_or_slug>/inbox/unread-count/",
            OrganizationInboxUnreadCountEndpoint,
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


@with_feature("organizations:universal-inbox")
class OrganizationInboxIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-inbox"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_list_is_personal_and_organization_scoped(self) -> None:
        item = self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item_event(inbox_item=item, data={"summary": "Assigned to you"})
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
                    summary="Pull request ready for review",
                    pr_url="https://github.com/example/repo/pull/1",
                    seer_run_id=123,
                ),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
            self.get_error_response(self.organization.slug, status_code=404)

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1

    def test_subject_lookup_does_not_return_another_users_item(self) -> None:
        self.create_inbox_item(user=self.create_user(), subject_id=str(self.group.id))

        response = self.get_success_response(
            self.organization.slug, subject_type="issue", subject_id=str(self.group.id)
        )
        assert response.data == []

        item = self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item_event(inbox_item=item, data={"summary": "An assignment"})
        response = self.get_success_response(
            self.organization.slug, subject_type="issue", subject_id=str(self.group.id)
        )
        assert [entry["id"] for entry in response.data] == [str(item.id)]

    def test_read_and_event_filters(self) -> None:
        unread = self.create_inbox_item(subject_id="1")
        self.create_inbox_item_event(
            inbox_item=unread,
            type="issue.pr_ready_for_review",
            data={"summary": "Pull request ready for review"},
        )
        self.create_inbox_item_event(
            inbox_item=unread,
            type="issue.pr_ready_for_review",
            data={"summary": "Another pull request ready for review"},
        )
        read = self.create_inbox_item(subject_id="2", last_read_at=before_now(seconds=-10))
        self.create_inbox_item_event(inbox_item=read, data={"summary": "Assigned to you"})

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
            event_type=["issue.assigned", "issue.pr_ready_for_review"],
            subject_type=["issue", "issue"],
        )
        assert {entry["id"] for entry in response.data} == {str(read.id), str(unread.id)}

    def test_invalid_filters(self) -> None:
        for params in (
            {"subject_type": "unknown"},
            {"event_type": "unknown"},
            {"event_type": ["issue.assigned", "unknown"]},
            {"subject_id": "1"},
            {"subject_type": ["issue", "issue"], "subject_id": "1"},
            {"is_read": "unknown"},
            {"is_read": "1"},
            {"id": "invalid"},
            {"id": ["1", "invalid"]},
            {"cursor": "invalid:0:0"},
            {"per_page": 0},
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
        self.create_inbox_item_event(
            inbox_item=item, actor=self.user, data={"summary": "Assigned to you"}
        )
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
        timestamp = before_now(minutes=1).replace(microsecond=0)
        items = [
            self.create_inbox_item(subject_id=str(index), last_activity_at=timestamp)
            for index in range(4)
        ]
        for item in items:
            self.create_inbox_item_event(inbox_item=item, data={"summary": "An assignment"})

        first = self.get_success_response(self.organization.slug, per_page=2)
        assert [entry["id"] for entry in first.data] == [str(items[3].id), str(items[2].id)]
        next_cursor = next(
            attrs["cursor"]
            for attrs in parse_link_header(first["Link"]).values()
            if attrs["rel"] == "next"
        )
        second = self.get_success_response(self.organization.slug, per_page=2, cursor=next_cursor)
        assert [entry["id"] for entry in second.data] == [str(items[1].id), str(items[0].id)]
        cursor = next(
            attrs["cursor"]
            for attrs in parse_link_header(second["Link"]).values()
            if attrs["rel"] == "previous"
        )
        back = self.get_success_response(self.organization.slug, per_page=2, cursor=cursor)
        assert [entry["id"] for entry in back.data] == [str(items[3].id), str(items[2].id)]
