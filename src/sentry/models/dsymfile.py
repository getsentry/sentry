"""
sentry.models.dsymfile
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import os
import shutil
import hashlib
import tempfile
from itertools import chain
from django.db import models, router, transaction, connection, IntegrityError

try:
    from symsynd.macho.arch import get_macho_uuids
    have_symsynd = True
except ImportError:
    have_symsynd = False

from sentry.db.models import FlexibleForeignKey, Model, BoundedBigIntegerField, \
    sane_repr, BaseManager
from sentry.models.file import File
from sentry.utils.zip import safe_extract_zip
from sentry.utils.db import is_sqlite


MAX_SYM = 256
KNOWN_DSYM_TYPES = {
    'application/x-mach-binary': 'macho'
}

SDK_MAPPING = {
    'iPhone OS': 'iOS',
    'tvOS': 'tvOS',
    'Mac OS': 'macOS',
}


def get_sdk_from_system_info(info):
    if not info:
        return None
    try:
        sdk_name = SDK_MAPPING[info['system_name']]
        system_version = tuple(int(x) for x in (
            info['system_version'] + '.0' * 3).split('.')[:3])
    except LookupError:
        return None

    return {
        'dsym_type': 'macho',
        'sdk_name': sdk_name,
        'version_major': system_version[0],
        'version_minor': system_version[1],
        'version_patchlevel': system_version[2],
    }


class DSymSDKManager(BaseManager):

    def enumerate_sdks(self, sdk=None, version=None):
        """Return a grouped list of SDKs."""
        filter = ''
        args = []
        if version is not None:
            for col, val in zip(['major', 'minor', 'patchlevel'],
                                version.split('.')):
                if not val.isdigit():
                    return []
                filter += ' and k.version_%s = %d' % (
                    col,
                    int(val)
                )
        if sdk is not None:
            filter += ' and k.sdk_name = %s'
            args.append(sdk)
        cur = connection.cursor()
        cur.execute('''
   select distinct k.*, count(b.*) as bundle_count, o.cpu_name
              from sentry_dsymsdk k,
                   sentry_dsymbundle b,
                   sentry_dsymobject o
             where b.sdk_id = k.id and
                   b.object_id = o.id %s
          group by k.id, k.sdk_name, o.cpu_name
        ''' % filter, args)
        rv = []
        for row in cur.fetchall():
            row = dict(zip([x[0] for x in cur.description], row))
            ver = '%s.%s.%s' % (
                row['version_major'],
                row['version_minor'],
                row['version_patchlevel']
            )
            rv.append({
                'sdk_name': row['sdk_name'],
                'version': ver,
                'build': row['version_build'],
                'bundle_count': row['bundle_count'],
                'cpu_name': row['cpu_name'],
            })
        return sorted(rv, key=lambda x: (x['sdk_name'],
                                         x['version'],
                                         x['build'],
                                         x['cpu_name']))


class DSymSDK(Model):
    __core__ = False
    dsym_type = models.CharField(max_length=20, db_index=True)
    sdk_name = models.CharField(max_length=20)
    version_major = models.IntegerField()
    version_minor = models.IntegerField()
    version_patchlevel = models.IntegerField()
    version_build = models.CharField(max_length=40)

    objects = DSymSDKManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_dsymsdk'
        index_together = [
            ('version_major', 'version_minor', 'version_patchlevel',
             'version_build'),
        ]


class DSymObject(Model):
    __core__ = False
    cpu_name = models.CharField(max_length=40)
    object_path = models.TextField(db_index=True)
    uuid = models.CharField(max_length=36, db_index=True)
    vmaddr = BoundedBigIntegerField(null=True)
    vmsize = BoundedBigIntegerField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_dsymobject'


class DSymBundle(Model):
    __core__ = False
    sdk = FlexibleForeignKey('sentry.DSymSDK')
    object = FlexibleForeignKey('sentry.DSymObject')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_dsymbundle'


class DSymSymbolManager(BaseManager):

    def bulk_insert(self, items):
        db = router.db_for_write(DSymSymbol)
        items = list(items)
        if not items:
            return

        # On SQLite we don't do this.  Two reasons: one, it does not
        # seem significantly faster and you're an idiot if you import
        # huge amounts of system symbols into sqlite anyways.  secondly
        # because of the low parameter limit
        if not is_sqlite():
            try:
                with transaction.atomic(using=db):
                    cur = connection.cursor()
                    cur.execute('''
                        insert into sentry_dsymsymbol
                            (object_id, address, symbol)
                             values %s
                    ''' % ', '.join(['(%s, %s, %s)'] * len(items)),
                        list(chain(*items)))
                    cur.close()
                return
            except IntegrityError:
                pass

        cur = connection.cursor()
        for item in items:
            cur.execute('''
                insert into sentry_dsymsymbol
                    (object_id, address, symbol)
                select
                    %(object_id)s, %(address)s, %(symbol)s
                where not exists (
                    select 1 from sentry_dsymsymbol
                       where object_id = %(object_id)s
                         and address = %(address)s);
            ''', {
                'object_id': item[0],
                'address': item[1],
                'symbol': item[2],
            })
        cur.close()

    def lookup_symbol(self, instruction_addr, image_addr, uuid,
                      cpu_name=None, object_path=None, system_info=None):
        """Finds a system symbol."""
        addr = instruction_addr - image_addr

        uuid = str(uuid).lower()
        cur = connection.cursor()
        try:
            # First try: exact match on uuid
            cur.execute('''
                select s.symbol
                  from sentry_dsymsymbol s,
                       sentry_dsymobject o
                 where o.uuid = %s and
                       s.object_id = o.id and
                       s.address <= o.vmaddr + %s and
                       s.address >= o.vmaddr
              order by address desc
                 limit 1;
            ''', [uuid, addr])
            rv = cur.fetchone()
            if rv:
                return rv[0]

            # Second try: exact match on path and arch
            sdk_info = get_sdk_from_system_info(system_info)
            if sdk_info is None or \
               cpu_name is None or \
               object_path is None:
                return

            cur.execute('''
                select s.symbol
                  from sentry_dsymsymbol s,
                       sentry_dsymobject o,
                       sentry_dsymsdk k,
                       sentry_dsymbundle b
                 where b.sdk_id = k.id and
                       b.object_id = o.id and
                       s.object_id = o.id and
                       k.sdk_name = %s and
                       k.dsym_type = %s and
                       k.version_major = %s and
                       k.version_minor = %s and
                       k.version_patchlevel = %s and
                       o.cpu_name = %s and
                       o.object_path = %s and
                       s.address <= o.vmaddr + %s and
                       s.address >= o.vmaddr
              order by address desc
                 limit 1;
            ''', [sdk_info['sdk_name'], sdk_info['dsym_type'],
                  sdk_info['version_major'], sdk_info['version_minor'],
                  sdk_info['version_patchlevel'], cpu_name, object_path, addr])
            rv = cur.fetchone()
            if rv:
                return rv[0]
        finally:
            cur.close()


class DSymSymbol(Model):
    __core__ = False
    object = FlexibleForeignKey('sentry.DSymObject')
    address = BoundedBigIntegerField(db_index=True)
    symbol = models.TextField()

    objects = DSymSymbolManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_dsymsymbol'
        unique_together = [
            ('object', 'address'),
        ]


class CommonDSymFile(Model):
    """
    A single dsym file that is associated with a project.
    """
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    object_name = models.TextField()
    cpu_name = models.CharField(max_length=40)

    __repr__ = sane_repr('object_name', 'cpu_name', 'uuid')

    class Meta:
        abstract = True
        app_label = 'sentry'

    @property
    def dsym_type(self):
        ct = self.file.headers.get('Content-Type').lower()
        return KNOWN_DSYM_TYPES.get(ct, 'unknown')


class ProjectDSymFile(CommonDSymFile):
    project = FlexibleForeignKey('sentry.Project', null=True)
    uuid = models.CharField(max_length=36)
    is_global = False

    class Meta(CommonDSymFile.Meta):
        unique_together = (('project', 'uuid'),)
        db_table = 'sentry_projectdsymfile'


class GlobalDSymFile(CommonDSymFile):
    uuid = models.CharField(max_length=36, unique=True)
    is_global = True

    class Meta(CommonDSymFile.Meta):
        db_table = 'sentry_globaldsymfile'


def _create_macho_dsym_from_uuid(project, cpu_name, uuid, fileobj,
                                 object_name):
    """This creates a mach dsym file from the given uuid and open file
    object to a dsym file.  This will not verify the uuid.  Use
    `create_files_from_macho_zip` for doing everything.
    """
    extra = {}
    if project is None:
        cls = GlobalDSymFile
        file_type = 'global.dsym'
    else:
        cls = ProjectDSymFile
        extra['project'] = project
        file_type = 'project.dsym'

    h = hashlib.sha1()
    while 1:
        chunk = fileobj.read(16384)
        if not chunk:
            break
        h.update(chunk)
    checksum = h.hexdigest()
    fileobj.seek(0, 0)

    try:
        rv = cls.objects.get(uuid=uuid, **extra)
        if rv.file.checksum == checksum:
            return rv
    except cls.DoesNotExist:
        pass
    else:
        # The checksum mismatches.  In this case we delete the old object
        # and perform a re-upload.
        rv.delete()

    file = File.objects.create(
        name=uuid,
        type=file_type,
        headers={
            'Content-Type': 'application/x-mach-binary'
        },
    )
    file.putfile(fileobj)
    try:
        with transaction.atomic():
            return cls.objects.create(
                file=file,
                uuid=uuid,
                cpu_name=cpu_name,
                object_name=object_name,
                **extra
            )
    except IntegrityError:
        file.delete()
        return cls.objects.get(uuid=uuid, **extra)


def create_files_from_macho_zip(fileobj, project=None):
    """Creates all missing dsym files from the given zip file.  This
    returns a list of all files created.
    """
    if not have_symsynd:
        raise RuntimeError('symsynd is unavailable.  Install sentry with '
                           'the dsym feature flag.')
    scratchpad = tempfile.mkdtemp()
    try:
        safe_extract_zip(fileobj, scratchpad)
        to_create = []

        for dirpath, dirnames, filenames in os.walk(scratchpad):
            for fn in filenames:
                fn = os.path.join(dirpath, fn)
                try:
                    uuids = get_macho_uuids(fn)
                except (IOError, ValueError):
                    # Whatever was contained there, was probably not a
                    # macho file.
                    continue
                for cpu, uuid in uuids:
                    to_create.append((cpu, uuid, fn))

        rv = []
        for cpu, uuid, filename in to_create:
            with open(filename, 'rb') as f:
                rv.append((_create_macho_dsym_from_uuid(
                    project, cpu, uuid, f, os.path.basename(filename))))
        return rv
    finally:
        shutil.rmtree(scratchpad)


def find_dsym_file(project, image_uuid):
    """Finds a dsym file for the given uuid.  Looks both within the project
    as well the global store.
    """
    image_uuid = image_uuid.lower()
    try:
        return ProjectDSymFile.objects.filter(
            uuid=image_uuid,
            project=project
        ).select_related('file').get()
    except ProjectDSymFile.DoesNotExist:
        pass
    try:
        return GlobalDSymFile.objects.filter(
            uuid=image_uuid
        ).select_related('file').get()
    except GlobalDSymFile.DoesNotExist:
        return None


def find_missing_dsym_files(checksums, project=None):
    checksums = [x.lower() for x in checksums]
    missing = set(checksums)

    if project is not None:
        found = ProjectDSymFile.objects.filter(
            file__checksum__in=checksums,
            project=project
        ).values('file__checksum')

        for values in found:
            missing.discard(values.values()[0])

        if not missing:
            return []

    found = GlobalDSymFile.objects.filter(
        file__checksum__in=list(missing),
    ).values('file__checksum')

    for values in found:
        missing.discard(values.values()[0])

    return list(missing)
