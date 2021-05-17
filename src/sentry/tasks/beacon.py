import logging
import platform
from datetime import timedelta
from hashlib import sha1
from uuid import uuid4

from django.conf import settings
from django.utils import timezone

import sentry
from sentry.app import locks, tsdb
from sentry.debug.utils.packages import get_all_package_versions
from sentry.http import safe_urlopen, safe_urlread
from sentry.tasks.base import instrumented_task
from sentry.utils import json

BEACON_URL = "https://sentry.io/remote/beacon/"

logger = logging.getLogger("beacon")


def get_install_id():
    from sentry import options

    install_id = options.get("sentry:install-id")
    if not install_id:
        install_id = sha1(uuid4().bytes).hexdigest()
        logger.info("beacon.generated-install-id", extra={"install_id": install_id})
        options.set("sentry:install-id", install_id)

    return install_id


def should_skip_beacon(install_id):
    if not settings.SENTRY_BEACON:
        logger.info("beacon.skipped", extra={"install_id": install_id, "reason": "disabled"})
        return True

    if settings.DEBUG:
        logger.info("beacon.skipped", extra={"install_id": install_id, "reason": "debug"})
        return True

    return False


@instrumented_task(name="sentry.tasks.send_beacon", queue="update")
def send_beacon():
    """
    Send a Beacon to a remote server operated by the Sentry team.

    See the documentation for more details.
    """
    from sentry import options
    from sentry.models import Broadcast, Organization, Project, Team, User

    install_id = get_install_id()

    if should_skip_beacon(install_id):
        return

    end = timezone.now()
    events_24h = tsdb.get_sums(
        model=tsdb.models.internal, keys=["events.total"], start=end - timedelta(hours=24), end=end
    )["events.total"]

    # we need this to be explicitly configured and it defaults to None,
    # which is the same as False
    anonymous = options.get("beacon.anonymous") is not False

    payload = {
        "install_id": install_id,
        "version": sentry.get_version(),
        "docker": sentry.is_docker(),
        "python_version": platform.python_version(),
        "data": {
            "users": User.objects.count(),
            "projects": Project.objects.count(),
            "teams": Team.objects.count(),
            "organizations": Organization.objects.count(),
            "events.24h": events_24h,
        },
        "packages": get_all_package_versions(),
        "anonymous": anonymous,
    }

    if not anonymous:
        payload["admin_email"] = options.get("system.admin-email")

    # TODO(dcramer): relay the response 'notices' as admin broadcasts
    try:
        request = safe_urlopen(BEACON_URL, json=payload, timeout=5)
        response = safe_urlread(request)
    except Exception:
        logger.warning("beacon.failed", exc_info=True, extra={"install_id": install_id})
        return
    else:
        logger.info("beacon.sent", extra={"install_id": install_id})

    data = json.loads(response)

    if "version" in data:
        options.set("sentry:latest_version", data["version"]["stable"])

    if "notices" in data:
        upstream_ids = set()
        for notice in data["notices"]:
            upstream_ids.add(notice["id"])
            defaults = {
                "title": notice["title"],
                "link": notice.get("link"),
                "message": notice["message"],
            }
            # XXX(dcramer): we're missing a unique constraint on upstream_id
            # so we're using a lock to work around that. In the future we'd like
            # to have a data migration to clean up the duplicates and add the constraint
            lock = locks.get("broadcasts:{}".format(notice["id"]), duration=60)
            with lock.acquire():
                affected = Broadcast.objects.filter(upstream_id=notice["id"]).update(**defaults)
                if not affected:
                    Broadcast.objects.create(upstream_id=notice["id"], **defaults)

        Broadcast.objects.filter(upstream_id__isnull=False).exclude(
            upstream_id__in=upstream_ids
        ).update(is_active=False)


@instrumented_task(name="sentry.tasks.send_beacon_metric", queue="update")
def send_beacon_metric(metrics, **kwargs):
    install_id = get_install_id()

    if should_skip_beacon(install_id):
        return

    payload = {
        "type": "metric",
        "install_id": install_id,
        "version": sentry.get_version(),
        "data": {
            "metrics": metrics,
        },
    }

    try:
        safe_urlopen(BEACON_URL, json=payload, timeout=5)
    except Exception:
        logger.warning("beacon_metric.failed", exc_info=True, extra={"install_id": install_id})
