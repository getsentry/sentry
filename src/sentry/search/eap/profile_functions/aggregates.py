from sentry.search.eap.ourlogs.aggregates import LOG_AGGREGATE_DEFINITIONS

# For now, profile functions uses the same aggregates as logs
# This can be extended in the future with trace metrics specific aggregates
PROFILE_FUNCTIONS_AGGREGATE_DEFINITIONS = LOG_AGGREGATE_DEFINITIONS
