from typing import int
from unittest.mock import MagicMock, patch

from sentry.analytics.events.user_created import UserCreatedEvent
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_last_analytics_event,
    assert_not_analytics_event,
)
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user import User


class CreateDefaultProjectsTest(TestCase):
    @patch("sentry.analytics.record")
    def test_user_created_records_analytics(self, mock_record: MagicMock):
        user: User = self.create_user()
        assert_last_analytics_event(
            mock_record,
            UserCreatedEvent(id=user.id, username=user.username, email=user.email),
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_user_modified_does_not_record_analytics(self):
        user: User = self.create_user()
        with patch("sentry.analytics.record") as mock_record:
            user.email = "new@example.com"
            user.save()
            assert_not_analytics_event(mock_record, UserCreatedEvent)
