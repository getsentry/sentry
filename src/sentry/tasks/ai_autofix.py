from datetime import datetime

from sentry.models.group import Group
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.ai_autofix_check_for_timeout",
    queue="cleanup",
    default_retry_delay=60,
    max_retries=3,
)
def ai_autofix_check_for_timeout(group_id: int, created_at: str):
    group: Group = Group.objects.get(id=group_id)
    metadata = group.data.get("metadata", {})
    autofix_data = metadata.get("autofix", {})
    # created_at is checked to make sure that the correct run is being marked as completed
    if autofix_data.get("status") == "PROCESSING" and autofix_data.get("created_at") == created_at:
        steps = autofix_data.get("steps", [])

        for step in steps:
            if step.get("status") == "PROCESSING":
                step["status"] = "ERROR"
            if step.get("status") == "PENDING":
                step["status"] = "CANCELLED"

        metadata["autofix"] = {
            **autofix_data,
            "fix": None,
            "status": "ERROR",
            "completed_at": datetime.now().isoformat(),
            "steps": steps,
        }
        group.data["metadata"] = metadata
        group.save()
