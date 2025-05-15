from functools import wraps
from typing import Any, TYPE_CHECKING

from sentry_sdk_alpha.feature_flags import add_feature_flag
from sentry_sdk_alpha.integrations import Integration, DidNotEnable, _check_minimum_version
from sentry_sdk_alpha.utils import parse_version

try:
    from statsig import statsig as statsig_module
    from statsig.version import __version__ as STATSIG_VERSION
except ImportError:
    raise DidNotEnable("statsig is not installed")

if TYPE_CHECKING:
    from statsig.statsig_user import StatsigUser


class StatsigIntegration(Integration):
    identifier = "statsig"

    @staticmethod
    def setup_once():
        # type: () -> None
        version = parse_version(STATSIG_VERSION)
        _check_minimum_version(StatsigIntegration, version, "statsig")

        # Wrap and patch evaluation method(s) in the statsig module
        old_check_gate = statsig_module.check_gate

        @wraps(old_check_gate)
        def sentry_check_gate(user, gate, *args, **kwargs):
            # type: (StatsigUser, str, *Any, **Any) -> Any
            enabled = old_check_gate(user, gate, *args, **kwargs)
            add_feature_flag(gate, enabled)
            return enabled

        statsig_module.check_gate = sentry_check_gate
