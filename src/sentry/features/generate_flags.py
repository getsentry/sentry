from dataclasses import dataclass

from sentry.api.api_owners import ApiOwner
from sentry.features.base import (
    Feature,
    FeatureHandlerStrategy,
    OrganizationFeature,
    ProjectFeature,
)
from sentry.utils import json


def serialize_flags(flags_to_generate):
    returned_serialized_flags = []
    for team in flags_to_generate.keys():
        for flag_name in flags_to_generate[team]:
            info = flags_to_generate[team][flag_name]

            serialized_flag = SerializedGeneratedFlag(
                flag_name, team, info["strategy"], info["scope"]
            )

            returned_serialized_flags.append(
                (serialized_flag.name, serialized_flag.scope, serialized_flag.strategy)
            )
    return returned_serialized_flags


def generate_flags():
    flags_to_generate = read_flags_file()
    return serialize_flags(flags_to_generate)


def read_flags_file():
    with open("src/sentry/features/generated_flags.json") as f:
        return json.loads(f.read())


@dataclass
class SerializedGeneratedFlag:
    strategy: FeatureHandlerStrategy
    name: str
    team: ApiOwner
    scope: Feature

    def __init__(self, name, team, strategy, scope):
        self.set_strategy(strategy)
        self.set_team(team)
        self.set_scope(scope)
        self.name = self.set_name(scope, team, name)

    def set_strategy(self, strategy):
        if strategy == "internal":
            self.strategy = FeatureHandlerStrategy.INTERNAL
        elif strategy == "remote":
            self.strategy = FeatureHandlerStrategy.REMOTE
        else:
            raise ValueError("Invalid strategy")

    def set_team(self, team):
        if team not in [ao.value for ao in ApiOwner]:
            raise ValueError("Invalid team")
        self.team = team

    def set_scope(self, scope):
        if scope == "project":
            scope = ProjectFeature
        elif scope == "organization":
            scope = OrganizationFeature
        else:
            raise ValueError("Invalid scope")

        self.scope = scope

    def set_name(self, scope, team, name):
        return f"{scope}s:{team}-{name}"
