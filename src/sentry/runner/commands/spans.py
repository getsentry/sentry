import os
import shutil

import click

from sentry.runner.decorators import configuration
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.spans.grouping.strategy.config import DEFAULT_CONFIG_ID
from sentry.utils import json


@click.group()
def spans() -> None:
    """
    Span utilities
    """


@spans.command()
@click.argument("filename", type=click.Path(exists=True))
@configuration
def write_hashes(filename):
    """
    Runs span hash grouping on event data in the supplied filename using the
    default grouping strategy. Write the results to a copy of the file.
    Filename should be a path to a JSON event data file.
    """

    [head, tail] = os.path.split(filename)
    new_filename = f"{head}/hashed-{tail}"

    shutil.copy(filename, new_filename)

    with open(filename) as in_file:
        data = json.loads(in_file.read())

    click.echo(f"Event ID: {data['event_id']}")
    click.echo("Writing span hashes")

    config = load_span_grouping_config({"id": DEFAULT_CONFIG_ID})
    results = config.execute_strategy(data)

    with open(new_filename, "w") as out_file:
        results.write_to_event(data)
        out_file.write(json.dumps(data))

    click.echo("Done")
    click.echo("\n")
