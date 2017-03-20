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

from django.db import models, transaction, IntegrityError

from symsynd.macho.arch import get_macho_uuids

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.models.file import File
from sentry.utils.zip import safe_extract_zip
from sentry.constants import KNOWN_DSYM_TYPES
from sentry.reprocessing import resolve_processing_issue


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

    class Meta(CommonDSymFile.Meta):
        unique_together = (('project', 'uuid'),)
        db_table = 'sentry_projectdsymfile'


def _create_macho_dsym_from_uuid(project, cpu_name, uuid, fileobj,
                                 object_name):
    """This creates a mach dsym file from the given uuid and open file
    object to a dsym file.  This will not verify the uuid.  Use
    `create_files_from_macho_zip` for doing everything.
    """
    extra = {}
    cls = ProjectDSymFile
    extra['project'] = project

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
        type='project.dsym',
        headers={
            'Content-Type': 'application/x-mach-binary'
        },
    )
    file.putfile(fileobj)
    try:
        with transaction.atomic():
            rv = cls.objects.create(
                file=file,
                uuid=uuid,
                cpu_name=cpu_name,
                object_name=object_name,
                **extra
            )
    except IntegrityError:
        file.delete()
        rv = cls.objects.get(uuid=uuid, **extra)

    resolve_processing_issue(
        project=project,
        scope='native',
        object='dsym:%s' % uuid,
    )

    return rv


def create_files_from_macho_zip(fileobj, project=None):
    """Creates all missing dsym files from the given zip file.  This
    returns a list of all files created.
    """
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
    """Finds a dsym file for the given uuid."""
    image_uuid = image_uuid.lower()
    try:
        return ProjectDSymFile.objects.filter(
            uuid=image_uuid,
            project=project
        ).select_related('file').get()
    except ProjectDSymFile.DoesNotExist:
        pass


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

    return list(missing)
