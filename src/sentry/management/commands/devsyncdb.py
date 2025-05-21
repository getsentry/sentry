from typing import Any

from django.conf import settings
from django.core.management.commands import migrate


class Command(migrate.Command):
    help = "Create db skipping migrations"

    def handle(self, *args: Any, **options: Any) -> str | None:
        class DisableMigrations:
            def __contains__(self, item: str) -> bool:
                return True

            def __getitem__(self, item: str) -> None:
                return None

        orig = settings.MIGRATION_MODULES
        settings.MIGRATION_MODULES = DisableMigrations()

        options["run_syncdb"] = True

        try:
            return super().handle(*args, **options)
        finally:
            settings.MIGRATION_MODULES = orig
