"""
sentry.runner.commands.dsym
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import uuid
import json
import click
import six
import warnings
import threading

from sentry.runner.decorators import configuration


SHUTDOWN = object()


def load_bundle(q, uuid, data, sdk_info, trim_symbols, demangle):
    from sentry.models import DSymBundle, DSymObject, DSymSDK
    from sentry.constants import MAX_SYM
    from symsynd.demangle import demangle_symbol

    def _process_symbol(sym):
        too_long = trim_symbols and len(sym) > MAX_SYM
        if demangle or too_long:
            new_sym = demangle_symbol(sym)
            if new_sym is not None and (len(new_sym) < sym or too_long):
                sym = new_sym
        if trim_symbols:
            sym = sym[:MAX_SYM]
        return sym

    sdk = DSymSDK.objects.get_or_create(
        dsym_type=sdk_info['dsym_type'],
        sdk_name=sdk_info['sdk_name'],
        version_major=sdk_info['version_major'],
        version_minor=sdk_info['version_minor'],
        version_patchlevel=sdk_info['version_patchlevel'],
        version_build=sdk_info['version_build'],
    )[0]

    obj = DSymObject.objects.get_or_create(
        cpu_name=data['arch'],
        object_path='/' + data['image'].strip('/'),
        uuid=six.text_type(uuid),
        vmaddr=data['vmaddr'],
        vmsize=data['vmsize'],
    )[0]

    DSymBundle.objects.get_or_create(
        sdk=sdk,
        object=obj
    )[0]

    step = 4000
    symbols = data['symbols']
    for idx in range(0, len(symbols) + step, step):
        end_idx = min(idx + step, len(symbols))
        batch = []
        for x in range(idx, end_idx):
            addr = symbols[x][0]
            batch.append((obj.id, addr, _process_symbol(symbols[x][1])))
        if batch:
            yield batch


def process_archive(members, zip, sdk_info, threads=8, trim_symbols=False,
                    demangle=True):
    from sentry.models import DSymSymbol
    import Queue
    q = Queue.Queue(threads)

    def process_items():
        while 1:
            items = q.get()
            if items is SHUTDOWN:
                break
            DSymSymbol.objects.bulk_insert(items)

    pool = []
    for x in range(threads):
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
                                 sdk_info, trim_symbols, demangle):
            q.put(chunk)

    for t in pool:
        q.put(SHUTDOWN)
    for t in pool:
        t.join()


@click.group(name='dsym')
def dsym():
    """Manage system symbols in Sentry.

    This allows you to import and manage globally shared system symbols in
    the Sentry installation.  In particular this is useful for iOS where
    system symbols need to be ingested before stacktraces can be fully
    symbolized due to device optimizations.
    """


@dsym.command(name='import-system-symbols',
              short_help='Import system debug symbols.')
@click.argument('bundles', type=click.Path(), nargs=-1)
@click.option('--threads', default=8, help='The number of threads to use')
@click.option('--trim-symbols', is_flag=True,
              help='If enabled symbols are trimmed before storing. '
              'This reduces the database size but means that symbols are '
              'already trimmed on the way to the database.')
@click.option('--no-demangle', is_flag=True,
              help='If this is set to true symbols are never demangled. '
              'By default symbols are demangled if they are trimmed or '
              'demangled symbols are shorter than mangled ones. Enabling '
              'this option speeds up importing slightly.')
@configuration
def import_system_symbols(bundles, threads, trim_symbols, no_demangle):
    """Imports system symbols from preprocessed zip files into Sentry.

    It takes a list of zip files as arguments that contain preprocessed
    system symbol information.  These zip files contain JSON dumps.  The
    actual zipped up dsym files cannot be used here, they need to be
    preprocessed.
    """
    import zipfile
    from sentry.utils.db import is_mysql
    if threads != 1 and is_mysql():
        warnings.warn(Warning('disabled threading for mysql'))
        threads = 1
    for path in bundles:
        with zipfile.ZipFile(path) as f:
            sdk_info = json.load(f.open('sdk_info'))
            label = ('%s.%s.%s (%s)' % (
                sdk_info['version_major'],
                sdk_info['version_minor'],
                sdk_info['version_patchlevel'],
                sdk_info['version_build'],
            )).ljust(18)
            with click.progressbar(f.namelist(), label=label) as bar:
                process_archive(bar, f, sdk_info, threads,
                                trim_symbols=trim_symbols,
                                demangle=not no_demangle)


@dsym.command(name='sdks', short_help='List SDKs')
@click.option('--sdk', help='Only include the given SDK instead of all.')
@click.option('--version', help='Optionally a version filter.  For instance '
              '9 returns all versions 9.*, 9.1 returns 9.1.* etc.')
@configuration
def sdks(sdk, version):
    """Print a list of all installed SDKs and a breakdown of the symbols
    contained within.  This queries the system symbol database and reports
    all SDKs and versions that symbols exist for.  The output is broken down
    by minor versions, builds and cpu architectures.  For each of those a
    count of the stored bundles is returned.  (A bundle in this case is a
    single binary)
    """
    from sentry.models import DSymSDK
    last_prefix = None
    click.secho('  %-8s  %-10s  %-12s %-8s %s' % (
        'SDK',
        'Version',
        'Build',
        'CPU',
        'Bundles',
    ), fg='cyan')
    click.secho('-' * click.get_terminal_size()[0], fg='yellow')
    for sdk in DSymSDK.objects.enumerate_sdks(sdk=sdk, version=version):
        prefix = '  %-8s  %-10s  ' % (
            sdk['sdk_name'],
            sdk['version']
        )
        if prefix == last_prefix:
            prefix = ' ' * len(prefix)
        else:
            last_prefix = prefix
        click.echo('%s%-12s %-8s %d' % (
            prefix,
            sdk['build'],
            sdk['cpu_name'],
            sdk['bundle_count'],
        ))
