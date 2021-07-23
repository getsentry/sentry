from datetime import timedelta

import sentry_sdk
from django.core.cache import cache
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.snuba import discover
from sentry.utils.hashlib import md5_text

MEASUREMENT_TYPES = {
    "web": [
        "measurements.fp",
        "measurements.fcp",
        "measurements.lcp",
        "measurements.fid",
        "measurements.cls",
    ],
    "mobile": [
        "measurements.app_start_cold",
        "measurements.app_start_warm",
        "measurements.frames_total",
        "measurements.frames_slow",
        "measurements.frames_frozen",
        "measurements.stall_count",
        "measurements.stall_stall_total_time",
        "measurements.stall_stall_longest_time",
    ],
}


class EventsHasMeasurementsQuerySerializer(serializers.Serializer):
    transaction = serializers.CharField(max_length=200)
    type = serializers.ChoiceField(choices=list(MEASUREMENT_TYPES.keys()))

    def validate(self, data):
        # only allow one project at a time in order to cache the results
        # for a unique transaction
        project_ids = self.context.get("params", {}).get("project_id", [])
        if len(project_ids) != 1:
            raise serializers.ValidationError("Only 1 project allowed.")
        return data


class OrganizationEventsHasMeasurementsEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        with sentry_sdk.start_span(op="discover.endpoint", description="parse params"):
            try:
                # This endpoint only allows for a single project + transaction, so no need
                # to check `global-views`.
                params = self.get_snuba_params(request, organization, check_global_views=False)

                # Once an transaction begins containing measurement data, it is unlikely
                # it will stop. So it makes more sense to always query the latest data.
                #
                # Additionally, to account for periods of low volume, increase the range
                # to 7 days to have a better chance of finding an example event and provide
                # a more consistent experience.
                now = timezone.now()
                params["start"] = now - timedelta(days=7)
                params["end"] = now
            except NoProjects:
                return Response({"measurements": False})

            data = {
                "transaction": request.GET.get("transaction"),
                "type": request.GET.get("type"),
            }

            serializer = EventsHasMeasurementsQuerySerializer(data=data, context={"params": params})
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)

        org_id = organization.id
        project_id = params["project_id"][0]
        md5_hash = md5_text(data["transaction"], data["type"]).hexdigest()

        cache_key = f"check-events-measurements:{org_id}:{project_id}:{md5_hash}"
        has_measurements = cache.get(cache_key)

        # cache miss, need to make the query again
        if has_measurements is None:
            with self.handle_query_errors():
                data = serializer.validated_data

                # generate the appropriate query for the selected type
                transaction_query = f'transaction:{data["transaction"]}'
                measurements = MEASUREMENT_TYPES[data["type"]]
                has_queries = [f"has:{measurement}" for measurement in measurements]
                measurement_query = " OR ".join(has_queries)
                query = f"{transaction_query} ({measurement_query})"

                results = discover.query(
                    selected_columns=["id"],
                    query=query,
                    params=params,
                    limit=1,  # Just want to check for existence of such an event
                    referrer="api.events.measurements",
                    auto_fields=True,
                    auto_aggregations=False,
                    use_aggregate_conditions=False,
                )
            has_measurements = len(results["data"]) > 0

            # cache the results for 5 minutes
            cache.set(cache_key, has_measurements, 300)

        return Response({"measurements": has_measurements})
