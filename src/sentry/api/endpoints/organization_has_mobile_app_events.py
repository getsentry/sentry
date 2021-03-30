import logging
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.snuba import discover

# one day cache
CACHE_TTL = 24 * 60 * 60


logger = logging.getLogger(__name__)


class OrganizationHasMobileAppEvents(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        # cache is unique to an org
        cache_key = f"check_mobile_app_events:{organization.id}"
        cache_value = cache.get(cache_key)
        # cache miss, lookup and store value
        if cache_value is None:
            result = self._get(request, organization)
            # store results in an object since we don't result=None to be a cache miss
            cache_value = {"result": result}
            cache.set(cache_key, cache_value, CACHE_TTL)

        return self.respond(cache_value["result"])

    # find a match not using the cache
    def _get(self, request, organization):
        project_ids = self.get_requested_project_ids(request)
        projects = self.get_projects(request, organization, project_ids)
        if len(projects) == 0:
            return None

        browser_name_list = request.GET.getlist("userAgents")
        query = " OR ".join(map(lambda x: f"browser.name:{x}", browser_name_list))

        with self.handle_query_errors():
            # TODO: update discover query for null browser and client_os_name is android or ios
            result = discover.query(
                query=query,
                orderby="-timestamp",
                selected_columns=["browser.name", "client_os.name", "timestamp"],
                limit=1,
                params={
                    "start": timezone.now() - timedelta(days=1),
                    "end": timezone.now(),
                    "organization_id": organization.id,
                    "project_id": [p.id for p in projects],
                },
                referrer="api.organization-has-mobile-app-events",
            )
            data = result["data"]
            if not data:
                return None

            one_result = data[0]
            # only send back browserName and clientOsName for now
            return {
                "browserName": one_result["browser.name"],
                "clientOsName": one_result["client_os.name"],
            }
