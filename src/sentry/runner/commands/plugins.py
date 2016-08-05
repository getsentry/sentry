"""
sentry.runner.commands.plugins
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
import six


@click.group()
def plugins():
    "Manage Sentry plugins."


@plugins.command()
def list():
    "List all installed plugins"
    from pkg_resources import iter_entry_points
    for ep in iter_entry_points('sentry.plugins'):
        click.echo(six.text_type(ep.dist))
