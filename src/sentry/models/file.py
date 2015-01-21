"""
sentry.models.file
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from django.core.files.storage import get_storage_class
from django.db import models
from django.utils import timezone
from hashlib import md5
from uuid import uuid4

from sentry.db.models import (
    BoundedPositiveIntegerField, GzippedDictField, Model
)

ONE_DAY = 60 * 60 * 24


class File(Model):
    name = models.CharField(max_length=128)
    storage = models.CharField(max_length=128, null=True)
    storage_options = GzippedDictField()
    path = models.TextField(null=True)
    type = models.CharField(max_length=64)
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=32, null=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        unique_together = (('name', 'checksum'),)
        app_label = 'sentry'
        db_table = 'sentry_file'

    def delete(self, *args, **kwargs):
        if self.path:
            self.deletefile(commit=False)
        super(File, self).delete(*args, **kwargs)

    def generate_unique_path(self):
        pieces = self.type.split('.')
        pieces.extend(map(str, divmod(int(self.timestamp.strftime('%s')), ONE_DAY)))
        pieces.append('%s-%s' % (uuid4().hex, self.name))
        return '/'.join(pieces)

    def get_storage(self):
        backend = self.storage
        options = self.storage_options

        storage = get_storage_class(backend)
        return storage(**options)

    def deletefile(self, commit=False):
        assert self.path

        storage = self.get_storage()
        storage.delete(self.path)

        self.path = None

        if commit:
            self.save()

    def putfile(self, fileobj, commit=True):
        """
        Upload this given File's contents.

        A file's content is idempotent and you may not re-save a given file.

        >>> my_file = File(name='app.dsym', type='objc.dsym')
        >>> my_file.putfile(fileobj, commit=False)
        >>> my_file.save()
        """
        assert not self.path

        self.path = self.generate_unique_path()
        self.storage = settings.SENTRY_FILESTORE
        self.storage_options = settings.SENTRY_FILESTORE_OPTIONS

        checksum = md5('')
        for chunk in fileobj.chunks():
            checksum.update(chunk)
        self.checksum = checksum.hexdigest()

        storage = self.get_storage()
        storage.save(self.path, fileobj)

        if commit:
            self.save()

    def getfile(self):
        """
        Return a file-like object for this File's content.

        >>> fileobj = my_file.getfile()
        >>> with open('/tmp/localfile', 'wb') as fp:
        >>>     for chunk in fileobj.chunks():
        >>>         fp.write(chunk)
        """
        assert self.path

        storage = self.get_storage()
        return storage.open(self.path)
