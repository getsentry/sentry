from typing import int
import hashlib
import logging
import math
import uuid
from collections.abc import Generator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from itertools import islice

from sentry import options
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.workflow_engine.buffer.batch_client import (
    CohortUpdates,
    DelayedWorkflowClient,
    ProjectDelayedWorkflowClient,
)
from sentry.workflow_engine.tasks.delayed_workflows import process_delayed_workflows

logger = logging.getLogger(__name__)


def bucket_num_groups(num_groups: int) -> str:
    if num_groups > 1:
        magnitude = 10 ** int(math.log10(num_groups))
        return f">{magnitude}"
    return "1"


def process_in_batches(client: ProjectDelayedWorkflowClient) -> None:
    """
    This will check the number of alertgroup_to_event_data items in the Redis buffer for a project.

    If the number is larger than the batch size, it will chunk the items and process them in batches.

    The batches are replicated into a new redis hash with a unique filter (a uuid) to identify the batch.
    We need to use a UUID because these batches can be created in multiple processes and we need to ensure
    uniqueness across all of them for the centralized redis buffer. The batches are stored in redis because
    we shouldn't pass objects that need to be pickled and 10k items could be problematic in the tasks
    as arguments could be problematic. Finally, we can't use a pagination system on the data because
    redis doesn't maintain the sort order of the hash keys.
    """
    batch_size = options.get(
        "delayed_processing.batch_size"
    )  # TODO: Use workflow engine-specific option.

    event_count = client.get_hash_length()
    metrics.incr(
        "workflow_engine.schedule.num_groups", tags={"num_groups": bucket_num_groups(event_count)}
    )
    metrics.distribution("workflow_engine.schedule.event_count", event_count)

    if event_count < batch_size:
        return process_delayed_workflows.apply_async(
            kwargs={"project_id": client.project_id},
            headers={"sentry-propagate-traces": False},
        )

    logger.info(
        "delayed_workflow.process_large_batch",
        extra={"project_id": client.project_id, "count": event_count},
    )

    # if the dictionary is large, get the items and chunk them.
    alertgroup_to_event_data = client.get_hash_data(batch_key=None)

    with metrics.timer("workflow_engine.schedule.process_batch.duration"):
        items = iter(alertgroup_to_event_data.items())

        while batch := dict(islice(items, batch_size)):
            batch_key = str(uuid.uuid4())

            # Write items to batched hash and delete from original hash.
            client.push_to_hash(
                batch_key=batch_key,
                data=batch,
            )
            client.delete_hash_fields(batch_key=None, fields=list(batch.keys()))

            process_delayed_workflows.apply_async(
                kwargs={"project_id": client.project_id, "batch_key": batch_key},
                headers={"sentry-propagate-traces": False},
            )


class ProjectChooser:
    """
    ProjectChooser assists in determining which projects to process based on the cohort updates.
    """

    def __init__(
        self, buffer_client: DelayedWorkflowClient, num_cohorts: int, min_scheduling_age: timedelta
    ):
        self.client = buffer_client
        assert num_cohorts > 0 and num_cohorts <= 255
        self.num_cohorts = num_cohorts
        self.min_scheduling_age = min_scheduling_age

    def _project_id_to_cohort(self, project_id: int) -> int:
        return hashlib.sha256(project_id.to_bytes(8)).digest()[0] % self.num_cohorts

    def project_ids_to_process(
        self, now: float, cohort_updates: CohortUpdates, all_project_ids: list[int]
    ) -> list[int]:
        """
        Given the time, the cohort update history, and the list of project ids in need of processing,
        determine which project ids should be processed.
        """
        must_process = set[int]()
        may_process = set[int]()
        cohort_to_elapsed = dict[int, timedelta]()
        long_ago = now - 1000
        target_max_age = timedelta(minutes=1)  # must run
        min_scheduling_age = self.min_scheduling_age  # can run
        # The cohort choice algorithm is essentially:
        # 1. Any cohort that hasn't been run recently enough (based on target_max_age)
        #   must be run.
        # 2. If no cohort _must_ be run, pick the most stale cohort that hasn't
        #  been run too recently (based on min_scheduling_age). To guarantee even distribution,
        #  min_scheduling_age should be <= the scheduling interval.
        #
        # With this, we distribute cohorts across runs, but ensure we don't process them
        # too frequently or too late, while not being too dependent on number of cohorts or
        # frequency of scheduling.
        if len(cohort_updates.values) != self.num_cohorts:
            logger.info(
                "%s cohort_updates.values, but num_cohorts is %s. Resetting.",
                len(cohort_updates.values),
                self.num_cohorts,
                extra={"cohort_updates": cohort_updates.values},
            )
            # When cohort counts change, we accept that we'll be potentially running some
            # projects a bit too early. Previous cohorts are no longer valid, so the timestamps
            # associated with them are only accurate for setting bounds on the whole project space.
            # But, we can still use that to avoid running projects too early by giving them all the
            # eldest timestamp.
            eldest = min(cohort_updates.values.values(), default=long_ago)
            # This also ensures that if we downsize cohorts, we don't let data from now-dead cohorts
            # linger.
            cohort_updates.values = {co: eldest for co in range(self.num_cohorts)}
        for co in range(self.num_cohorts):
            last_run = cohort_updates.values.get(co)
            if last_run is None:
                last_run = long_ago
                # It's a bug if the cohort doesn't exist at this point.
                metrics.incr(
                    "workflow_engine.schedule.cohort_not_found",
                    tags={"cohort": co},
                    sample_rate=1.0,
                )
            elapsed = timedelta(seconds=now - last_run)
            if last_run != long_ago:
                # Only track duration if we know the last run.
                metrics.distribution(
                    "workflow_engine.schedule.cohort_freshness",
                    elapsed.total_seconds(),
                    sample_rate=1.0,
                )
                cohort_to_elapsed[co] = elapsed
            if elapsed >= target_max_age:
                must_process.add(co)
            elif elapsed >= min_scheduling_age:
                may_process.add(co)
        if may_process and not must_process:
            choice = min(may_process, key=lambda c: (cohort_updates.values.get(c, long_ago), c))
            must_process.add(choice)
        cohort_updates.values.update({cohort_id: now for cohort_id in must_process})
        for cohort_id, elapsed in cohort_to_elapsed.items():
            if cohort_id in must_process:
                metrics.distribution(
                    "workflow_engine.schedule.processed_cohort_freshness",
                    elapsed.total_seconds(),
                    sample_rate=1.0,
                )
                metrics.incr(
                    "workflow_engine.schedule.scheduled_cohort",
                    tags={"cohort": cohort_id},
                    sample_rate=1.0,
                )
        logger.info(
            "schedule.selected_cohorts",
            extra={"selected": sorted(must_process), "may_process": sorted(may_process)},
        )
        return [
            project_id
            for project_id in all_project_ids
            if self._project_id_to_cohort(project_id) in must_process
        ]


