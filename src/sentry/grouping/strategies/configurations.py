from __future__ import absolute_import

from sentry.grouping.strategies.base import create_strategy_configuration


# The latest version of the default config that should be used
DEFAULT_CONFIG = 'legacy:2019-03-12'

# The classes of grouping algorithms
CLASSES = []

# The full mapping of all known configurations.
CONFIGURATIONS = {}


def register_strategy_config(id, **kwargs):
    rv = create_strategy_configuration(id, **kwargs)
    if rv.config_class not in CLASSES:
        CLASSES.append(rv.config_class)
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
        'threads:legacy',
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
        * Some known weaknesses with regards to grouping of native frames
        * No support for grouping enhancements
    '''
)

# Simple newstyle grouping
#
# This is a grouping strategy that applies very simple rules and will
# become the new default at one point.  Optimized for native and
# javascript but works for all platforms.

register_strategy_config(
    id='newstyle:2019-04-05',
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
        * New grouping strategy optimized for native and javascript
        * Not compatible with the old legacy grouping
    '''
)

register_strategy_config(
    id='newstyle:2019-04-17',
    strategies=[
        'expect-ct:v1',
        'expect-staple:v1',
        'hpkp:v1',
        'csp:v1',
        'threads:v1',
        'stacktrace:v1',
        'chained-exception:v1',
        'template:v1',
        'message:v2',
    ],
    delegates=[
        'frame:v1',
        'stacktrace:v1',
        'single-exception:v2',
    ],
    changelog='''
        * messages are now preprocessed to increase change of grouping together
        * exceptions without stacktraces are now grouped by a trimmed message

        *This algorithm is currently work in progress and will continue to
        evolve based on feedback*
    '''
)

# This is a combined strategy that dispatches to legacy:2019-03-12 and
# newstyle:2019-04-05 depending on the platform.

register_strategy_config(
    id='combined:2019-04-07',
    strategies=[
        'expect-ct:v1',
        'expect-staple:v1',
        'hpkp:v1',
        'csp:v1',
        'threads:v1',
        'stacktrace:v1nl',
        'chained-exception:v1nl',
        'template:v1',
        'message:v1',
    ],
    delegates=[
        'frame:v1nl',
        'stacktrace:v1nl',
        'single-exception:v1nl',
    ],
    changelog='''
        * Uses `newstyle:2019-04-05` for native platforms
        * Uses `legacy:2019-03-12` for all other platforms
    '''
)
