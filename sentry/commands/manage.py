"""
sentry.commands.manage
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import consume_args


@consume_args
def manage(args, options):
    from django.core.management import ManagementUtility
    utility = ManagementUtility(args)
    utility.execute()
