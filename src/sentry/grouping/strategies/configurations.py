from __future__ import absolute_import

from sentry.grouping.strategies.base import StrategyConfiguration


# The latest version of th edefault config that should be used
DEFAULT_CONFIG = 'legacy:2019-03-12'

# The full mapping of all known configurations.
CONFIGURATIONS = {}


def register_strategy_config(id, strategies, delegates=None):
    rv = StrategyConfiguration(id, strategies, delegates)
    CONFIGURATIONS[rv.id] = rv
    return rv


register_strategy_config(
    id='legacy:2019-03-12',
    strategies=[
        'expect-ct:v1',
        'expect-staple:v1',
        'hpkp:v1',
        'csp:v1',
        'threads:v1',
        'stacktrace:v1',
        'chained-exception:v1',
        'template:v1',
        'message:v1',
    ],
    delegates=[
        'frame:v1',
        'stacktrace:v1',
        'single-exception:v1',
    ]
)
