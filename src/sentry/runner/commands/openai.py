import click

from sentry.utils import json


@click.command("openai")
@click.option("--event", type=click.File("r"))
def openai(event):
    """
    Runs the OpenAI assistent against a JSON event payload.
    """
    from sentry.runner import configure

    configure()

    from sentry.api.endpoints.event_ai_suggested_fix import suggest_fix

    event_data = json.load(event)
    click.echo(suggest_fix(event_data))
