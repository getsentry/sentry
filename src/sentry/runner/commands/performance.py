#!/usr/bin/env python

from inspect import isclass

import click
from django.template.defaultfilters import pluralize

from sentry.runner.decorators import configuration
from sentry.utils import json


@click.group()
def performance() -> None:
    """
    Performance utilities
    """


@performance.command()
@click.argument("filename", type=click.Path(exists=True))
@click.option("-v", "--verbose", count=True)
@configuration
def detect(filename, verbose):
    """
    Runs performance problem detection on event data in the supplied filename
    using default detector settings with every detector. Filename should be a
    path to a JSON event data file.
    """
    from sentry.utils.performance_issues import performance_detection

    detector_classes = [
        cls
        for _, cls in performance_detection.__dict__.items()
        if isclass(cls)
        and issubclass(cls, performance_detection.PerformanceDetector)
        and cls != performance_detection.PerformanceDetector
    ]

    settings = performance_detection.get_detection_settings()

    with open(filename) as file:
        data = json.loads(file.read())
        click.echo(f"Event ID: {data['event_id']}")

        detectors = [cls(settings, data) for cls in detector_classes]

        for detector in detectors:
            click.echo(f"Detecting using {detector.__class__.__name__}")
            performance_detection.run_detector_on_data(detector, data)

            if len(detector.stored_problems) == 0:
                click.echo("No problems detected")
            else:
                click.echo(
                    f"Found {len(detector.stored_problems)} {pluralize(len(detector.stored_problems), 'problem,problems')}"
                )

            if verbose > 0:
                for problem in detector.stored_problems.values():
                    try:
                        click.echo(problem.to_dict())
                    except AttributeError:
                        click.echo(problem)

            click.echo("\n")
