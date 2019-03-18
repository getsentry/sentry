from __future__ import absolute_import

from sentry.grouping.strategies.base import StrategyConfiguration


# The latest version of the default config that should be used
DEFAULT_CONFIG = 'legacy:2019-03-12'

# The classes of grouping algorithms
CLASSES = []

# The full mapping of all known configurations.
CONFIGURATIONS = {}


def register_strategy_config(id, **kwargs):
    rv = StrategyConfiguration(id, **kwargs)
    cls = id.split(':', 1)[0]
    if cls not in CLASSES:
        CLASSES.append(cls)
    CONFIGURATIONS[rv.id] = rv
    return rv


# Legacy groupings
#
# These we do not plan on changing much, but bugfixes here might still go
# into new grouping versions.

register_strategy_config(
    id='legacy:2019-03-12',
    strategies=[
        'expect-ct:v1',
        'expect-staple:v1',
        'hpkp:v1',
        'csp:v1',
        'threads:v1',
        'stacktrace:legacy',
        'chained-exception:legacy',
        'template:v1',
        'message:v1',
    ],
    delegates=[
        'frame:legacy',
        'stacktrace:legacy',
        'single-exception:legacy',
    ],
    changelog='''
        * Traditional grouping algorithm
        * Some known weeknesses with regards to grouping of native frames
    '''
)

# Newstyle grouping
#
# This is the new grouping strategy but it's not yet versioned because
# it's not available to customers yet.

register_strategy_config(
    id='new:wip',
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
    ],
    changelog='''
        * Work in progress grouping algorith that is not frozen in behavior yet
    '''
)
