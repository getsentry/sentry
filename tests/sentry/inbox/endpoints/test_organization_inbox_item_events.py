from datetime import timedelta

from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.link_header import parse_link_header


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

    def test_pagination_preserves_timestamp_precision_and_ties(self) -> None:
        item = self.create_inbox_item()
        timestamp = before_now(minutes=1).replace(microsecond=123456)
        newest = self.create_inbox_item_event(
            inbox_item=item,
            data={"summary": "Newest"},
        )
        newest.update(date_added=timestamp + timedelta(microseconds=1))
        first_tie = self.create_inbox_item_event(inbox_item=item, data={"summary": "First tie"})
        first_tie.update(date_added=timestamp)
        second_tie = self.create_inbox_item_event(inbox_item=item, data={"summary": "Second tie"})
        second_tie.update(date_added=timestamp)
        oldest = self.create_inbox_item_event(
            inbox_item=item,
            data={"summary": "Oldest"},
        )
        oldest.update(date_added=timestamp - timedelta(microseconds=1))

        first = self.get_success_response(self.organization.slug, item.id, per_page=2)
        assert [event["id"] for event in first.data] == [str(newest.id), str(second_tie.id)]
        next_url = next(
            url for url, attrs in parse_link_header(first["Link"]).items() if attrs["rel"] == "next"
        )
        second = self.client.get(next_url)
        assert second.status_code == 200, second.data
        assert [event["id"] for event in second.data] == [str(first_tie.id), str(oldest.id)]
        previous_url = next(
            url
            for url, attrs in parse_link_header(second["Link"]).items()
            if attrs["rel"] == "previous"
        )
        back = self.client.get(previous_url)
        assert back.status_code == 200, back.data
        assert [event["id"] for event in back.data] == [str(newest.id), str(second_tie.id)]

    def test_other_organization(self) -> None:
        item = self.create_inbox_item(organization=self.create_organization())
        self.get_error_response(self.organization.slug, item.id, status_code=404)

    def test_removed_item(self) -> None:
        item = self.create_inbox_item(status=ObjectStatus.PENDING_DELETION)
        self.get_error_response(self.organization.slug, item.id, status_code=404)
