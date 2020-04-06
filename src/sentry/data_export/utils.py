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


# TODO(python3): For now, this function must be run to ensure only utf-8 is passed into the 'csv' module
# It can be removed once converted to Python 3, See https://docs.python.org/2/library/csv.html
# This function was adapted from https://stackoverflow.com/questions/13101653/python-convert-complex-dictionary-of-strings-from-unicode-to-ascii
def convert_to_utf8(input):
    if isinstance(input, dict):
        return {convert_to_utf8(key): convert_to_utf8(value) for key, value in six.iteritems(input)}
    elif isinstance(input, list):
        return [convert_to_utf8(element) for element in input]
    elif isinstance(input, six.text_type):
        return input.encode("utf-8")
    else:
        return input
