from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:universal-inbox")
class OrganizationInboxItemEventsTest(APITestCase):
    endpoint = "sentry-api-0-organization-inbox-item-events"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_list_events(self) -> None:
        item = self.create_inbox_item(last_read_at=before_now(minutes=2))
        older = self.create_inbox_item_event(inbox_item=item, data={"summary": "Older"})
        older.update(date_added=before_now(minutes=5))
        newer = self.create_inbox_item_event(inbox_item=item, data={"summary": "Newer"})

        response = self.get_success_response(self.organization.slug, item.id)

        assert [event["id"] for event in response.data] == [str(newer.id), str(older.id)]
        assert [event["isUnread"] for event in response.data] == [True, False]

    def test_another_users_item(self) -> None:
        item = self.create_inbox_item(user=self.create_user())
        self.get_error_response(self.organization.slug, item.id, status_code=404)

    def test_other_organization(self) -> None:
        item = self.create_inbox_item(organization=self.create_organization())
        self.get_error_response(self.organization.slug, item.id, status_code=404)

    def test_removed_item(self) -> None:
        item = self.create_inbox_item(status=ObjectStatus.PENDING_DELETION)
        self.get_error_response(self.organization.slug, item.id, status_code=404)
