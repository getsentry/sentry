from time import time
from urllib.parse import urlparse

from celery.signals import task_postrun, task_prerun
from django.conf import settings

from sentry.net.http import SafeSession
from sentry.utils.sdk import capture_exception, configure_scope


def get_api_root_from_dsn(dsn):
    if not dsn:
        return
    parsed = urlparse(dsn)
    if parsed.port:
        return f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"
    return f"{parsed.scheme}://{parsed.hostname}"


SENTRY_DSN = settings.SENTRY_MONITOR_DSN

API_ROOT = settings.SENTRY_MONITOR_API_ROOT or get_api_root_from_dsn(SENTRY_DSN)


def connect(app):
    task_prerun.connect(report_monitor_begin, weak=False)
    task_postrun.connect(report_monitor_complete, weak=False)

    # XXX(dcramer): Celery docs suggest it should be app.conf.beat_schedule, which
    # was likely a change in 4.x. This code is intended to support "any celery" and be
    # adopted into sentry-sdk core, thus we support it here.
    schedule = (
        app.conf.beat_schedule
        if hasattr(app.conf, "beat_schedule")
        else app.conf["CELERYBEAT_SCHEDULE"]
    )
    for schedule_name, monitor_id in settings.SENTRY_CELERYBEAT_MONITORS.items():
        schedule[schedule_name].setdefault("options", {}).setdefault("headers", {}).setdefault(
            "X-Sentry-Monitor", monitor_id
        )


# Celery signals fail to propagate if they error and we dont want to break things with our
# instrumentation
# XXX(dcramer): This appears to be specific to the 3.x series we're running, and doesn't have
# the same behavior in 4.x
def suppress_errors(func):
    def inner(*a, **k):
        try:
            return func(*a, **k)
        except Exception:
            capture_exception()

    return inner


@suppress_errors
def report_monitor_begin(task, **kwargs):
    if not SENTRY_DSN or not API_ROOT:
        return

    headers = task.request.headers
    if not headers:
        return

    monitor_id = headers.get("X-Sentry-Monitor")
    if not monitor_id:
        return

    with configure_scope() as scope:
        scope.set_context("monitor", {"id": monitor_id})

    with SafeSession() as session:
        req = session.post(
            f"{API_ROOT}/api/0/monitors/{monitor_id}/checkins/",
            headers={"Authorization": f"DSN {SENTRY_DSN}"},
            json={"status": "in_progress"},
        )
        req.raise_for_status()
        # HACK:
        headers["X-Sentry-Monitor-CheckIn"] = (req.json()["id"], time())


@suppress_errors
def report_monitor_complete(task, retval, **kwargs):
    if not SENTRY_DSN or not API_ROOT:
        return

    headers = task.request.headers
    if not headers:
        return

    monitor_id = headers.get("X-Sentry-Monitor")
    if not monitor_id:
        return

    try:
        checkin_id, start_time = headers.get("X-Sentry-Monitor-CheckIn")
    except (ValueError, TypeError):
        return

    duration = int((time() - start_time) * 1000)

    with SafeSession() as session:
        session.put(
            f"{API_ROOT}/api/0/monitors/{monitor_id}/checkins/{checkin_id}/",
            headers={"Authorization": f"DSN {SENTRY_DSN}"},
            json={
                "status": "error" if isinstance(retval, Exception) else "ok",
                "duration": duration,
            },
        ).raise_for_status()
