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
    from sentry.utils.performance_issues.base import PerformanceDetector

    if detector_class:
        detector_classes = [performance_detection.__dict__[detector_class]]
    else:
        detector_classes = [
            cls
            for _, cls in performance_detection.__dict__.items()
            if isclass(cls) and issubclass(cls, PerformanceDetector) and cls != PerformanceDetector
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


@performance.command()
@click.argument("filename", type=click.Path(exists=True))
@click.option("-d", "--detector", "detector_class", help="Detector class", required=True)
@click.option(
    "-n", required=False, type=int, default=1000, help="Number of times to run detection."
)
@configuration
def timeit(filename, detector_class, n):
    """
    Runs timing on performance problem detection on event data in the supplied
    filename and report results.
    """

    click.echo(f"Running timeit {n} times on {detector_class}")

    import timeit

    from sentry.utils.performance_issues import performance_detection

    settings = performance_detection.get_detection_settings()

    with open(filename) as file:
        data = json.loads(file.read())

    detector = performance_detection.__dict__[detector_class](settings, data)

    def detect():
        performance_detection.run_detector_on_data(detector, data)

    result = timeit.timeit(stmt=detect, number=n)
    click.echo(f"Average runtime: {result * 1000 / n} ms")
