"""
sentry.models.dsymfile
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import os
import shutil
import tempfile
from django.db import models, transaction, IntegrityError

from symsynd.mach import get_macho_uuids

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.models.file import File
from sentry.utils.zip import safe_extract_zip


KNOWN_DSYM_TYPES = {
    'application/x-mach-binary': 'macho'
}


class DSymFile(Model):
    """
    A single dsym file that is associated with a project.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    file = FlexibleForeignKey('sentry.File')
    uuid = models.CharField(max_length=36)
    object_name = models.TextField()
    cpu_name = models.CharField(max_length=40)

    __repr__ = sane_repr('object_name', 'cpu_name', 'uuid')

    class Meta:
        unique_together = (('project', 'uuid'),)
        app_label = 'sentry'
        db_table = 'sentry_dsymfile'

    @property
    def dsym_type(self):
        ct = self.file.headers.get('Content-Type').lower()
        return KNOWN_DSYM_TYPES.get(ct, 'unknown')

    @classmethod
    def create_macho_dsym_from_uuid(cls, project, cpu_name, uuid, fileobj,
                                    object_name):
        """This creates a mach dsym file from the given uuid and open file
        object to a dsym file.  This will not verify the uuid.  Use
        `create_files_from_macho_zip` for doing everything.
        """
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
                return DSymFile.objects.create(
                    project=project,
                    file=file,
                    uuid=uuid,
                    cpu_name=cpu_name,
                    object_name=object_name,
                )
        except IntegrityError:
            file.delete()
            return DSymFile.objects.get(
                project=project,
                uuid=uuid,
            )

    @classmethod
    def create_files_from_macho_zip(cls, project, fileobj):
        """Creates all missing dsym files from the given zip file.  This
        returns a list of all `DSymFiles` created.
        """
        scratchpad = tempfile.mkdtemp()
        try:
            safe_extract_zip(fileobj, scratchpad)
            to_create = []

            # If we're dealing with a resource bundle, use the DWARF
            # folder otherwise assume people just dumped binaries directly
            # into the thing.
            path = os.path.join(scratchpad, 'Contents/Resources/DWARF')
            if not os.path.isdir(path):
                path = scratchpad

            for fn in os.listdir(path):
                try:
                    uuids = get_macho_uuids(os.path.join(path, fn))
                except (IOError, ValueError):
                    # Whatever was contained there, was probably not a
                    # macho file.
                    continue
                for cpu, uuid in uuids:
                    to_create.append((cpu, uuid, os.path.join(path, fn)))

            rv = []
            for cpu, uuid, filename in to_create:
                with open(filename, 'rb') as f:
                    rv.append((DSymFile.create_macho_dsym_from_uuid(
                        project, cpu, uuid, f, os.path.basename(filename))))
            return rv
        finally:
            shutil.rmtree(scratchpad)
