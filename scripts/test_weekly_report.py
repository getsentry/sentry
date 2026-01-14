#!/usr/bin/env python
"""
Script to generate a test weekly report email.

Usage:
    python scripts/test_weekly_report.py --org <org_slug> --user <user_email>

Or use sentry exec:
    sentry exec scripts/test_weekly_report.py --org <org_slug> --user <user_email>
"""
import sys
from datetime import timedelta

import click
from django.utils import timezone

from sentry.models.organization import Organization
from sentry.models.user import User
from sentry.tasks.summaries.weekly_reports import prepare_organization_report
from sentry.utils.dates import floor_to_utc_day


@click.command()
@click.option("--org", required=True, help="Organization slug")
@click.option("--user", required=True, help="User email")
@click.option("--days", default=7, help="Number of days to include (default: 7)")
@click.option("--dry-run", is_flag=True, help="Don't actually send email, just generate")
def generate_test_report(org: str, user: str, days: int, dry_run: bool) -> None:
    """Generate a test weekly report email."""

    # Find organization
    try:
        organization = Organization.objects.get(slug=org)
        click.echo(f"✓ Found organization: {organization.name} (ID: {organization.id})")
    except Organization.DoesNotExist:
        click.echo(f"✗ Organization '{org}' not found", err=True)
        sys.exit(1)

    # Find user
    try:
        user_obj = User.objects.get(email=user)
        click.echo(f"✓ Found user: {user_obj.email} (ID: {user_obj.id})")
    except User.DoesNotExist:
        click.echo(f"✗ User '{user}' not found", err=True)
        sys.exit(1)

    # Calculate timestamp and duration
    now = timezone.now()
    timestamp = floor_to_utc_day(now).timestamp()
    duration = days * 24 * 60 * 60  # days in seconds

    click.echo(f"\nGenerating report:")
    click.echo(f"  Period: Last {days} days")
    click.echo(f"  Start: {floor_to_utc_day(now - timedelta(days=days))}")
    click.echo(f"  End: {floor_to_utc_day(now)}")
    click.echo(f"  Dry run: {dry_run}")
    click.echo()

    # Generate report
    try:
        prepare_organization_report(
            timestamp=timestamp,
            duration=duration,
            organization_id=organization.id,
            batch_id="test-weekly-report",
            dry_run=dry_run,
            target_user=user_obj.id,
        )

        if dry_run:
            click.echo("✓ Report generated (dry run - no email sent)")
            click.echo("\nTo actually send the email, run without --dry-run flag")
        else:
            click.echo("✓ Report generated and email sent!")
            click.echo(f"\nCheck your email at: {user_obj.email}")

    except Exception as e:
        click.echo(f"✗ Error generating report: {e}", err=True)
        raise


if __name__ == "__main__":
    generate_test_report()
