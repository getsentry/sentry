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
@click.option(
    "-d", "--detector", "detector_class", help="Limit detection to only one detector class"
)
@click.option("-v", "--verbose", count=True)
@configuration
def detect(filename, detector_class, verbose):
    """
    Runs performance problem detection on event data in the supplied filename
    using default detector settings with every detector. Filename should be a
    path to a JSON event data file.
    """
    from sentry.utils.performance_issues import performance_detection

    if detector_class:
        detector_classes = [performance_detection.__dict__[detector_class]]
    else:
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
        if verbose > 1:
            click.echo(f"Event ID: {data['event_id']}")

        detectors = [cls(settings, data) for cls in detector_classes]

        for detector in detectors:
            if verbose > 0:
                click.echo(f"Detecting using {detector.__class__.__name__}")

            performance_detection.run_detector_on_data(detector, data)

            if verbose > 1:
                if len(detector.stored_problems) == 0:
                    click.echo("No problems detected")
                else:
                    click.echo(
                        f"Found {len(detector.stored_problems)} {pluralize(len(detector.stored_problems), 'problem,problems')}"
                    )

            for problem in detector.stored_problems.values():
                try:
                    click.echo(problem.to_dict())
                except AttributeError:
                    click.echo(problem)

            click.echo("\n")
