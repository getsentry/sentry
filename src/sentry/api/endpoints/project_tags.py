from typing import int
import datetime

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options, tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.environments import get_environment_id
from sentry.api.utils import clamp_date_range, default_start_end_dates
from sentry.constants import DS_DENYLIST, PROTECTED_TAG_KEYS
from sentry.models.environment import Environment


@region_silo_endpoint
class ProjectTagsEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project) -> Response:
        try:
            environment_id = get_environment_id(request, project.organization_id)
        except Environment.DoesNotExist:
            tag_keys = []
        else:
            kwargs: dict = {}
            if request.GET.get("onlySamplingTags") == "1":
                kwargs["denylist"] = DS_DENYLIST

            # Flags are stored on the same table as tags but on a different column. Ideally both
            # could be queried in a single request. But at present we're not sure if we want to
            # treat tags and flags as the same or different and in which context.
            use_flag_backend = request.GET.get("useFlagsBackend") == "1"
            if use_flag_backend:
                backend = tagstore.flag_backend
            else:
                backend = tagstore.backend

            include_values_seen = request.GET.get("includeValuesSeen") != "0"

            if features.has("organizations:tag-key-sample-n", project.organization):
                # Tag queries longer than 14 days tend to time out for large customers. For getting a list of tags, clamping to 14 days is a reasonable compromise of speed vs. completeness
                (start, end) = clamp_date_range(
                    default_start_end_dates(),
                    datetime.timedelta(days=options.get("visibility.tag-key-max-date-range.days")),
                )
                kwargs["start"] = start
                kwargs["end"] = end

            tag_keys = sorted(
                backend.get_tag_keys(
                    project.id,
                    environment_id,
                    tenant_ids={"organization_id": project.organization_id},
                    # We might be able to stop including these values, but this
                    # is a pretty old endpoint, so concerned about breaking
                    # existing api consumers.
                    include_values_seen=include_values_seen,
                    **kwargs,
                ),
                key=lambda x: x.key,
            )

        data = []
        for tag_key in tag_keys:
            data.append(
                {
                    "key": tagstore.backend.get_standardized_key(tag_key.key),
                    "name": tagstore.backend.get_tag_key_label(tag_key.key),
                    **({"uniqueValues": tag_key.values_seen} if include_values_seen else {}),
                    "canDelete": tag_key.key not in PROTECTED_TAG_KEYS and not use_flag_backend,
                }
            )

        return Response(data)
