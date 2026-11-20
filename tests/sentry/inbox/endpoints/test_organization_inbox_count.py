from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:universal-inbox")
class OrganizationInboxCountTest(APITestCase):
    endpoint = "sentry-api-0-organization-inbox-count"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_counts_only_the_viewers_active_items(self) -> None:
        self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item(
            subject_id=str(self.create_group().id), last_read_at=before_now(minutes=1)
        )
        read_at = before_now(minutes=1)
        self.create_inbox_item(
            subject_id=str(self.create_group().id), last_activity_at=read_at, last_read_at=read_at
        )
        self.create_inbox_item(
            subject_id=str(self.create_group().id), status=ObjectStatus.PENDING_DELETION
        )
        self.create_inbox_item(user=self.create_user(), subject_id=str(self.group.id))
        other_org = self.create_organization()
        other_group = self.create_group(project=self.create_project(organization=other_org))
        self.create_inbox_item(organization=other_org, subject_id=str(other_group.id))
        self.create_inbox_item(subject_id=str(other_group.id))

        response = self.get_success_response(self.organization.slug)

        assert response.data == {"count": 3}

        response = self.get_success_response(self.organization.slug, is_read="false")
        assert response.data == {"count": 2}

        response = self.get_success_response(self.organization.slug, is_read="true")
        assert response.data == {"count": 1}

    def test_subject_event_and_id_filters(self) -> None:
        first = self.create_inbox_item(subject_id=str(self.group.id))
        second = self.create_inbox_item(subject_id=str(self.create_group().id))
        self.create_inbox_item(subject_type="other", subject_id=first.subject_id)
        self.create_inbox_item_event(
            inbox_item=first, type="issue.pr_ready_for_review", data={"summary": "PR ready"}
        )
        self.create_inbox_item_event(
            inbox_item=first, type="issue.pr_ready_for_review", data={"summary": "Another PR ready"}
        )

        response = self.get_success_response(self.organization.slug, subject_type="issue")
        assert response.data == {"count": 2}

        response = self.get_success_response(
            self.organization.slug, subject_type="issue", subject_id=first.subject_id
        )
        assert response.data == {"count": 1}

        response = self.get_success_response(
            self.organization.slug, event_type="issue.pr_ready_for_review"
        )
        assert response.data == {"count": 1}

        response = self.get_success_response(
            self.organization.slug, id=[str(first.id), str(second.id)]
        )
        assert response.data == {"count": 2}

    def test_recipient_filter(self) -> None:
        team = self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item_event(inbox_item=team, type="issue.team_assigned")
        self.create_inbox_item_event(inbox_item=team, type="issue.team_mentioned")
        user = self.create_inbox_item(subject_id=str(self.create_group().id))
        self.create_inbox_item_event(inbox_item=user, type="issue.pr_ready_for_review")

        response = self.get_success_response(self.organization.slug, recipient="team")
        assert response.data == {"count": 1}
        response = self.get_success_response(self.organization.slug, recipient="user")
        assert response.data == {"count": 1}
        response = self.get_success_response(self.organization.slug, recipient=["team", "user"])
        assert response.data == {"count": 2}

    def test_invalid_filters(self) -> None:
        for params in (
            {"subject_type": "unknown"},
            {"subject_id": "1"},
            {"event_type": "unknown"},
            {"recipient": "invalid"},
            {"is_read": "invalid"},
        ):
            with self.subTest(params=params):
                response = self.get_error_response(
                    self.organization.slug, status_code=400, **params
                )
                assert "detail" in response.data

    def test_feature_disabled(self) -> None:
        with self.feature({"organizations:universal-inbox": False}):
            self.get_error_response(self.organization.slug, status_code=404)
