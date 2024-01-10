from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.ingest import inbound_filters

# from sentry.models import ProjectOption


@region_silo_endpoint
class ProjectFiltersEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project) -> Response:
        """
        List a project's filters

        Retrieve a list of filters for a given project.

            {method} {path}

        """

        # Test migration

        # filter = ProjectOption.objects.filter(project=project, key="filters:legacy-browsers")
        # filter_replacement_map = {
        #     "android_pre_4": "android",
        #     "ie_pre_9": "ie",
        #     "ie9": "ie",
        #     "ie10": "ie",
        #     "ie11": "ie",
        #     "opera_pre_15": "opera",
        #     "safari_pre_6": "safari",
        #     "opera_mini_pre_8": "opera-mini",
        #     "edge_pre_79": "edge",
        # }

        # subfilters = filter.first().value

        # for idx, subfilter in enumerate(subfilters):
        #     if subfilter in filter_replacement_map:
        #         subfilters[idx] = filter_replacement_map[subfilter]

        # filter.update(value=list(set(subfilters)))

        results = []
        for flt in inbound_filters.get_all_filter_specs():
            results.append(
                {
                    "id": flt.id,
                    # 'active' will be either a boolean or list for the legacy browser filters
                    # all other filters will be boolean
                    "active": inbound_filters.get_filter_state(flt.id, project),
                }
            )
        results.sort(key=lambda x: x["id"])
        return Response(results)
