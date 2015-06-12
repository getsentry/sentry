from __future__ import absolute_import, print_function

import sys

from django.core import serializers
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Imports data from a Sentry export.'

    def handle(self, src=None, **options):
        if not src:
            sys.stderr.write('Usage: sentry import [src]')
            sys.exit(1)

        if src == '-':
            src = sys.stdin
        else:
            src = open(src, 'rb')

        for obj in serializers.deserialize("json", src, stream=True, use_natural_keys=True):
            obj.save()
