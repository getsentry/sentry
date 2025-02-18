from flagpole import Feature
from flagpole.conditions import ConditionOperatorKind
from sentry.runner.commands.createflag import createflag
from sentry.testutils.cases import CliTestCase


class TestCreateFlag(CliTestCase):
    command = createflag

    def convert_output_to_feature(self, output: str) -> Feature:
        split_output = output.split("=== GENERATED YAML ===\n")
        assert len(split_output) == 2
        return Feature.from_bulk_yaml(split_output[1])[0]

    def test_blank_options_only(self):
        rv = self.invoke("--blank", "--name=new flag", "--scope=organizations", "--owner=test")
        assert rv.exit_code == 0
        parsed_feature = self.convert_output_to_feature(rv.output)
        assert parsed_feature.name == "feature.organizations:new-flag"
        assert parsed_feature.segments == []
        assert parsed_feature.owner == "test"

    def test_no_segments(self):
        cli_input = ["new Flag", "Test Owner", "projects", "n"]
        rv = self.invoke(input="\n".join(cli_input))
        assert rv.exit_code == 0
        parsed_feature = self.convert_output_to_feature(rv.output)
        assert parsed_feature.name == "feature.projects:new-flag"
        assert parsed_feature.segments == []
        assert parsed_feature.owner == "Test Owner"

    def test_no_conditions_in_segment(self):
        cli_input = ["y", "New segment", "50", "n"]
        rv = self.invoke(
            "--name=new flag",
            "--scope=organizations",
            "--owner=Test Owner",
            input="\n".join(cli_input),
        )
        assert rv.exit_code == 0
        parsed_feature = self.convert_output_to_feature(rv.output)
        assert parsed_feature.name == "feature.organizations:new-flag"
        assert parsed_feature.owner == "Test Owner"

        assert len(parsed_feature.segments) == 1
        new_segment = parsed_feature.segments[0]
        assert new_segment.name == "New segment"
        assert new_segment.rollout == 50
        assert new_segment.conditions == []

    def test_all_condition_types(self):
        cli_input = ["", "New segment", "", "y"]
        conditions_tuples = []

        for condition_type in ConditionOperatorKind:
            condition_data = (f"c_prop_{condition_type.value}", f"{condition_type.value}", "y")
            conditions_tuples.append(condition_data)
            cli_input.extend(condition_data)

        # Change last input to No to discontinue creating conditions
        cli_input[len(cli_input) - 1] = "n"

        # Skip creating more segments
        cli_input.append("n")

        rv = self.invoke(
            "--name=new flag",
            "--scope=organizations",
            "--owner=Test Owner",
            input="\n".join(cli_input),
        )
        assert rv.exit_code == 0, rv.output
        parsed_feature = self.convert_output_to_feature(rv.output)
        assert parsed_feature.name == "feature.organizations:new-flag"
        assert parsed_feature.owner == "Test Owner"

        assert len(parsed_feature.segments) == 1
        new_segment = parsed_feature.segments[0]

        assert new_segment.name == "New segment"
        assert new_segment.rollout == 100

        assert len(new_segment.conditions) == 6

        for c_idx in range(len(conditions_tuples)):
            condition_tuple = conditions_tuples[c_idx]
            condition = new_segment.conditions[c_idx]

            assert condition.property == condition_tuple[0]
            assert condition.operator == condition_tuple[1]
