from __future__ import absolute_import, print_function

import json

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Generates additional entry points and module paths for Webpack'

    def handle(self, **options):
        self.stdout.write(json.dumps({
            "entry": {},
            "paths": [],
        }))
