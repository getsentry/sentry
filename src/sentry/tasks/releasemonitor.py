import logging
import time
from datetime import timedelta

from django.utils import timezone

from sentry.models import Environment, Release, ReleaseProjectEnvironment
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.snuba import Dataset, raw_query

REQUIRED_ADOPTION_PERCENT = 0.1
CHUNK_SIZE = 1000
MAX_SECONDS = 60

logger = logging.getLogger("tasks.releasemonitor")


@instrumented_task(
    name="sentry.tasks.monitor_release_adoption",
    queue="releasemonitor.monitor_release_adoption",
    default_retry_delay=5,
    max_retries=5,
)
def monitor_release_adoption(**kwargs):
    metrics.incr("sentry.tasks.monitor_release_adoption.start")
    # 1. Runs
    # SELECT org_id, uniq(project_id)
    # FROM sessions_hourly_dist
    # WHERE date > now() - interval '<whatever>'
    # GROUP BY org_id
    # Date range here will be 12 hours to start.
    # NOTE: When this query is supported, make sure you paginate it.
    # NOTE: Hardcoded data for sentry org and sentry project for early release, in the same format snuba should return
    data = [
        {"org_id": [1], "project_id": [1]},
    ]

    # NOTE: This should probably be broken out into a separate task per org because it potentially has to paginate through a lot of snuba results.
    with metrics.timer("sentry.tasks.monitor_release_adoption.process_projects_with_sessions"):
        for row in data:
            process_projects_with_sessions(data["org_id"][0], data["project_id"])


def process_projects_with_sessions(org_id, project_ids):
    # Accepts a single org id and a list of project ids
    # 2. For each org result from #1, run a query similar to
    # SELECT
    #     release AS _snuba_release,
    #     environment AS _snuba_environment,
    #     project AS _snuba_project,
    #     countIfMerge(sessions) + sumIfMerge(sessions_preaggr) AS _snuba_sessions
    # FROM sessions_hourly_local
    # WHERE org_id = <org id>
    # AND project_id IN (<the projects for that org>)
    # AND started >= toDateTime(<however long ago>, 'Universal')
    # AND started < toDateTime(<now>, 'Universal')
    # GROUP BY
    #     _snuba_release,
    #     _snuba_environment,
    #     _snuba_project,
    # LIMIT 0, 1000
    # Date range here is 6 hours.
    time_start = time.time()
    offset = 0
    total_sessions = 0
    updated_ids = []
    while (time.time() - time_start) < MAX_SECONDS:
        filters = {"org_id": [org_id], "project_id": project_ids}
        result_totals = raw_query(
            selected_columns=["sessions"],
            rollup=21600,  # NOTE: This doesn't seem to matter
            dataset=Dataset.Sessions,
            start=timezone.now() - timedelta(hours=6),
            end=timezone.now(),
            filter_keys=filters,
            groupby=["org_id", "project_id", "release", "environment"],
            referrer="sentry.tasks.releasemonitor.monitor_release_adoption.SessionsAcrossOrg",
            totals=True,
            limit=CHUNK_SIZE + 1,
            offset=offset,
        )
        data = result_totals["data"]
        count = len(data)
        more_results = count >= CHUNK_SIZE
        offset += count
        total_sessions = result_totals["totals"]["sessions"]

        # 3. Using the sums from #2, calculate adoption rate (relevant sessions / all sessions) update the appropriate ReleaseProjectEnvironment model adopted/unadopted fields.
        for row in data:
            rpe = ReleaseProjectEnvironment.objects.get(
                project_id=row["project_id"],
                release_id=Release.objects.get(organization=org_id, version=row["release"]).id,
                environment_id=Environment.objects.get(
                    organization_id=org_id,
                    project_id=row["project_id"],
                    name=row["environment"],
                ).id,
            )
            adopted = (
                True if row["sessions"] / total_sessions >= REQUIRED_ADOPTION_PERCENT else False
            )
            if adopted and rpe.adopted is None:
                rpe.update(adopted=timezone.now())
                updated_ids.append(rpe.id)
            elif not adopted and rpe.adopted:
                rpe.update(unadopted=timezone.now())

        if not more_results:
            break

    # 4. Cleanup - releases that are marked as adopted that didn’t get any results in #2 need to be marked as unadopted
    # Note: I'm really worried here that we would mark all releases as unadopted if snuba failed to return results for any reason...
    # It would probably get fixed in the next run of the task at least
    ReleaseProjectEnvironment.objects.filter(unadopted=None).exclude(
        adopted=None, id__in=updated_ids
    ).update(unadopted=timezone.now())
