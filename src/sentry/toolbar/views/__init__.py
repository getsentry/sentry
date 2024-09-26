# When the CSP header is enforced in prod, we need to append these sources to the script-src directive.
# This allows toolbar users to run the inline scripts in our response templates.
# See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
TOOLBAR_CSP_SCRIPT_SRC = ["'unsafe-inline'", "sentry.io", "*.sentry.io"]
