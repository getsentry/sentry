# The sentry utils json cannot pretty print
import json  # noqa

import click


@click.command("openai")
@click.option("--event", type=click.File("r"))
@click.option("--model", default="gpt-3.5-turbo")
@click.option("--dump-prompt", is_flag=True)
def openai(event, model, dump_prompt):
    """
    Runs the OpenAI assistent against a JSON event payload.
    """
    from sentry.runner import configure

    configure()

    from sentry.api.endpoints.event_ai_suggested_fix import describe_event_for_ai, suggest_fix

    event_data = json.load(event)
    if dump_prompt:
        click.echo(json.dumps(describe_event_for_ai(event_data, model=model), indent=2))
    else:
        resp = suggest_fix(event_data, stream=True, model=model)
        for chunk in resp:
            click.echo(chunk, nl=False)
        click.echo()
