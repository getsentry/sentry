from sentry.search.eap.spans.aggregates import LOG_AGGREGATE_DEFINITIONS

# For now, trace metrics uses the same aggregates as logs
# This can be extended in the future with trace metrics specific aggregates
TRACEMETRICS_AGGREGATE_DEFINITIONS = LOG_AGGREGATE_DEFINITIONS
