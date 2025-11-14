#!/usr/bin/env python3
# flake8: noqa: S002

import argparse
import dataclasses
import sys
from pathlib import Path
from typing import Any, cast, int

import yaml

from flagpole import Feature
from flagpole.conditions import Segment
from flagpole.evaluation_context import EvaluationContext
from sentry.utils import json


def main() -> None:
    args = get_arguments()

    indent = "    "
    print("Opening file:")
    print(indent, args.get("flagpole_file"))
    print("")
    print("Evaluating flag:")
    print(indent, args.get("flag_name"))
    print("")
    print("Evaluation Context:")

    print(indent, args.get("context"))
    print("")

    try:
        feature = read_feature(args.get("flag_name", ""), args.get("flagpole_file", ""))
    except Exception as e:
        print("Unable to load feature")
        print(e)
        sys.exit(1)

    print("Definition:")
    print(feature.to_yaml_str())

    try:
        eval_context = EvaluationContext(cast(dict[str, Any], args.get("context", {})))
        (result, rollout, segment) = evaluate_flag(feature, eval_context)
    except Exception as e:
        print("Unable to eval. Check your context value")
        print(e)
        sys.exit(1)

    print("Result:")
    print(indent, result, f"({rollout}% rollout)" if result and rollout != 100 else "")
    if segment:
        print("Passing Segment:")
        print(indent, segment.name)


def get_arguments() -> dict:
    parser = argparse.ArgumentParser(
        description="Evaluate a flagpole flag.",
        epilog="""
Examples:
    %(prog)s --flag-name my-feature-flag
    %(prog)s --flag-name my-feature-flag --context '{"user_id": 123}'
    %(prog)s --flag-name my-feature-flag '{"user_id": 123, "organization_id": 456}'
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--flagpole-file",
        default=f"{Path.home()}/code/sentry-options-automator/options/default/flagpole.yaml",
        help="Path to the flagpole.yaml file containing flag definitions.",
    )
    parser.add_argument(
        "--flag-name",
        required=True,
        help="Name of the flag to evaluate from the flagpole file.",
    )
    parser.add_argument(
        "--context",
        required=False,
        help="JSON context object to evaluate the flag against (e.g., '{\"user_id\": 123}').",
    )
    (args, extra) = parser.parse_known_args()

    if args.context:
        context = json.loads(args.context)
    else:
        try:
            blob = [a for a in extra if a != "--"]
            context = json.loads(blob[0] or "{}")
        except (IndexError, json.JSONDecodeError):
            context = {}

    return {
        "context": context,
        "flag_name": args.flag_name,
        "flagpole_file": args.flagpole_file,
    }


def read_feature(flag_name: str, flagpole_file: str) -> Feature:
    with open(flagpole_file) as f:
        content = f.read()
        parsed_yaml = yaml.safe_load(content)
        options = parsed_yaml.get("options")
        dfn = cast(dict[str, Any], options.get(flag_name))

        feature = Feature.from_feature_dictionary(flag_name, dfn)
        return feature


def evaluate_flag(
    feature: Feature, context: EvaluationContext
) -> tuple[bool, int | None, Segment | None]:
    real_result = feature.match(context)

    for segment in feature.segments:
        test = dataclasses.replace(feature, segments=[segment])
        original_rollout = segment.rollout

        # Force the segment to be rolled out to 100% so that we text whether the
        # conditions match our `context`, isolated from rollout bucketing.
        segment.rollout = 100
        if test.match(context):
            return (real_result, original_rollout, segment)

        # TODO: We could test the segment again with it's defined rollout in
        # order to report whether a project_id or organization_id would be in
        # the rollout group or not. Bucketing is based on the
        # `__identity_fields` inside `EvaluationContext`, which are set to be
        # `project_id` and `organization_id`, so both those fields would need to be set correctly
        # on the input.
        # See: https://github.com/getsentry/sentry/blob/master/src/sentry/features/flagpole_context.py#L122-L123

    return (real_result, None, None)


if __name__ == "__main__":
    main()
