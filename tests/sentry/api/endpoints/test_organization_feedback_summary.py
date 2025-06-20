from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.urls import reverse

from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, create_feedback_issue
from sentry.testutils.cases import APITestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test


def mock_feedback_event(project_id: int, dt: datetime | None = None):
    if dt is None:
        dt = datetime.now(UTC)

    return {
        "project_id": project_id,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": dt.timestamp(),
        "received": dt.isoformat(),
        "first_seen": dt.isoformat(),
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "Testing!!",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }


@region_silo_test
class OrganizationFeedbackSummaryTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-feedback-summary"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(
            organization=self.org, name="Sentaur Squad", members=[self.user]
        )
        self.project1 = self.create_project(teams=[self.team])
        self.project2 = self.create_project(teams=[self.team])
        self.features = {
            "organizations:user-feedback-ai-summaries": True,
        }
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.org.slug},
        )

    @django_db_all
    def test_get_feedback_summary_without_feature_flag(self):
        response = self.get_error_response(self.org.slug)
        assert response.status_code == 403

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    def test_get_feedback_summary_basic(self, mock_generate_summary):
        for _ in range(15):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 15

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    def test_get_feedback_summary_with_date_filter(self, mock_generate_summary):
        # 12 feedbacks that are created immediately
        for _ in range(12):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        # 8 feedbacks that were created ~21 days ago, which will not be included in the summary
        for _ in range(8):
            event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(days=21))
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        params = {
            "statsPeriod": "14d",
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, **params)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 12

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    def test_get_feedback_summary_with_project_filter(self, mock_generate_summary):
        for _ in range(10):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        for _ in range(12):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        params = {
            "project": [self.project1.id],
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, **params)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 10

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    def test_get_feedback_summary_with_many_project_filter_as_list(self, mock_generate_summary):
        for _ in range(10):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        for _ in range(12):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        params = {
            "project": [self.project1.id, self.project2.id],
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, **params)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 22

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    def test_get_feedback_summary_with_many_project_filter_separate(self, mock_generate_summary):
        for _ in range(10):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        for _ in range(12):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.client.get(
                f"{self.url}?project={self.project1.id}&project={self.project2.id}"
            )

        assert response.status_code == 200
        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 22

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    def test_get_feedback_summary_too_few_feedbacks(self, mock_generate_summary):
        for _ in range(9):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is False

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.MAX_FEEDBACKS_TO_SUMMARIZE_CHARS",
        1000,
    )
    def test_get_feedback_summary_character_limit(self, mock_generate_summary):
        # Create 9 older feedbacks with normal size, skipped due to the middle one exceeding the character limit
        for _ in range(9):
            event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(hours=3))
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(hours=2))
        event["contexts"]["feedback"]["message"] = "a" * 2000
        create_feedback_issue(event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        for _ in range(12):
            event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(hours=1))
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 12

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    @patch("sentry.api.endpoints.organization_feedback_summary.cache")
    def test_get_feedback_summary_cache_hit(self, mock_cache, mock_generate_summary):
        mock_cache.get.return_value = {
            "summary": "Test cached summary of feedback",
            "numFeedbacksUsed": 13,
        }

        for _ in range(15):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test cached summary of feedback"
        assert response.data["numFeedbacksUsed"] == 13

        mock_cache.get.assert_called_once()
        mock_cache.set.assert_not_called()

    @django_db_all
    @patch(
        "sentry.api.endpoints.organization_feedback_summary.generate_summary",
        return_value="Test summary of feedback",
    )
    @patch("sentry.api.endpoints.organization_feedback_summary.cache")
    def test_get_feedback_summary_cache_miss(self, mock_cache, mock_generate_summary):
        mock_cache.get.return_value = None

        for _ in range(15):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 15
        mock_cache.get.assert_called_once()
        mock_cache.set.assert_called_once()
