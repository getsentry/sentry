#!/usr/bin/env python
import click

from sentry.runner import configure

configure()

from sentry.sentry_apps.models import SentryApp
from sentry.sentry_apps.tasks.sentry_apps import create_or_update_service_hooks_for_sentry_app
from sentry.utils.query import RangeQuerySetWrapper


def backfill_servicehooks_for_all_sentry_apps():
    """
    This script goes through all sentry apps and attempts to create or update servicehooks for each.
    """
    sentry_apps = SentryApp.objects.all()

    for sentry_app in RangeQuerySetWrapper(queryset=sentry_apps):
        click.echo(f"\nAttempting to backfill servicehooks for {sentry_app.slug}")

        create_or_update_service_hooks_for_sentry_app.delay(
            sentry_app_id=sentry_app.id,
            webhook_url=sentry_app.webhook_url,
            events=sentry_app.events,
        )


if __name__ == "__main__":
    backfill_servicehooks_for_all_sentry_apps()
