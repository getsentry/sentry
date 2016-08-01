"""
sentry.runner.commands.exec
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import six
import sys
import click

# If this changes, make sure to also update in the `__doc__`
SCRIPT_TEMPLATE = u"""\
from sentry.runner import configure; configure()
from django.conf import settings
from sentry.models import *

try:
    %(script)s
except Exception:
    import traceback
    traceback.print_exc()
"""


@click.command(name='exec', context_settings=dict(
    ignore_unknown_options=True,
    allow_extra_args=True,
))
@click.option('-c', default='', help='Read script from string.')
@click.argument('file', default=None, required=False)
def exec_(c, file):
    """
    Execute a script.

    Also compatible with hashbang `#!/usr/bin/env sentry exec`

    For convenience, the following preample is attached to scripts:

    \b
      from sentry.runner import configure; configure()
      from django.conf import settings
      from sentry.models import *

    Examples:

    \b
      $ sentry exec -c 'print(Project.objects.count())'
      $ echo 'print(Project.objects.count())' | sentry exec
      $ sentry exec something.py

    Note: All scripts are assumed utf-8.
    """
    # Can't have both a file and command, when passing both
    # -c takes priority and rest is ignored. This mimics
    # `python -c` behavior.
    if c and file:
        file = None

    # If we specify neither, read from stdin
    if not (c or file):
        file = '-'

    if file:
        if file == '-':
            file = '<string>'
            c = click.get_text_stream('stdin').read()
        else:
            try:
                with open(file, 'rb') as fp:
                    c = fp.read().decode('utf8')
            except (IOError, OSError) as e:
                raise click.ClickException(six.text_type(e))
    else:
        file = '<string>'

    script = SCRIPT_TEMPLATE % {
        # Need to reindent the code to fit inside the `try` block
        'script': c.replace('\n', '\n' + (' ' * 4)),
    }

    # Chop off `exec` from `sys.argv` so scripts can handle
    # this as exepcted.
    sys.argv = sys.argv[1:]

    # globals context
    g = {
        # Inject `__name__ = '__main__' for scripts
        '__name__': '__main__',
    }
    # locals context
    l = {}
    six.exec_(compile(script, file, 'exec'), g, l)
