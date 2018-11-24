"""
sentry.management.commands.diff
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.core.management.base import BaseCommand, CommandError

import six
import sys

from click import echo
from optparse import make_option


def get_group_event(pk):
    from sentry.models import Group, Event
    event = Group.objects.get(pk=pk).get_latest_event()
    Event.objects.bind_nodes([event], 'data')
    return event


def get_event(pk):
    from sentry.models import Event
    event = Event.objects.get(pk=pk)
    Event.objects.bind_nodes([event], 'data')
    return event


def print_unified_diff(left, right):
    from difflib import unified_diff
    from sentry.event_hashing import get_grouping_behavior

    left_id = left.id
    right_id = right.id

    left = get_grouping_behavior(left)
    right = get_grouping_behavior(right)

    if left == right:
        return

    if left[0] != right[0]:
        echo('! Grouping behavior differs: %r vs %r' % (left[0], right[0]))
        return

    echo('> Same grouping behavior: %r' % left[0])

    # These should only be fingerprints at this point

    left = left[1]
    right = right[1]

    left_fingerprint = [k[0] for k in left]
    right_fingerprint = [k[0] for k in right]
    if left_fingerprint != right_fingerprint:
        echo(
            '!! Different fingerprint algorithms: %r vs %r' % (left_fingerprint, right_fingerprint)
        )
        return

    bits = left_fingerprint
    echo('> Same fingerprint algorithm: %r' % bits)

    left = [k[1] for k in left]
    right = [k[1] for k in right]
    for idx, (a, b) in enumerate(zip(left, right)):
        bit = bits[idx]
        for ((a_key, a_hashes), (b_key, b_hashes)) in zip(a, b):
            if a_key != b_key:
                echo('>> Different interfaces for %r: %r vs %r' % (bit, a_key, b_key))
                continue
            for idx, (a_hash, b_hash) in enumerate(zip(a_hashes, b_hashes)):
                a_hash = [six.text_type(h) + '\n' for h in a_hash]
                b_hash = [six.text_type(h) + '\n' for h in b_hash]
                a_file = '<Event id=%d> %r %r[%d]' % (left_id, bit, a_key, idx)
                b_file = '<Event id=%d> %r %r[%d]' % (right_id, bit, b_key, idx)
                for line in unified_diff(a_hash, b_hash, fromfile=a_file, tofile=b_file):
                    sys.stdout.write(line)


class Command(BaseCommand):
    help = 'Display a diff between two events'

    option_list = BaseCommand.option_list + (
        make_option(
            '--group',
            action='store_true',
            dest='group',
            default=False,
            help='Compare latest event by group id'
        ),
    )

    def handle(self, *args, **options):
        if len(args) != 2:
            raise CommandError('Must specify two ids to diff')

        if args[0] == args[1]:
            raise CommandError('Specify different ids')

        print_unified_diff(*map(get_group_event if options['group'] else get_event, args))
