"""
sentry.commands.manage
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import consume_args


@consume_args
def manage(args):
    from django.core.management import ManagementUtility
    utility = ManagementUtility(args)
    utility.execute()


def update_migrations():
    """
    Creates schemamigrations for sentry.
    """
    from django.core.management import ManagementUtility
    args = 'manage.py schemamigration sentry --auto'.split(' ')
    utility = ManagementUtility(args)
    utility.execute()
