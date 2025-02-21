from sentry.replays.usecases.ingest import should_skip_billing
from sentry.testutils.helpers import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_should_skip_billing():
    with override_options({"replay.replay-video.billing-skip-org-ids": [2]}):
        assert should_skip_billing(1, True) is False
        assert should_skip_billing(1, False) is False
        assert should_skip_billing(2, True) is True
        assert should_skip_billing(2, False) is False
