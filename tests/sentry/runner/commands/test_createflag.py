from datetime import date
from typing import Any

import yaml

from flagpole.conditions import ConditionOperatorKind
from sentry.runner.commands.createflag import createflag, createissueflag
from sentry.testutils.cases import CliTestCase


def parse_generated_yaml(output: str) -> dict[str, Any]:
    split_output = output.split("=== GENERATED YAML ===\n")
    assert len(split_output) == 2
    return yaml.safe_load(split_output[1])


class TestCreateFlag(CliTestCase):
    command = createflag

    def test_blank_options_only(self) -> None:
        rv = self.invoke("--blank", "--name=new flag", "--scope=organizations", "--owner=test")
        assert rv.exit_code == 0
        assert parse_generated_yaml(rv.output) == {
            "feature.organizations:new-flag": {
                "created_at": date.today().isoformat(),
                "enabled": True,
                "owner": {"team": "test", "email": None},
                "segments": [],
            }
        }

    def test_no_segments(self) -> None:
        cli_input = ["new Flag", "Test Owner", "projects", "n"]
        rv = self.invoke(input="\n".join(cli_input))
        assert rv.exit_code == 0
        feature = parse_generated_yaml(rv.output)["feature.projects:new-flag"]
        assert feature["segments"] == []
        assert feature["owner"] == {"team": "Test Owner", "email": None}

    def test_no_conditions_in_segment(self) -> None:
        cli_input = ["y", "New segment", "50", "n", "n"]
        rv = self.invoke(
            "--name=new flag",
            "--scope=organizations",
            "--owner=Test Owner",
            input="\n".join(cli_input),
            catch_exceptions=False,
        )
        assert rv.exit_code == 0
        feature = parse_generated_yaml(rv.output)["feature.organizations:new-flag"]
        assert feature["segments"] == [{"name": "New segment", "rollout": 50, "conditions": []}]

    def test_all_condition_types(self) -> None:
        cli_input = ["", "New segment", "", "y"]
        for condition_type in ConditionOperatorKind:
            cli_input.extend((f"c_prop_{condition_type.value}", condition_type.value, "y"))

        # Change last input to No to discontinue creating conditions
        cli_input[-1] = "n"
        # Skip creating more segments
        cli_input.append("n")

        rv = self.invoke(
            "--name=new flag",
            "--scope=organizations",
            "--owner=Test Owner",
            input="\n".join(cli_input),
        )
        assert rv.exit_code == 0, rv.output
        feature = parse_generated_yaml(rv.output)["feature.organizations:new-flag"]
        [segment] = feature["segments"]
        assert segment["name"] == "New segment"
        assert segment["rollout"] == 100
        list_operators = {"in", "not_in", "matches", "not_matches"}
        assert segment["conditions"] == [
            {
                "property": f"c_prop_{kind.value}",
                "operator": kind.value,
                "value": [] if kind.value in list_operators else "",
            }
            for kind in ConditionOperatorKind
        ]


class TestCreateIssueFlag(CliTestCase):
    command = createissueflag

    def test_invalid_slug(self) -> None:
        rv = self.invoke(
            "--slug=bad",
            "--owner=Test Owner",
        )
        assert rv.output.startswith("Error: Invalid GroupType slug. Valid grouptypes:")

    def test_valid_slug(self) -> None:
        rv = self.invoke(
            "--slug=uptime_domain_failure",
            "--owner=Test Owner",
        )
        assert rv.exit_code == 0, rv.output
        feature = {
            "created_at": date.today().isoformat(),
            "enabled": True,
            "owner": {"team": "Test Owner", "email": None},
            "segments": [
                {
                    "name": "LA",
                    "rollout": 0,
                    "conditions": [
                        {
                            "property": "organization_slug",
                            "operator": "in",
                            "value": ["sentry", "sentry-eu", "sentry-sdks", "sentry-st"],
                        }
                    ],
                },
                {
                    "name": "EA",
                    "rollout": 0,
                    "conditions": [
                        {
                            "property": "organization_is-early-adopter",
                            "operator": "equals",
                            "value": True,
                        }
                    ],
                },
                {"name": "GA", "rollout": 0, "conditions": []},
            ],
        }
        assert parse_generated_yaml(rv.output) == {
            "feature.organizations:issue-uptime-domain-failure-visible": feature,
            "feature.organizations:issue-uptime-domain-failure-ingest": feature,
            "feature.organizations:issue-uptime-domain-failure-post-process-group": feature,
        }
