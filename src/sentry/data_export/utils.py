from functools import wraps

from sentry.snuba import discover
from sentry.utils import metrics, snuba
from sentry.utils.sdk import capture_exception

from .base import ExportError


# Adapted into decorator from 'src/sentry/api/endpoints/organization_events.py'
def handle_snuba_errors(logger):
    def wrapper(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except discover.InvalidSearchQuery as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warn("dataexport.error: %s", str(error))
                capture_exception(error)
                raise ExportError("Invalid query. Please fix the query and try again.")
            except snuba.QueryOutsideRetentionError as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warn("dataexport.error: %s", str(error))
                capture_exception(error)
                raise ExportError("Invalid date range. Please try a more recent date range.")
            except snuba.QueryIllegalTypeOfArgument as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warn("dataexport.error: %s", str(error))
                capture_exception(error)
                raise ExportError("Invalid query. Argument to function is wrong type.")
            except snuba.SnubaError as error:
                metrics.incr("dataexport.error", tags={"error": str(error)}, sample_rate=1.0)
                logger.warn("dataexport.error: %s", str(error))
                capture_exception(error)
                message = "Internal error. Please try again."
                recoverable = False
                if isinstance(
                    error,
                    (
                        snuba.RateLimitExceeded,
                        snuba.QueryMemoryLimitExceeded,
                        snuba.QueryExecutionTimeMaximum,
                        snuba.QueryTooManySimultaneous,
                    ),
                ):
                    message = "Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects."
                    recoverable = True
                elif isinstance(
                    error,
                    (
                        snuba.DatasetSelectionError,
                        snuba.QueryConnectionFailed,
                        snuba.QuerySizeExceeded,
                        snuba.QueryExecutionError,
                        snuba.SchemaValidationError,
                        snuba.UnqualifiedQueryError,
                    ),
                ):
                    message = "Internal error. Your query failed to run."
                raise ExportError(message, recoverable=recoverable)

        return wrapped

    return wrapper
