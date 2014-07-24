"""
sentry.management.commands.load_help_pages
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import os

from django.core.management.base import BaseCommand

from sentry.constants import DATA_ROOT
from sentry.db.models import create_or_update
from sentry.models import HelpPage


class Command(BaseCommand):
    help = 'Load version controlled Sentry help pages into the database.'

    def handle(self, **options):
        page_path = os.path.join(DATA_ROOT, 'help_pages')
        for filename in os.listdir(page_path):
            file_path = os.path.join(page_path, filename)
            if not os.path.isfile(file_path):
                continue

            with open(file_path) as fp:
                content = fp.read()

            options, body = self.__split_content(content)

            print('Loading help page {key}'.format(
                key=filename,
            ))

            assert 'title' in options

            page, created = create_or_update(
                HelpPage,
                key=filename,
                defaults={
                    'title': options['title'],
                    'priority': options.get('priority', 50),
                    'content': body,
                }
            )

    def __split_content(self, content):
        lines = iter(content.splitlines())

        # read file header to get basic model information
        assert lines.next() == '----'

        body = []
        header = []
        in_header = True
        for line in lines:
            if line == '----':
                in_header = False
            elif in_header:
                header.append(line)
            else:
                body.append(line)

        return dict(l.split(':') for l in header), ('\n'.join(body)).strip()
