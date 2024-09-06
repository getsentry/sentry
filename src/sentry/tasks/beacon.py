from __future__ import annotations

import logging
import platform
from datetime import timedelta
from hashlib import sha1
from typing import Any
from uuid import uuid4

import psutil
from django.conf import settings
from django.utils import timezone

import sentry
from sentry import tsdb
from sentry.debug.utils.packages import get_all_package_versions
from sentry.http import safe_urlopen, safe_urlread
from sentry.locks import locks
from sentry.silo.base import SiloMode
from sentry.snuba.outcomes import (
    QueryDefinition,
    massage_outcomes_result,
    run_outcomes_query_timeseries,
    run_outcomes_query_totals,
)
from sentry.tasks.base import instrumented_task
from sentry.tsdb.base import TSDBModel
from sentry.utils import json

BEACON_URL = "https://sentry.io/remote/beacon/"

logger = logging.getLogger(__name__)


def get_install_id() -> str:
    from sentry import options

    install_id = options.get("sentry:install-id")
    if not install_id:
        install_id = sha1(uuid4().bytes).hexdigest()
        logger.info("beacon.generated-install-id", extra={"install_id": install_id})
        options.set("sentry:install-id", install_id)

    return install_id


def should_skip_beacon(install_id: str) -> bool:
    if not settings.SENTRY_BEACON:
        logger.info("beacon.skipped", extra={"install_id": install_id, "reason": "disabled"})
        return True

    if settings.DEBUG:
        logger.info("beacon.skipped", extra={"install_id": install_id, "reason": "debug"})
        return True

    if SiloMode.get_current_mode() != SiloMode.MONOLITH:
        return True

    return False


def get_events_24h() -> int:
    from sentry.models.organization import Organization

    organization_ids = list(Organization.objects.all().values_list("id", flat=True))
    end = timezone.now()
    sum_events = 0
    for organization_id in organization_ids:
        events_per_org_24h = tsdb.backend.get_sums(
            model=TSDBModel.organization_total_received,
            keys=[organization_id],
            start=end - timedelta(hours=24),
            end=end,
            tenant_ids={"organization_id": organization_id},
        )
        sum_events += sum(p for _, p in events_per_org_24h.items())

    return sum_events


def get_category_event_count_24h() -> dict[str, int]:
    from sentry.models.organization import Organization

    organization_ids = list(Organization.objects.all().values_list("id", flat=True))
    event_categories_count = {"error": 0, "replay": 0, "transaction": 0, "profile": 0, "monitor": 0}
    for organization_id in organization_ids:
        # Utilize the outcomes dataset to send snql queries for event stats
        query = QueryDefinition(
            fields=["sum(quantity)"],
            organization_id=organization_id,
            stats_period="24h",
            group_by=["category"],
            outcome=["accepted"],
        )
        tenant_ids = {"organization_id": organization_id}
        result_totals = run_outcomes_query_totals(query, tenant_ids=tenant_ids)
        result_timeseries = run_outcomes_query_timeseries(query, tenant_ids=tenant_ids)
        result = massage_outcomes_result(query, result_totals, result_timeseries)
        for group in result["groups"]:
            if group["by"]["category"] in event_categories_count.keys():
                event_categories_count[group["by"]["category"]] += group["totals"]["sum(quantity)"]
    return event_categories_count


@instrumented_task(name="sentry.tasks.send_beacon", queue="update")
def send_beacon() -> None:
    """
    Send a Beacon to a remote server operated by the Sentry team.

    See the documentation for more details.
    """
    from sentry import options
    from sentry.models.broadcast import Broadcast
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.team import Team
    from sentry.users.models.user import User

    install_id = get_install_id()

    if should_skip_beacon(install_id):
        return

    # we need this to be explicitly configured and it defaults to None,
    # which is the same as False
    anonymous = options.get("beacon.anonymous") is not False
    # getting an option sets it to the default value, so let's avoid doing that if for some reason consent prompt is somehow skipped because of this
    send_cpu_ram_usage = (
        options.get("beacon.record_cpu_ram_usage")
        if options.isset("beacon.record_cpu_ram_usage")
        else False
    )
    event_categories_count = get_category_event_count_24h()
    byte_in_gibibyte = 1024**3

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
            "events.24h": get_events_24h(),
            "errors.24h": event_categories_count["error"],
            "transactions.24h": event_categories_count["transaction"],
            "replays.24h": event_categories_count["replay"],
            "profiles.24h": event_categories_count["profile"],
            "monitors.24h": event_categories_count["monitor"],
            "cpu_cores_available": psutil.cpu_count() if send_cpu_ram_usage else None,
            "cpu_percentage_utilized": psutil.cpu_percent() if send_cpu_ram_usage else None,
            "ram_available_gb": (
                psutil.virtual_memory().total / byte_in_gibibyte if send_cpu_ram_usage else None
            ),
            "ram_percentage_utilized": (
                psutil.virtual_memory().percent if send_cpu_ram_usage else None
            ),
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
            lock = locks.get("broadcasts:{}".format(notice["id"]), duration=60, name="broadcasts")
            with lock.acquire():
                affected = Broadcast.objects.filter(upstream_id=notice["id"]).update(**defaults)
                if not affected:
                    Broadcast.objects.create(upstream_id=notice["id"], **defaults)

        Broadcast.objects.filter(upstream_id__isnull=False).exclude(
            upstream_id__in=upstream_ids
        ).update(is_active=False)


@instrumented_task(name="sentry.tasks.send_beacon_metric", queue="update")
def send_beacon_metric(metrics: list[dict[str, Any]], **kwargs: object) -> None:
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
