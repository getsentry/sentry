"""
sentry.runner.decorators
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import os


def configuration(f):
    "Load and configure Sentry."
    import click
    from functools import update_wrapper

    @click.pass_context
    def inner(ctx, *args, **kwargs):
        # HACK: We can't call `configure()` from within tests
        # since we don't load config files from disk, so we
        # need a way to bypass this initialization step
        if os.environ.get('_SENTRY_SKIP_CONFIGURATION') != '1':
            from sentry.runner import configure
            configure()
        return ctx.invoke(f, *args, **kwargs)
    return update_wrapper(inner, f)
