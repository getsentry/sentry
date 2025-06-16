#!/usr/bin/env python


import os
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
@click.argument("path", type=click.Path(exists=True, path_type=str, file_okay=True, dir_okay=True))
@click.option(
    "-d",
    "--detector",
    "detector_class",
    help="Limit detection to only one detector class. Pass in the detector class name, i.e. NPlusOneAPICallsDetector ",
)
@click.option("-v", "--verbose", count=True)
@configuration
def detect(path: str, detector_class: str | None, verbose: int) -> None:
    """
    Runs performance problem detection on event data in the supplied filename or directory
    using default detector settings with every detector. Path should be a
    path to a JSON event data file or directory containing JSON event data files or folders of JSON event data files.
    """
    from sentry.performance_issues import performance_detection
    from sentry.performance_issues.base import PerformanceDetector

    if detector_class:
        detector_classes = [performance_detection.__dict__[detector_class]]
    else:
        detector_classes = [
            cls
            for _, cls in performance_detection.__dict__.items()
            if isclass(cls) and issubclass(cls, PerformanceDetector) and cls != PerformanceDetector
        ]

    settings = performance_detection.get_detection_settings()

    def run_detector_on_file(filepath: str) -> None:
        if not filepath.endswith(".json"):
            return
        with open(filepath) as file:
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

    if os.path.isdir(path):
        for root, _, files in os.walk(path):
            for file in files:
                run_detector_on_file(os.path.join(root, file))
    else:
        run_detector_on_file(path)


@performance.command()
@click.argument("filename", type=click.Path(exists=True))
@click.option("-d", "--detector", "detector_class", help="Detector class", required=True)
@click.option(
    "-n", required=False, type=int, default=1000, help="Number of times to run detection."
)
@configuration
def timeit(filename: str, detector_class: str, n: int) -> None:
    """
    Runs timing on performance problem detection on event data in the supplied
    filename and report results.
    """

    click.echo(f"Running timeit {n} times on {detector_class}")

    import timeit

    from sentry.performance_issues import performance_detection

    settings = performance_detection.get_detection_settings()

    with open(filename) as file:
        data = json.loads(file.read())

    detector = performance_detection.__dict__[detector_class](settings, data)

    def detect() -> None:
        performance_detection.run_detector_on_data(detector, data)

    result = timeit.timeit(stmt=detect, number=n)
    click.echo(f"Average runtime: {result * 1000 / n} ms")
