"""
sentry.commands.upgrade
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.management import call_command
from django.conf import settings
from sentry.commands.utils import options, opt


@options(
    opt('--interactive', default=False, action='store_true'),
)
def upgrade(interactive=True):
    call_command('syncdb', database='default', interactive=interactive)

    if 'south' in settings.INSTALLED_APPS:
        call_command('migrate', database='default', interactive=interactive)
