#!/usr/bin/env python

import click

from sentry.runner.decorators import configuration
from sentry.utils import json


@click.group()
def performance() -> None:
    """
    Performance utilities
    """


@performance.command()
@click.argument("filename", type=click.Path(exists=True))
@configuration
def detect(filename):
    """
    Runs performance detection on event data in the supplied filename using
    default detector settings. Filename should be a path to a JSON event data
    file.
    """
    from sentry.utils.performance_issues.performance_detection import (
        NPlusOneDBSpanDetectorExtended,
        get_detection_settings,
        run_detector_on_data,
    )

    settings = get_detection_settings()

    with open(filename) as file:
        data = json.loads(file.read())

        detector = NPlusOneDBSpanDetectorExtended(settings, data)

        run_detector_on_data(detector, data)

        if len(detector.stored_problems) == 0:
            click.echo("No problems detected")

        for problem in detector.stored_problems.values():
            click.echo(problem.to_dict())
