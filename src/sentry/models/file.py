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
from hashlib import sha1
from jsonfield import JSONField
from uuid import uuid4

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model
)
from sentry.utils import metrics
from sentry.utils.cache import Lock

ONE_DAY = 60 * 60 * 24


class FileBlob(Model):
    __core__ = False

    storage = models.CharField(max_length=128)
    storage_options = JSONField()
    path = models.TextField(null=True)
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, unique=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_fileblob'

    @classmethod
    def from_file(cls, fileobj):
        """
        Retrieve a FileBlob instance for the given file.

        If not already present, this will cause it to be stored.

        >>> blob = FileBlob.from_file(fileobj)
        """
        blob = cls()
        blob.putfile(fileobj)
        return blob

    def delete(self, *args, **kwargs):
        if self.path:
            self.deletefile(commit=False)
        super(FileBlob, self).delete(*args, **kwargs)

    def generate_unique_path(self):
        pieces = map(str, divmod(int(self.timestamp.strftime('%s')), ONE_DAY))
        pieces.append('%s' % (uuid4().hex,))
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

    def putfile(self, fileobj):
        assert not self.path

        size = 0
        checksum = sha1('')
        for chunk in fileobj:
            size += len(chunk)
            checksum.update(chunk)
        self.size = size
        self.checksum = checksum.hexdigest()

        with Lock('fileblob:upload:{}'.format(self.checksum)):
            # test for presence
            try:
                existing = FileBlob.objects.get(checksum=self.checksum)
            except FileBlob.DoesNotExist:
                pass
            else:
                self.__dict__.update(existing.__dict__)
                return

            self.path = self.generate_unique_path()
            self.storage = settings.SENTRY_FILESTORE
            self.storage_options = settings.SENTRY_FILESTORE_OPTIONS

            storage = self.get_storage()
            storage.save(self.path, fileobj)
            self.save()
            metrics.timing('filestore.blob-size', self.size)

    def getfile(self):
        """
        Return a file-like object for this File's content.

        >>> with blob.getfile() as src, open('/tmp/localfile', 'wb') as dst:
        >>>     for chunk in src.chunks():
        >>>         dst.write(chunk)
        """
        assert self.path

        storage = self.get_storage()
        return storage.open(self.path)


class File(Model):
    __core__ = False

    name = models.CharField(max_length=128)
    type = models.CharField(max_length=64)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    headers = JSONField()
    blob = FlexibleForeignKey('sentry.FileBlob', null=True)

    # <Legacy fields>
    storage = models.CharField(max_length=128, null=True)
    storage_options = JSONField()
    path = models.TextField(null=True)
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, null=True)
    # </Legacy fields>

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_file'

    def delete(self, *args, **kwargs):
        super(File, self).delete(*args, **kwargs)
        if self.blob_id and not File.objects.filter(blob=self.blob_id).exists():
            self.blob.deletefile()
            self.blob.delete()

    def ensure_blob(self):
        if self.blob:
            return

        lock_key = 'fileblob:convert:{}'.format(self.checksum)
        with Lock(lock_key):
            blob, created = FileBlob.objects.get_or_create(
                checksum=self.checksum,
                defaults={
                    'storage': self.storage,
                    'storage_options': self.storage_options,
                    'path': self.path,
                    'size': self.size,
                    'timestamp': self.timestamp,
                },
            )

            # if this blob already existed, lets kill the duplicate
            # TODO(dcramer): kill data when fully migrated
            # if self.path != blob.path:
            #     get_storage_class(self.storage)(
            #         **self.storage_options
            #     ).delete(self.path)

            self.update(
                blob=blob,
                # TODO(dcramer): kill data when fully migrated
                # checksum=None,
                # path=None,
                # storage=None,
                # storage_options={},
            )

    def getfile(self, *args, **kwargs):
        self.ensure_blob()
        return self.blob.getfile(*args, **kwargs)
