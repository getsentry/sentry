from collections import OrderedDict
from datetime import datetime, timedelta

import click
import pytz
from dateutil.parser import parse

from sentry.runner.decorators import configuration
from sentry.utils.compat import map
from sentry.utils.iterators import chunked


class DateTimeParamType(click.ParamType):
    name = "datetime"

    def convert(self, context, option, value):
        if value is None:
            return value
        elif isinstance(value, datetime):
            return value

        try:
            result = parse(value)
        except Exception:
            self.fail(f"{value!r} is not a valid datetime", option, context)

        if result.tzinfo is None:
            # TODO: We should probably warn about this? Also note that this
            # doesn't use the Django specified timezone, since settings haven't
            # been configured yet.
            result = result.replace(tzinfo=pytz.utc)

        return result


@click.group()
def tsdb():
    """Tools for interacting with the time series database."""


@tsdb.group()
def query():
    """Execute queries against the time series database."""


@query.command()
@click.argument(
    "metrics",
    nargs=-1,
    type=click.Choice(
        [
            "organization_total_received",
            "organization_total_rejected",
            "organization_total_blacklisted",
        ]
    ),
)
@click.option("--since", callback=DateTimeParamType())
@click.option("--until", callback=DateTimeParamType())
@configuration
def organizations(metrics, since, until):
    """
    Fetch metrics for organizations.
    """
    from django.utils import timezone

    from sentry.app import tsdb
    from sentry.models import Organization

    stdout = click.get_text_stream("stdout")
    stderr = click.get_text_stream("stderr")

    def aggregate(series):
        return sum(value for timestamp, value in series)

    metrics = OrderedDict((name, getattr(tsdb.models, name)) for name in metrics)
    if not metrics:
        return

    if until is None:
        until = timezone.now()

    if since is None:
        since = until - timedelta(minutes=60)

    if until < since:
        raise click.ClickException(f"invalid time range provided: {since} to {until}")

    stderr.write("Dumping {} from {} to {}...\n".format(", ".join(metrics.keys()), since, until))

    objects = Organization.objects.all()

    for chunk in chunked(objects, 100):
        instances = OrderedDict((instance.pk, instance) for instance in chunk)

        results = {}
        for metric in metrics.values():
            results[metric] = tsdb.get_range(metric, list(instances.keys()), since, until)

        for key, instance in instances.items():
            values = []
            for metric in metrics.values():
                values.append(aggregate(results[metric][key]))

            stdout.write(
                "{} {} {}\n".format(instance.id, instance.slug, " ".join(map(str, values)))
            )
