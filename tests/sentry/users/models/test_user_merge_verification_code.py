from datetime import UTC, datetime, timedelta

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.users.models import UserMergeVerificationCode
from sentry.users.models.user_merge_verification_code import TOKEN_MINUTES_VALID


@control_silo_test
class TestUserMergeVerificationCode(TestCase):
    @freeze_time()
    def test_regenerate_token(self):
        code = UserMergeVerificationCode(user=self.user)
        token = code.token
        code.expires_at = datetime(2025, 3, 14, 5, 32, 21, tzinfo=UTC)
        code.save()

        code.regenerate_token()
        assert code.token != token
        assert code.expires_at == datetime.now(UTC) + timedelta(minutes=TOKEN_MINUTES_VALID)

    @freeze_time()
    def test_expires_at(self):
        code = UserMergeVerificationCode(user=self.user)
        code.expires_at = datetime(2025, 3, 14, 5, 32, 21, tzinfo=UTC)
        code.save()

        assert not code.is_valid()

        code.regenerate_token()
        assert code.is_valid()
