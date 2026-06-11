GITLAB_CLOUD_BASE_URL = "https://gitlab.com"
# Webhook version tracking
# Increment this when webhook configuration changes (e.g., adding new event types)
# Version 1: Added issues_events support for assignment and comment sync
# Version 2: Added note_events support for merge request comments
GITLAB_WEBHOOK_VERSION_KEY = "gitlab_webhook_version"
GITLAB_WEBHOOK_VERSION = 2
