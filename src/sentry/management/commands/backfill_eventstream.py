from __future__ import absolute_import, print_function

import six

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Backfill events from the database into the event stream."

    def add_arguments(self, parser):
        parser.add_argument(
            "--from-ts",
            dest="from_ts",
            type=six.text_type,
            help="Starting event timestamp (ISO 8601). Example: 2018-11-26T23:59:59",
        ),
        parser.add_argument(
            "--to-ts", dest="to_ts", type=six.text_type, help="Last event timestamp (ISO 8601)."
        ),
        parser.add_argument(
            "--last-days", dest="last_days", type=int, help="Events in the last X days"
        )
        parser.add_argument(
            "--from-id", dest="from_id", type=int, help="Starting event ID (primary key)."
        ),
        parser.add_argument("--to-id", dest="to_id", type=int, help="Last event ID (primary key)."),
        parser.add_argument(
            "--no-input", action="store_true", dest="no_input", help="Do not ask questions."
        )

    def handle(
        self,
        from_ts=None,
        to_ts=None,
        last_days=None,
        from_id=None,
        to_id=None,
        no_input=False,
        **options
    ):
        """
        Remove this script once no longer referenced in https://github.com/getsentry/onpremise
        """
        pass
