from sentry.models.project import Project
from sentry.signals import first_cron_checkin_received, first_cron_monitor_created

from .models import Monitor


def signal_first_checkin(project: Project, monitor: Monitor):
    if not project.flags.has_cron_checkins:
        # Backfill users that already have cron monitors
        signal_first_monitor_created(project, None, False)
        first_cron_checkin_received.send_robust(
            project=project, monitor_id=str(monitor.guid), sender=Project
        )


def signal_first_monitor_created(project: Project, user, from_upsert: bool):
    if not project.flags.has_cron_monitors:
        first_cron_monitor_created.send_robust(
            project=project, user=user, from_upsert=from_upsert, sender=Project
        )
