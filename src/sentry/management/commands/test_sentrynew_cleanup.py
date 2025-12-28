import logging

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Test the SentryNew cleanup task"

    def handle(self, *args, **options):
        self.stdout.write("=" * 70)
        self.stdout.write("Testing SentryNew Cleanup Task")
        self.stdout.write("=" * 70)

        # Check configuration
        self.stdout.write("\n1. Configuration:")
        configs = [
            "SENTRYNEW_CLEANUP_ENABLED",
            "SENTRYNEW_SOFT_DELETE",
            "SENTRYNEW_CLEANUP_AFTER_HOURS",
            "SENTRYNEW_CLEANUP_BATCH_SIZE",
        ]
        for config in configs:
            value = getattr(settings, config, None)
            self.stdout.write(f"  {config} = {value}")

        # Check if task can be imported
        self.stdout.write("\n2. Importing task...")
        try:
            from sentry.tasks.sentrynew_cleanup import cleanup_expired_sentrynew_organizations

            self.stdout.write(f"  ✓ Task imported: {cleanup_expired_sentrynew_organizations.name}")
        except ImportError as e:
            self.stdout.write(f"  ✗ Failed to import: {e}")
            return

        # Check Celery beat schedule
        self.stdout.write("\n3. Celery beat schedule:")
        schedule = getattr(settings, "CELERYBEAT_SCHEDULE", {})
        if "cleanup-sentrynew-organizations" in schedule:
            task_config = schedule["cleanup-sentrynew-organizations"]
            self.stdout.write(f"  ✓ Found in schedule")
            self.stdout.write(f"    Task: {task_config.get('task')}")
            self.stdout.write(f"    Schedule: {task_config.get('schedule')}")
        else:
            self.stdout.write(f"  ✗ Not found in CELERYBEAT_SCHEDULE")
            self.stdout.write(f"    Available: {list(schedule.keys())[:5]}")

        # Try to run the task directly
        self.stdout.write("\n4. Running task directly (not via Celery)...")
        try:
            result = cleanup_expired_sentrynew_organizations()
            self.stdout.write(f"  ✓ Task executed successfully")
            self.stdout.write(f"    Result: {result}")
        except Exception as e:
            self.stdout.write(f"  ✗ Task failed: {e}")
            import traceback

            self.stdout.write(traceback.format_exc())

        # Show how to trigger via Celery
        self.stdout.write("\n5. To trigger via Celery:")
        self.stdout.write(
            "  from sentry.tasks.sentrynew_cleanup import cleanup_expired_sentrynew_organizations"
        )
        self.stdout.write("  cleanup_expired_sentrynew_organizations.delay()")
        self.stdout.write("  # or")
        self.stdout.write("  cleanup_expired_sentrynew_organizations.apply_async()")
