import json  # noqa
from datetime import datetime

import click

from sentry.runner.decorators import configuration


def _get_api_owners():
    from sentry.api.api_owners import ApiOwner

    return [ao.value for ao in ApiOwner]


@click.group()
def flags():
    "Manage Sentry flags."


@flags.command()
@configuration
@click.option(
    "--scope",
    prompt="What is your flag scoped to?",
    type=click.Choice(["organization", "project"], case_sensitive=False),
)
@click.option(
    "--team",
    prompt="what team are you on?",
    type=click.Choice(_get_api_owners(), case_sensitive=False),
)
@click.option(
    "--name",
    prompt="what's the name of your flag? (use snake-case)",
)
@click.option(
    "--strategy",
    prompt="does your feature flag use an internal strategy (like options), or a remote service (like flagr)?",
    type=click.Choice(["internal", "remote"], case_sensitive=False),
)
def create(scope, team, name, strategy):
    "Create a feature flag"

    # open src/sentry/features/generated_flags.json
    # load it into a dict
    # insert the flag information into the dict
    # write the dict back to the file (make sure the JSON object keys are sorted alphabetically.
    # the file should look like this:
    #     {
    #   "replay-backend": {
    #     "enable-replays-stuff": {
    #       "scope": "organization",
    #       "strategy": "remote"
    #     }
    #   }
    # }

    with open("src/sentry/features/generated_flags.json") as f:
        flags_to_generate = json.loads(f.read())

    if team not in flags_to_generate:
        flags_to_generate[team] = {}

    if name in flags_to_generate[team]:
        raise ValueError("Flag already exists")

    flags_to_generate[team][name] = {
        "scope": scope,
        "strategy": strategy,
        "created": datetime.now().date().isoformat(),
    }

    with open("src/sentry/features/generated_flags.json", "w") as f:
        json.dump(flags_to_generate, f, indent=4, sort_keys=True)

    click.echo("Flag created successfully")
