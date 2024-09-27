from datetime import date

import click

from flagpole import Feature, Segment
from flagpole.conditions import ConditionBase, ConditionOperatorKind, condition_from_dict
from sentry.runner.decorators import configuration

valid_scopes = ["organizations", "projects"]
hardcoded_condition_properties = {
    "organization_id",
    "organization_slug",
    "organization_is-early-adopter",
    "project_id",
    "project_slug",
    "project_name",
    "user_id",
    "user_email",
}

feature_scopes_choices = click.Choice(valid_scopes)
condition_type_choices = click.Choice([op.value for op in ConditionOperatorKind])


def condition_wizard(display_sample_condition_properties: bool = False) -> ConditionBase:
    if display_sample_condition_properties:
        click.echo("Here are some example condition properties available:\n")
        for property_name in hardcoded_condition_properties:
            click.echo(f"{property_name}")
        click.echo("")

    property_name = click.prompt("Context property name", type=str)
    operator_kind = click.prompt("Operator type", type=condition_type_choices, show_choices=True)

    value: str | list[str] = ""
    if operator_kind in {ConditionOperatorKind.IN, ConditionOperatorKind.NOT_IN}:
        value = []
    condition = {
        "property": property_name,
        "operator": operator_kind,
        "value": value,
    }
    return condition_from_dict(condition)


def segment_wizard() -> list[Segment]:
    done_creating_segments = not click.confirm(
        "Would you like to create a new segment?", default=True
    )
    segments = []
    while not done_creating_segments:
        name = click.prompt("Name", type=str).strip()
        rollout_percentage = click.prompt("Rollout percentage", type=int, default=100)
        conditions = []

        if should_create_conditions := click.confirm(
            "Would you like to create some conditions?", default=True
        ):
            should_display_options = True
            while should_create_conditions:
                condition = condition_wizard(
                    display_sample_condition_properties=should_display_options
                )
                should_display_options = False
                conditions.append(condition)
                should_create_conditions = click.confirm("Continue creating conditions?")

        segment = Segment(name=name, rollout=rollout_percentage, conditions=conditions)
        segments.append(segment)

        done_creating_segments = not click.confirm("Continue creating segments?", default=False)

    return segments


@click.command()
@click.option(
    "--blank", default=False, is_flag=True, help="If true, will create a blank flag config"
)
@click.option("--name", default=None, help="The name of the feature.")
@click.option(
    "--scope",
    default=None,
    help="The feature's scope. Must be either 'organizations' or 'projects'",
)
@click.option("--owner", default=None, help="The team name or email address of the feature owner.")
@configuration
def createflag(
    blank: bool | None,
    name: str | None,
    scope: str | None,
    owner: str | None,
) -> None:
    """Create a new Flagpole feature flag."""

    try:
        if not name:
            name = click.prompt("Feature name", type=str)

        assert name, "Feature must have a non-empty string for 'name'"
        name = name.strip().lower().replace(" ", "-")

        if not owner:
            entered_owner = click.prompt("Owner (team name or email address)", type=str)
            owner = entered_owner.strip()

        assert owner, "Feature must have a non-empty string for 'owner'"

        if not scope:
            scope = click.prompt(
                "Feature scope",
                type=feature_scopes_choices,
                default="organizations",
                show_choices=True,
            )

        assert scope, "A feature scope must be provided."
        scope = scope.lower().strip()
        if scope not in valid_scopes:
            raise click.ClickException(
                f"Scope must be either 'organizations' or 'projects', received '{scope}'"
            )

        segments = []

        if not blank:
            segments = segment_wizard()
        feature = Feature(
            name=f"feature.{scope}:{name}",
            owner=owner,
            segments=segments,
            created_at=date.today().isoformat(),
        )
    except Exception as err:
        raise click.ClickException(f"{err}")

    click.echo("")
    click.echo("=== GENERATED YAML ===\n")
    click.echo(feature.to_yaml_str())
