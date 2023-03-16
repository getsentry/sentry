from sentry.models.project import Project
from sentry.signals import first_cron_checkin_received, first_cron_monitor_created

from .models import Monitor


def signal_first_checkin(project: Project, monitor: Monitor):
    if not project.flags.has_cron_checkins:
        # Backfill users that already have cron monitors
        if not project.flags.has_cron_monitors:
            first_cron_monitor_created.send_robust(project=project, user=None, sender=Project)
        first_cron_checkin_received.send_robust(
            project=project, monitor_id=str(monitor.guid), sender=Project
        )
