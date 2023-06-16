import logging

from django.http import HttpResponse

from sentry import eventstore
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.grouping.api import GroupingConfigNotFound
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


from rest_framework.request import Request
from rest_framework.response import Response

from sentry.grouping.variants import PerformanceProblemVariant
from sentry.utils.performance_issues.performance_detection import EventPerformanceProblem


@region_silo_endpoint
class EventGroupingInfoEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, event_id) -> Response:
        """
        Returns the grouping information for an event
        `````````````````````````````````````````````

        This endpoint returns a JSON dump of the metadata that went into the
        grouping algorithm.
        """
        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise ResourceDoesNotExist

        rv = {}
        config_name = request.GET.get("config") or None

        # We always fetch the stored hashes here.  The reason for this is
        # that we want to show in the UI if the forced grouping algorithm
        # produced hashes that would normally also appear in the event.
        hashes = event.get_hashes()

        try:
            if event.get_event_type() == "transaction":
                # Transactions events are grouped using performance detection. They
                # are not subject to grouping configs, and the only relevant
                # grouping variant is `PerformanceProblemVariant`.

                problems = EventPerformanceProblem.fetch_multi([(event, h) for h in hashes.hashes])

                # Create a variant for every problem associated with the event
                # TODO: Generate more unique keys, in case this event has more than
                # one problem of a given type
                variants = {
                    problem.problem.type.slug: PerformanceProblemVariant(problem)
                    for problem in problems
                    if problem
                }
            else:
                variants = event.get_grouping_variants(
                    force_config=config_name, normalize_stacktraces=True
                )

        except GroupingConfigNotFound:
            raise ResourceDoesNotExist(detail="Unknown grouping config")

        for (key, variant) in variants.items():
            d = variant.as_dict()
            # Since the hashes are generated on the fly and might no
            # longer match the stored ones we indicate if the hash
            # generation caused the hash to mismatch.
            d["hashMismatch"] = hash_mismatch = (
                d["hash"] is not None
                and d["hash"] not in hashes.hashes
                and d["hash"] not in hashes.hierarchical_hashes
            )

            if hash_mismatch:
                metrics.incr("event_grouping_info.hash_mismatch")
                logger.error(
                    "event_grouping_info.hash_mismatch",
                    extra={"project_id": project.id, "event_id": event_id},
                )
            else:
                metrics.incr("event_grouping_info.hash_match")

            d["key"] = key
            rv[key] = d

        return HttpResponse(json.dumps(rv), content_type="application/json")
