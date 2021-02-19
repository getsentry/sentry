import logging


from django.core.cache import cache
from datetime import timedelta
from django.utils import timezone

from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.snuba import discover

# one day cache
CACHE_TTL = 24 * 60 * 60


logger = logging.getLogger(__name__)


class OrganizationCheckHasMobileAppEvents(OrganizationEventsEndpointBase):
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
            result = discover.query(
                query=query,
                selected_columns=["browser.name", "project", "id", "client_os_name"],
                limit=1,
                params={
                    "start": timezone.now() - timedelta(days=1),
                    "end": timezone.now(),
                    "organization_id": organization.id,
                    "project_id": [p.id for p in projects],
                },
                referrer="api.organization-check-has-mobile-app-events",
            )
            data = result["data"]

            response = None
            if data:
                one_result = data[0]
                # log the info so we can debug this later
                logging_params = {
                    "organization_id": organization.id,
                    "organization_slug": organization.slug,
                }
                logging_params.update(**one_result)
                logger.info("result_found", extra=logging_params)
                # only send back browserName and clientOsName for now
                response = {
                    "browserName": one_result["browser.name"],
                    "clientOsName": one_result["client_os_name"],
                }
            # TODO: add discover query for null browser and client_os_name is android or ios

        return response
