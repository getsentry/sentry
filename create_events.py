import sentry_sdk

# dsn = "http://8ac75874a33e4f10afaeef699f918f1a@dev.getsentry.net:8000/4"
# dsn = "http://5e171172956248e1a1d08197ea8a11cc@dev.getsentry.net:8000/10"
dsn = "https://5a6aae5d28d04d41b5964d18345cfb7a@o328908.ingest.sentry.io/1843488" # Christ test org -> python
sentry_sdk.init(dsn);

sentry_sdk.capture_message("Another error", level="error")
sentry_sdk.capture_message("ISSUE", level="error")
sentry_sdk.capture_message("meeeow", level="error")
# division_by_zero = 1 / 0;