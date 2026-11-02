from __future__ import annotations

import orjson
from django.core.management.base import BaseCommand

from sentry.api.endpoint_owners import build_owner_map


class Command(BaseCommand):
    help = "Write which team owns each API endpoint, as JSON"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            dest="output",
            action="store",
            default=None,
            help="The file to write the owners map to. Prints to stdout when left out.",
        )

    def handle(self, **options):
        curr_map = build_owner_map()

        # {path: {class_name: owner}}
        owner_map: dict[str, dict[str, str]] = {}
        for row in curr_map:
            if row.path not in owner_map:
                owner_map[row.path] = {}
            owner_map[row.path][row.class_name] = row.owner

        contents = (
            orjson.dumps(owner_map, option=orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS).decode()
            + "\n"
        )

        if not options["output"]:
            self.stdout.write(contents)
        else:
            with open(options["output"], "w") as fh:
                fh.write(contents)
            self.stdout.write(f"Wrote {len(curr_map)} endpoints to {options['output']}")
