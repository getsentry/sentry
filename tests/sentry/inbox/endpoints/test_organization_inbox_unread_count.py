from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:universal-inbox")
class OrganizationInboxUnreadCountTest(APITestCase):
    endpoint = "sentry-api-0-organization-inbox-unread-count"

    def test_counts_only_the_viewers_active_unread_items(self) -> None:
        self.login_as(self.user)
        self.create_inbox_item(subject_id="unread")
        self.create_inbox_item(subject_id="newer", last_read_at=before_now(minutes=1))
        self.create_inbox_item(subject_id="read", last_read_at=before_now(seconds=-10))
        self.create_inbox_item(subject_id="removed", status=ObjectStatus.PENDING_DELETION)
        self.create_inbox_item(user=self.create_user())
        self.create_inbox_item(organization=self.create_organization())

        response = self.get_success_response(self.organization.slug)

        assert response.data == {"count": 2}

    def test_feature_disabled(self) -> None:
        self.login_as(self.user)
        with self.feature({"organizations:universal-inbox": False}):
            self.get_error_response(self.organization.slug, status_code=404)
