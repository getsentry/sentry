"""
sentry.runner.commands.import_system_symbols
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import uuid
import json
import click
import zipfile
import threading
import Queue
from django.db import connection
from sentry.runner.decorators import configuration


SHUTDOWN = object()


def load_bundle(q, uuid, data, sdk_info):
    from sentry.models import DSymBundle, DSymSDK

    sdk = DSymSDK.objects.get_or_create(
        dsym_type=sdk_info['dsym_type'],
        sdk_name=sdk_info['sdk_name'],
        version_major=sdk_info['version_major'],
        version_minor=sdk_info['version_minor'],
        version_patchlevel=sdk_info['version_patchlevel'],
        version_build=sdk_info['version_build'],
    )[0]

    bundle = DSymBundle.objects.get_or_create(
        sdk=sdk,
        cpu_name=data['arch'],
        object_path=data['image'],
        uuid=str(uuid),
    )[0]

    step = 4000
    symbols = data['symbols']
    for idx in xrange(0, len(symbols) + step, step):
        end_idx = min(idx + step, len(symbols))
        yield [{
            'bundle_id': bundle.id,
            'address': symbols[x][0],
            'symbol': symbols[x][1],
        } for x in xrange(idx, end_idx)]


def process_archive(members, zip, sdk_info, threads):
    q = Queue.Queue(threads)

    def process_items():
        cur = connection.cursor()
        cur.execute('begin')
        cur.execute('''
            prepare add_sym(bigint, bigint, text) as
                insert into sentry_dsymsymbol (bundle_id, address, symbol)
                select $1, $2, $3
                where not exists (select 1 from sentry_dsymsymbol
                    where bundle_id = $1 and address = $2);
        ''')
        while 1:
            items = q.get()
            if items is SHUTDOWN:
                break
            cur.executemany('''
                execute add_sym(%(bundle_id)s, %(address)s, %(symbol)s);
            ''', items)
        cur.execute('commit')

    pool = []
    for x in xrange(threads):
        t = threading.Thread(target=process_items)
        t.setDaemon(True)
        t.start()
        pool.append(t)

    for member in members:
        try:
            id = uuid.UUID(member)
        except ValueError:
            continue
        for chunk in load_bundle(q.put, id, json.load(zip.open(member)),
                                 sdk_info):
            q.put(chunk)

    for t in pool:
        q.put(SHUTDOWN)
    for t in pool:
        t.join()


@click.command(name='import-system-symbols',
               short_help='Import system debug symbols.')
@click.argument('bundles', type=click.Path(), nargs=-1)
@click.option('--sdk', default='iOS', help='The SDK identifier')
@click.option('--dsym-type', default='macho', help='The type of the symbol')
@click.option('--threads', default=8, help='The number of threads to use')
@configuration
def import_system_symbols(bundles, sdk, dsym_type, threads):
    """Imports system symbols from preprocessed zip files into Sentry.

    It takes a list of zip files as arguments that contain preprocessed
    system symbol information.  These zip files contain JSON dumps.  The
    actual zipped up dsym files cannot be used here, they need to be
    preprocessed.
    """
    for path in bundles:
        with zipfile.ZipFile(path) as f:
            sdk_info = json.load(f.open('sdk_info'))
            sdk_info['sdk_name'] = sdk
            sdk_info['dsym_type'] = dsym_type
            label = ('%s.%s.%s (%s)' % (
                sdk_info['version_major'],
                sdk_info['version_minor'],
                sdk_info['version_patchlevel'],
                sdk_info['version_build'],
            )).ljust(18)
            with click.progressbar(f.namelist(), label=label) as bar:
                process_archive(bar, f, sdk_info, threads)
