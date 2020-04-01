from __future__ import absolute_import

import six
from contextlib import contextmanager

from sentry.utils import metrics, snuba
from sentry.utils.sdk import capture_exception

from .base import ExportError


# Adapted into contextmanager from 'src/sentry/api/endpoints/organization_events.py'
@contextmanager
def snuba_error_handler(logger):
    try:
        yield
    except snuba.QueryOutsideRetentionError as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        raise ExportError("Invalid date range. Please try a more recent date range.")
    except snuba.QueryIllegalTypeOfArgument as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        raise ExportError("Invalid query. Argument to function is wrong type.")
    except snuba.SnubaError as error:
        metrics.incr("dataexport.error", tags={"error": six.text_type(error)}, sample_rate=1.0)
        logger.info("dataexport.error: {}".format(six.text_type(error)))
        capture_exception(error)
        message = "Internal error. Please try again."
        if isinstance(
            error,
            (
                snuba.RateLimitExceeded,
                snuba.QueryMemoryLimitExceeded,
                snuba.QueryTooManySimultaneous,
            ),
        ):
            message = "Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects."
        elif isinstance(
            error,
            (snuba.UnqualifiedQueryError, snuba.QueryExecutionError, snuba.SchemaValidationError),
        ):
            message = "Internal error. Your query failed to run."
        raise ExportError(message)
