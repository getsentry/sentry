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
    prompt="What is your flag scoped to? (project/organization)",
    type=click.Choice(["organization", "project"], case_sensitive=False),
)
@click.option(
    "--team",
    prompt="what team are you on?",
    type=click.Choice(_get_api_owners(), case_sensitive=False),
)
@click.option(
    "--name",
    prompt="what's the name of your flag? (use hyphen-case)",
)
@click.option(
    "--strategy",
    prompt="does your feature flag use an internal strategy (like options), or a remote service (like flagr)?",
    type=click.Choice(["internal", "remote"], case_sensitive=False),
)
def create(scope, team, name, strategy):
    "Create a feature flag"

    if scope == "organization":
        class_name = "OrganizationFeature"
    elif scope == "project":
        class_name = "ProjectFeature"

    flag_name = f"{scope}s:{team}-{name}"

    if strategy == "internal":
        strategy_class_name = "FeatureHandlerStrategy.INTERNAL"
    elif strategy == "remote":
        strategy_class_name = "FeatureHandlerStrategy.REMOTE"

    flag_line = f'\ndefault_manager.add("{flag_name}", {class_name}, {strategy_class_name})\n'

    print(flag_line)
    with open("src/sentry/features/__init__.py", "r") as f:
        lines = f.readlines()  # Read all lines into a list
        print(lines)
