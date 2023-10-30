import sentry_sdk
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.utils.snuba import (
    DatasetSelectionError,
    QueryConnectionFailed,
    QueryExecutionTimeMaximum,
    QueryIllegalTypeOfArgument,
    QueryMemoryLimitExceeded,
    QueryMissingColumn,
    QuerySizeExceeded,
    QueryTooManySimultaneous,
)

ENGINEER_ERROR = "An internal error occurred. The error has been logged."
RESOURCE_LIMIT = "Query limits exceeded. Try narrowing your request."


class BaseReplaysOrganizationEndpoint(OrganizationEndpoint):
    def paginate(self, *args, **kwargs):
        try:
            return super().paginate(*args, **kwargs)
        except DatasetSelectionError as exc:
            return respond_logged(ENGINEER_ERROR, exc, status=500)
        except QueryConnectionFailed as exc:
            return respond_logged("Server unavailable. Please try again.", exc, status=400)
        except QueryExecutionTimeMaximum as exc:
            return respond_logged(RESOURCE_LIMIT, exc, status=400)
        except QueryIllegalTypeOfArgument as exc:
            return respond_logged(ENGINEER_ERROR, exc, status=500)
        except QueryMemoryLimitExceeded as exc:
            return respond_logged(RESOURCE_LIMIT, exc, status=400)
        except QueryMissingColumn as exc:
            return respond_logged(ENGINEER_ERROR, exc, status=500)
        except QuerySizeExceeded as exc:
            return respond_logged(ENGINEER_ERROR, exc, status=500)
        except QueryTooManySimultaneous as exc:
            return respond_logged("Server overloaded. Please try again.", exc, status=400)


def respond_logged(message: str, exc: Exception, status: int) -> Response:
    sentry_sdk.capture_exception(exc)
    return Response({"detail": message}, status=status)
