import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.tasks.check_am2_compatibility import (
    CheckStatus,
    get_check_results,
    get_check_status,
    refresh_check_state,
    run_compatibility_check_async,
)


@region_silo_endpoint
class CheckAM2CompatibilityEndpoint(Endpoint):
    owner = ApiOwner.BILLING
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        try:
            org_id = request.GET.get("orgId")
            refresh = request.GET.get("refresh") == "true"

            if refresh:
                refresh_check_state(org_id)
            else:
                # We check the caches only if we are not refreshing.
                check_status = get_check_status(org_id)
                if check_status == CheckStatus.DONE:
                    results = get_check_results(org_id)
                    # In case the state is done, but we didn't find a valid value in cache, we have a problem.
                    if results is None:
                        raise Exception(
                            "the check status is done in cache but there are no results."
                        )

                    return Response({"status": CheckStatus.DONE.value, **results}, status=200)
                elif check_status == CheckStatus.IN_PROGRESS:
                    return Response({"status": CheckStatus.IN_PROGRESS.value}, status=202)
                elif check_status == CheckStatus.ERROR:
                    raise Exception("the asynchronous task had an internal error.")

            # In case we have no status, we will trigger the asynchronous job and return.
            run_compatibility_check_async.delay(org_id)
            return Response({"status": CheckStatus.IN_PROGRESS.value}, status=202)
        except Exception as e:
            sentry_sdk.capture_exception(e)

            return Response(
                {
                    "status": CheckStatus.ERROR.value,
                    "error": f"An error occurred while trying to check compatibility "
                    f"for AM2: {e}",
                },
                status=500,
            )
