import logging
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from sentry.models import Environment, Release, ReleaseProjectEnvironment
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.snuba import Dataset, raw_query

# TODO: Add metrics + some error casing
# TODO: Think about where too many results many be returned, and where you may want to batch things or even fire off another task
# TODO: Paginate step #1 query? Last I checked there are 43k projects. Not sure how many orgs.
# TODO: I'm actually not sure if I need to update ReleaseProject's? A release doesn't have to have an environment, but it seems like sessions do (https://develop.sentry.dev/sdk/sessions/)
# TODO: Can I select every ReleaseProjectEnvironment at once?
# TODO: Bulk select releases and environments? (per org)?
# TODO: Is step #2 really slow? Should I break it up per project? Org?

REQUIRED_ADOPTION_PERCENT = 0.1
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
    # NOTE: Hardcoded data for sentry org and sentry project for early release, in the same format snuba should return
    data = [
        {"org_id": [1], "project_id": [1]},
        # {"org_id":2,"project_id":[3,4]}
    ]  # This is the format snuba will return I believe

    # NOTE: This could potentially be broken out into a task per org, right now it just runs all orgs in sequence.
    with metrics.timer("sentry.tasks.monitor_release_adoption.process_projects_with_sessions"):
        process_projects_with_sessions(data)


def process_projects_with_sessions(data):
    # NOTE: This is mostly broke up to test easier with custom test data, since I can't currently query for projects with sessions
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
    # Date range here is 6 hours to start.
    with metrics.timer("sentry.tasks.monitor_release_adoption.org_query_loop"):
        for row in data:
            with metrics.timer("sentry.tasks.monitor_release_adoption.org_query_execution"):
                filters = {"org_id": row["org_id"], "project_id": row["project_id"]}
                result_totals = raw_query(
                    selected_columns=["sessions"],
                    rollup=3600,
                    dataset=Dataset.Sessions,
                    start=timezone.now() - timedelta(hours=6),
                    end=timezone.now(),
                    filter_keys=filters,
                    groupby=["org_id", "project_id", "release", "environment"],
                    referrer="sentry.tasks.sreleasemonitor.monitor_release_adoption.SessionsAcrossOrg",
                )

            with metrics.timer("sentry.tasks.monitor_release_adoption.org_query_summation"):
                release_sums = defaultdict(dict)
                total_sessions = 0
                # Sum counts
                if result_totals["data"]:
                    # Need to sum the data for each release + project (+env) combo.
                    for row in result_totals["data"]:
                        org_id = row["org_id"]
                        release = row["release"]
                        project_id = row["project_id"]
                        env = row["environment"] if "environment" in row else None
                        count = row["sessions"]
                        if project_id not in release_sums[org_id]:
                            release_sums[org_id][project_id] = defaultdict(dict)
                        if release not in release_sums[org_id][project_id]:
                            release_sums[org_id][project_id][release] = defaultdict(int)
                        release_sums[org_id][project_id][release][env] += count
                        total_sessions += count

    # 3. Using the sums from #2, calculate adoption rate (relevant sessions / all sessions) update the appropriate postgres model adopted/unadopted fields as appropriate.
    with metrics.timer("sentry.tasks.monitor_release_adoption.update_postgres_loop"):
        for org_id in release_sums:
            with metrics.timer("sentry.tasks.monitor_release_adoption.org_loop"):
                for project_id in release_sums[org_id]:
                    with metrics.timer("sentry.tasks.monitor_release_adoption.project_loop"):
                        for release in release_sums[org_id][project_id]:
                            with metrics.timer("sentry.tasks.monitor_release_adoption.env_loop"):
                                for env in release_sums[org_id][project_id][release]:
                                    if env is not None:
                                        # TODO: Make this one query or fetch all in bulk? Not sure how to do bulk without overselecting, but I can at least start with a subquery.
                                        rpe = ReleaseProjectEnvironment.objects.get(
                                            project_id=project_id,
                                            release_id=Release.objects.get(
                                                organization=org_id, version=release
                                            ).id,
                                            environment_id=Environment.objects.get(
                                                organization_id=org_id,
                                                project_id=project_id,
                                                name=env,
                                            ).id,
                                        )
                                        adopted = (
                                            True
                                            if release_sums[org_id][project_id][release][env]
                                            / total_sessions
                                            >= REQUIRED_ADOPTION_PERCENT
                                            else False
                                        )
                                        if adopted and rpe.adopted is None:
                                            rpe.update(adopted=timezone.now())
                                        elif not adopted and rpe.adopted:
                                            rpe.update(unadopted=timezone.now())
                                    else:
                                        # TODO: Verify if this case is possible or not. I think sessions actually do always have an environment. Docs make it seem like they don't.
                                        logger.info(
                                            "process_projects_with_sessions.no_environment",
                                            extra={"project": project_id, "release": release},
                                        )
                                        raise Exception("No environment.")

    # 4. Small cleanup - releases that are marked as adopted that didn’t get any results in #2 need to be marked as unadopted
    # TODO
    # uh...should i save ReleaseProjectEnvironment id's that were updated in the previous step..and select every adopted release that isn't in there?
