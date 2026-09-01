from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from sentry.tasks.seer.rerun_autofix_rca import rerun_autofix_rca_batch


def read_run_ids(path: Path) -> list[int]:
    try:
        file = path.open(newline="")
    except OSError as error:
        raise CommandError(f"Could not read input CSV {path}: {error}") from error

    with file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None or "run_id" not in reader.fieldnames:
            raise CommandError("Input CSV must contain a run_id column")

        run_ids: list[int] = []
        seen_run_ids: set[int] = set()
        for row_number, row in enumerate(reader, start=2):
            value = row.get("run_id")
            try:
                run_id = int(value) if value else None
            except ValueError as error:
                raise CommandError(f"Row {row_number}: run_id must be an integer") from error
            if run_id is None:
                raise CommandError(f"Row {row_number}: run_id is required")
            if run_id not in seen_run_ids:
                seen_run_ids.add(run_id)
                run_ids.append(run_id)
        return run_ids


class Command(BaseCommand):
    help = "Queue a resumable taskworker backfill for Autofix RCA incident replays."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--input", required=True, help="CSV containing a run_id column")
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Queue the backfill. Without this flag, validate the input only.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        run_ids = read_run_ids(Path(options["input"]))
        if not options["execute"]:
            self.stdout.write(f"Validated {len(run_ids)} unique run(s); no task was queued.")
            return

        rerun_autofix_rca_batch.delay(run_ids)
        self.stdout.write(f"Queued Autofix RCA replay backfill for {len(run_ids)} unique run(s).")
