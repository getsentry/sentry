from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import ApiError

GITLAB_HALT_MESSAGES = ["file_path should be a valid file path"]


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: ApiError) -> None:
    if error.json and error.json.get("error") in GITLAB_HALT_MESSAGES:
        lifecycle.record_halt(error)
    else:
        lifecycle.record_failure(error)
