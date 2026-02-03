import random

from sentry.notifications.platform.rollout import NotificationRolloutService
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options


class NotificationRolloutServiceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        random.seed(0)

    def test_no_feature_flags_enabled(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert not service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)

    @override_options(
        {"notifications.platform-rollout.internal-testing": {"data-export-success": 1.0}}
    )
    @with_feature("organizations:notification-platform.internal-testing")
    def test_internal_testing_full_rollout(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)

    @override_options(
        {"notifications.platform-rollout.internal-testing": {"data-export-success": 0.0}}
    )
    @with_feature("organizations:notification-platform.internal-testing")
    def test_internal_testing_zero_rollout(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert not service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)

    @override_options(
        {
            "notifications.platform-rollout.is-sentry": {"data-export-success": 1.0},
            "notifications.platform-rollout.internal-testing": {"data-export-success": 0.0},
        }
    )
    @with_feature("organizations:notification-platform.is-sentry")
    def test_is_sentry_full_rollout(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)

    @override_options(
        {
            "notifications.platform-rollout.internal-testing": {"data-export-success": 1.0},
            "notifications.platform-rollout.is-sentry": {"data-export-success": 0.0},
        }
    )
    @with_feature("organizations:notification-platform.internal-testing")
    @with_feature("organizations:notification-platform.is-sentry")
    def test_feature_flag_priority(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        # Should use internal-testing (1.0) not is-sentry (0.0)
        assert service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)

    @override_options(
        {"notifications.platform-rollout.internal-testing": {"data-export-success": 1.0}}
    )
    @with_feature("organizations:notification-platform.internal-testing")
    def test_unknown_source_returns_false(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert not service.should_notify(NotificationTemplateSource.SLOW_LOAD_METRIC_ALERT)

    @with_feature("organizations:notification-platform.internal-testing")
    def test_unknown_option_returns_false(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert not service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)

    @override_options(
        {"notifications.platform-rollout.internal-testing": {"data-export-success": 0.5}}
    )
    @with_feature("organizations:notification-platform.internal-testing")
    def test_partial_rollout_based_on_org_id(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)

    def test_has_feature_flag_access_returns_none_when_no_flags(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert service.has_feature_flag_access() is None

    @with_feature("organizations:notification-platform.internal-testing")
    def test_has_feature_flag_access_returns_internal_testing_key(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert (
            service.has_feature_flag_access() == "notifications.platform-rollout.internal-testing"
        )

    @with_feature("organizations:notification-platform.general-access")
    @with_feature("organizations:notification-platform.is-sentry")
    def test_has_feature_flag_access_gets_most_specific_key(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        assert service.has_feature_flag_access() == "notifications.platform-rollout.is-sentry"

    @override_options(
        {"notifications.platform-rollout.internal-testing": {"data-export-success": 0.75}}
    )
    def test_get_rollout_rate_returns_correct_rate(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        rate = service.get_rollout_rate(
            "notifications.platform-rollout.internal-testing",
            NotificationTemplateSource.DATA_EXPORT_SUCCESS,
        )
        assert rate == 0.75

    @override_options(
        {"notifications.platform-rollout.internal-testing": {"data-export-success": 1.0}}
    )
    def test_get_rollout_rate_unknown_source_returns_zero(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        rate = service.get_rollout_rate(
            "notifications.platform-rollout.internal-testing",
            NotificationTemplateSource.SLOW_LOAD_METRIC_ALERT,
        )
        assert rate == 0.0

    def test_get_rollout_rate_unknown_option_returns_zero(self) -> None:
        service = NotificationRolloutService(organization=self.organization)
        rate = service.get_rollout_rate(
            "notifications.platform-rollout.nonexistent",
            NotificationTemplateSource.DATA_EXPORT_SUCCESS,
        )
        assert rate == 0.0

    @override_options(
        {
            "notifications.platform-rollout.internal-testing": {
                "data-export-success": 1.0,
                "data-export-failure": 0.5,
                "slow-load-metric-alert": 0.0,
            }
        }
    )
    @with_feature("organizations:notification-platform.internal-testing")
    def test_multiple_sources_different_rates(self) -> None:
        service = NotificationRolloutService(organization=self.organization)

        assert service.should_notify(NotificationTemplateSource.DATA_EXPORT_SUCCESS)
        assert not service.should_notify(NotificationTemplateSource.DATA_EXPORT_FAILURE)
        assert not service.should_notify(NotificationTemplateSource.SLOW_LOAD_METRIC_ALERT)