@contextmanager
def chosen_projects(
    project_chooser: ProjectChooser,
    fetch_time: float,
    all_project_ids: list[int],
) -> Generator[list[int]]:
    """
    Context manager that yields the project ids to be processed, and manages the
    cohort state after the processing is complete.
    """
    cohort_updates = project_chooser.client.fetch_updates()
    project_ids_to_process = project_chooser.project_ids_to_process(
        fetch_time, cohort_updates, all_project_ids
    )
    yield project_ids_to_process
    project_chooser.client.persist_updates(cohort_updates)


def process_buffered_workflows(buffer_client: DelayedWorkflowClient) -> None:
    option_name = buffer_client.option
    if option_name and not options.get(option_name):
        logger.info("delayed_workflow.disabled", extra={"option": option_name})
        return

    with metrics.timer("workflow_engine.schedule.process_all_conditions.duration", sample_rate=1.0):
        fetch_time = datetime.now(tz=timezone.utc).timestamp()
        all_project_ids_and_timestamps = buffer_client.get_project_ids(
            min=0,
            max=fetch_time,
        )

        project_chooser = ProjectChooser(
            buffer_client,
            num_cohorts=options.get("workflow_engine.num_cohorts", 1),
            min_scheduling_age=timedelta(
                seconds=options.get(
                    "workflow_engine.schedule.min_cohort_scheduling_age_seconds", 50
                )
            ),
        )

        with chosen_projects(
            project_chooser, fetch_time, list(all_project_ids_and_timestamps.keys())
        ) as project_ids_to_process:
            metrics.distribution("workflow_engine.schedule.projects", len(project_ids_to_process))
            logger.info(
                "delayed_workflow.project_id_list",
                extra={"project_ids": sorted(project_ids_to_process)},
            )

            for project_id in project_ids_to_process:
                process_in_batches(buffer_client.for_project(project_id))

            mark_projects_processed(
                buffer_client, project_ids_to_process, all_project_ids_and_timestamps
            )


def mark_projects_processed(
    buffer_client: DelayedWorkflowClient,
    processed_project_ids: list[int],
    all_project_ids_and_timestamps: dict[int, list[float]],
) -> None:
    if not all_project_ids_and_timestamps:
        return
    with metrics.timer("workflow_engine.scheduler.mark_projects_processed"):
        processed_member_maxes = [
            (project_id, max(timestamps))
            for project_id, timestamps in all_project_ids_and_timestamps.items()
            if project_id in processed_project_ids
        ]
        deleted_project_ids = set[int]()
        # The conditional delete can be slow, so we break it into chunks that probably
        # aren't big enough to hold onto the main redis thread for too long.
        for chunk in chunked(processed_member_maxes, 500):
            with metrics.timer(
                "workflow_engine.conditional_delete_from_sorted_sets.chunk_duration"
            ):
                deleted = buffer_client.mark_project_ids_as_processed(dict(chunk))
                deleted_project_ids.update(deleted)

        logger.info(
            "process_buffered_workflows.project_ids_deleted",
            extra={
                "deleted_project_ids": sorted(deleted_project_ids),
                "processed_project_ids": sorted(processed_project_ids),
            },
        )
