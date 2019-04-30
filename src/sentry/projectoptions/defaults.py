"""
sentry.projectoptions.defaults
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2019 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import
from sentry.projectoptions import register

register(
    key='sentry:grouping_config',
    epoch_defaults={
        1: 'legacy:2019-03-12',
        2: 'combined:2019-04-07',
    }
)
