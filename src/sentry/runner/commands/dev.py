from __future__ import absolute_import, print_function

import click
import os


@click.group()
def dev():
    """
    Development utilities.
    """


@dev.command()
def psql():
    """
    Connect to Sentry's PostgreSQL in Docker.

    Do not use in production!
    """
    os.execvp('/usr/local/bin/docker', (
        '/usr/local/bin/docker',
        'exec',
        '-i',
        '-t',
        'sentry_postgres',
        'bash', '-c', 'psql -U postgres sentry',
    ))
