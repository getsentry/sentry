import json  # noqa
import random

import click


@click.command("spamdetection")
@click.option("--message", type=str)
def spamdetection(message):
    """
    Runs the Vertex spam detection endpoint given a feedback message.
    """
    from sentry.runner import configure

    configure()

    # temporary function since we don't have the endpoint available yet
    # update after we have the actual Vertex endpoint
    # this is the function that would come from the endpoint
    # it takes in a feedback message and returns one of "Junk" or "Not Junk"
    def detect_spam(message):
        options = ["Junk", "Not Junk"]
        click.echo(random.choice(options))

    resp = detect_spam(message)
    click.echo(resp, nl=False)
    click.echo()
