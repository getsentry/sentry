from django.urls import reverse

from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class ProjectEventDetailsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.setup_data()

    def setup_data(self):
        one_min_ago = before_now(minutes=1).isoformat()
        two_min_ago = before_now(minutes=2).isoformat()
        three_min_ago = before_now(minutes=3).isoformat()
        four_min_ago = before_now(minutes=4).isoformat()

        self.prev_event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": four_min_ago, "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.cur_event = self.store_event(
            data={"event_id": "b" * 32, "timestamp": three_min_ago, "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        self.next_event = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": two_min_ago,
                "fingerprint": ["group-1"],
                "environment": "production",
                "tags": {"environment": "production"},
            },
            project_id=self.project.id,
        )
        self.cur_group = self.next_event.group

        # Event in different group
        self.store_event(
            data={
                "event_id": "d" * 32,
                "timestamp": one_min_ago,
                "fingerprint": ["group-2"],
                "environment": "production",
                "tags": {"environment": "production"},
            },
            project_id=self.project.id,
        )

    def test_simple(self):
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.cur_event.event_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.cur_event.event_id)
        assert response.data["nextEventID"] == str(self.next_event.event_id)
        assert response.data["previousEventID"] == str(self.prev_event.event_id)
        assert response.data["groupID"] == str(self.cur_group.id)

    def test_snuba_no_prev(self):
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.prev_event.event_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.prev_event.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == self.cur_event.event_id
        assert response.data["groupID"] == str(self.cur_group.id)

    def test_snuba_with_environment(self):
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.cur_event.event_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        response = self.client.get(
            url, format="json", data={"environment": ["production", "staging"]}
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.cur_event.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == self.next_event.event_id
        assert response.data["groupID"] == str(self.cur_group.id)

    def test_ignores_different_group(self):
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.next_event.event_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.next_event.event_id)
        assert response.data["nextEventID"] is None


class ProjectEventDetailsGenericTest(OccurrenceTestMixin, ProjectEventDetailsTest):
    def setup_data(self):
        one_min_ago = before_now(minutes=1).isoformat()
        two_min_ago = before_now(minutes=2).isoformat()
        three_min_ago = before_now(minutes=3).isoformat()
        four_min_ago = before_now(minutes=4).isoformat()

        prev_event_id = "a" * 32
        self.prev_event, _ = self.process_occurrence(
            event_id=prev_event_id,
            project_id=self.project.id,
            fingerprint=["group-1"],
            event_data={
                "timestamp": four_min_ago,
                "message_timestamp": four_min_ago,
            },
        )

        cur_event_id = "b" * 32
        self.cur_event, cur_group_info = self.process_occurrence(
            event_id=cur_event_id,
            project_id=self.project.id,
            fingerprint=["group-1"],
            event_data={
                "timestamp": three_min_ago,
                "message_timestamp": three_min_ago,
            },
        )
        assert cur_group_info is not None
        self.cur_group = cur_group_info.group

        next_event_id = "c" * 32
        self.next_event, _ = self.process_occurrence(
            event_id=next_event_id,
            project_id=self.project.id,
            fingerprint=["group-1"],
            event_data={
                "timestamp": two_min_ago,
                "message_timestamp": two_min_ago,
                "tags": {"environment": "production"},
            },
        )

        unrelated_event_id = "d" * 32
        self.process_occurrence(
            event_id=unrelated_event_id,
            project_id=self.project.id,
            fingerprint=["group-2"],
            event_data={
                "timestamp": one_min_ago,
                "message_timestamp": one_min_ago,
                "tags": {"environment": "production"},
            },
        )

    def test_generic_event_with_occurrence(self):
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.cur_event.event_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json", data={"group_id": self.cur_group.id})

        assert response.status_code == 200, response.content
        assert response.data["id"] == self.cur_event.event_id
        assert response.data["occurrence"] is not None
        assert response.data["occurrence"]["id"] == self.cur_event.id


