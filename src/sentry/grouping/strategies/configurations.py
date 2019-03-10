from __future__ import absolute_import

from sentry.grouping.strategies.base import register_strategy_config


register_strategy_config(
    id='legacy',
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
