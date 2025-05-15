from functools import wraps
from typing import Any

from sentry_sdk_alpha.feature_flags import add_feature_flag
from sentry_sdk_alpha.integrations import Integration, DidNotEnable

try:
    from UnleashClient import UnleashClient
except ImportError:
    raise DidNotEnable("UnleashClient is not installed")


class UnleashIntegration(Integration):
    identifier = "unleash"

    @staticmethod
    def setup_once():
        # type: () -> None
        # Wrap and patch evaluation methods (class methods)
        old_is_enabled = UnleashClient.is_enabled

        @wraps(old_is_enabled)
        def sentry_is_enabled(self, feature, *args, **kwargs):
            # type: (UnleashClient, str, *Any, **Any) -> Any
            enabled = old_is_enabled(self, feature, *args, **kwargs)

            # We have no way of knowing what type of unleash feature this is, so we have to treat
            # it as a boolean / toggle feature.
            add_feature_flag(feature, enabled)

            return enabled

        UnleashClient.is_enabled = sentry_is_enabled  # type: ignore