class ProjectEventDetailsTransactionTest(APITestCase, SnubaTestCase, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        project = self.create_project()

        one_min_ago = before_now(minutes=1)
        two_min_ago = before_now(minutes=2)
        three_min_ago = before_now(minutes=3)
        four_min_ago = before_now(minutes=4)

        self.prev_transaction_event = self.create_performance_issue(
            event_data=load_data(
                event_id="a" * 32,
                platform="transaction-n-plus-one",
                timestamp=four_min_ago,
                start_timestamp=four_min_ago,
            ),
            project_id=project.id,
        )
        self.group = self.prev_transaction_event.group

        self.cur_transaction_event = self.create_performance_issue(
            event_data=load_data(
                event_id="b" * 32,
                platform="transaction-n-plus-one",
                timestamp=three_min_ago,
                start_timestamp=three_min_ago,
            ),
            project_id=project.id,
        )

        self.next_transaction_event = self.create_performance_issue(
            event_data=load_data(
                event_id="c" * 32,
                platform="transaction-n-plus-one",
                timestamp=two_min_ago,
                start_timestamp=two_min_ago,
            ),
            project_id=project.id,
        )

        self.create_performance_issue(
            event_data=load_data(
                event_id="d" * 32,
                platform="transaction-n-plus-one",
                timestamp=one_min_ago,
                start_timestamp=one_min_ago,
            ),
            fingerprint="other_group",
            project_id=project.id,
        )

    def test_transaction_event(self):
        """Test that you can look up a transaction event w/ a prev and next event"""
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.cur_transaction_event.event_id,
                "project_id_or_slug": self.cur_transaction_event.project.slug,
                "organization_id_or_slug": self.cur_transaction_event.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json", data={"group_id": self.group.id})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.cur_transaction_event.event_id)
        assert response.data["nextEventID"] == str(self.next_transaction_event.event_id)
        assert response.data["previousEventID"] == str(self.prev_transaction_event.event_id)
        assert response.data["groupID"] == str(self.cur_transaction_event.group.id)

    def test_no_previous_event(self):
        """Test the case in which there is no previous event"""
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.prev_transaction_event.event_id,
                "project_id_or_slug": self.prev_transaction_event.project.slug,
                "organization_id_or_slug": self.prev_transaction_event.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json", data={"group_id": self.group.id})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.prev_transaction_event.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == self.cur_transaction_event.event_id
        assert response.data["groupID"] == str(self.prev_transaction_event.group.id)

    def test_ignores_different_group(self):
        """Test that a different group's events aren't attributed to the one that was passed"""
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.next_transaction_event.event_id,
                "project_id_or_slug": self.next_transaction_event.project.slug,
                "organization_id_or_slug": self.next_transaction_event.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json", data={"group_id": self.group.id})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.next_transaction_event.event_id)
        assert response.data["nextEventID"] is None

    def test_no_group_id(self):
        """Test the case where a group_id was not passed"""
        url = reverse(
            "sentry-api-0-project-event-details",
            kwargs={
                "event_id": self.cur_transaction_event.event_id,
                "project_id_or_slug": self.cur_transaction_event.project.slug,
                "organization_id_or_slug": self.cur_transaction_event.project.organization.slug,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.cur_transaction_event.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None
        assert response.data["groupID"] is None


class ProjectEventJsonEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.event_id = "c" * 32
        self.fingerprint = ["group_2"]
        self.min_ago = iso_format(before_now(minutes=1))
        self.event = self.store_event(
            data={
                "event_id": self.event_id,
                "timestamp": self.min_ago,
                "fingerprint": self.fingerprint,
                "user": {"email": self.user.email},
            },
            project_id=self.project.id,
        )
        self.url = reverse(
            "sentry-api-0-event-json",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": self.event_id,
            },
        )

    def assert_event(self, data):
        assert data["event_id"] == self.event_id
        assert data["user"]["email"] == self.user.email
        assert data["datetime"][:19] == self.min_ago
        assert data["fingerprint"] == self.fingerprint

    def test_simple(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        self.assert_event(response.data)

    def test_event_does_not_exist(self):
        self.url = reverse(
            "sentry-api-0-event-json",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": "no" * 16,
            },
        )
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content
        assert response.data == {"detail": "Event not found"}

    def test_user_unauthorized(self):
        user = self.create_user()
        self.login_as(user)

        response = self.client.get(self.url, format="json")
        assert response.status_code == 403, response.content
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_project_not_associated_with_event(self):
        project2 = self.create_project(organization=self.organization)
        url = reverse(
            "sentry-api-0-event-json",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": project2.slug,
                "event_id": self.event_id,
            },
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content
        assert response.data == {"detail": "Event not found"}


class ProjectEventDetailsTransactionTestScrubbed(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        data = load_data("transaction")
        for span in data["spans"]:
            span["sentry_tags"]["user.ip"] = "127.0.0.1"
        self.event = self.store_event(data=data, project_id=self.project.id)

        self.url = reverse(
            "sentry-api-0-event-json",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": self.event.event_id,
            },
        )

    def test_no_scrubbed(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["spans"]) > 0
        for span in response.data["spans"]:
            assert "user.ip" in span["sentry_tags"]

    def test_scrubbed_project(self):
        self.project.update_option("sentry:scrub_ip_address", True)

        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["spans"]) > 0
        for span in response.data["spans"]:
            assert "user.ip" not in span["sentry_tags"]

    def test_scrubbed_organization(self):
        self.organization.update_option("sentry:require_scrub_ip_address", True)

        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["spans"]) > 0
        for span in response.data["spans"]:
            assert "user.ip" not in span["sentry_tags"]
