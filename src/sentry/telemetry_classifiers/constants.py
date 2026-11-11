from datetime import timedelta

# Every result attribute is stored and written to EAP under this prefix.
RESULT_ATTRIBUTE_PREFIX = "sentry.enrichment."

# Classifier model input is cut to this many characters, keeping the newest content.
MAX_INPUT_CHARS = 32_000

SEER_TIMEOUT_SECONDS = 20

# Entities are classified once they've had no new telemetry for this long, in every dataset.
COOLDOWN = timedelta(minutes=20)
