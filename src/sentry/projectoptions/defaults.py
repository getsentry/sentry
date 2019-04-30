"""
sentry.projectoptions.defaults
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2019 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import
from sentry.projectoptions import register

# grouping related configs
#
# The default values are hardcoded because some grouping configs might
# only exists temporarily for testing purposes.  If we delete them from
# the codebase and a customer still has them set in the options we want to
# fall back to the oldest config.
#
# TODO: we might instead want to fall back to the latest of the project's
# epoch instead.
DEFAULT_GROUPING_CONFIG = 'legacy:2019-03-12'
register(
    key='sentry:grouping_config',
    epoch_defaults={
        1: DEFAULT_GROUPING_CONFIG,
        # 2: 'combined:2019-04-07',
    }
)

DEFAULT_GROUPING_ENHANCEMENTS_BASE = 'legacy:2019-03-12'
register(
    key='sentry:grouping_enhancements_base',
    epoch_defaults={
        1: DEFAULT_GROUPING_ENHANCEMENTS_BASE,
    }
)
