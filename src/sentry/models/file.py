"""
sentry.models.file
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from django.core.files.base import ContentFile, File as FileObj
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

DEFAULT_BLOB_SIZE = 1024 * 1024  # one mb


class FileBlob(Model):
    __core__ = False

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
        Retrieve a list of FileBlobIndex instances for the given file.

        If not already present, this will cause it to be stored.

        >>> blobs = FileBlob.from_file(fileobj)
        """
        size = 0

        checksum = sha1('')
        for chunk in fileobj:
            size += len(chunk)
            checksum.update(chunk)
        checksum = checksum.hexdigest()

        lock_key = 'fileblob:upload:{}'.format(checksum)
        # TODO(dcramer): the database here is safe, but if this lock expires
        # and duplicate files are uploaded then we need to prune one
        with Lock(lock_key, timeout=600):
            # test for presence
            try:
                existing = FileBlob.objects.get(checksum=checksum)
            except FileBlob.DoesNotExist:
                pass
            else:
                return existing

            blob = cls(
                size=size,
                checksum=checksum,
            )

            blob.path = cls.generate_unique_path(blob.timestamp)

            storage = blob.get_storage()
            storage.save(blob.path, fileobj)
            blob.save()

        metrics.timing('filestore.blob-size', size)
        return blob

    @classmethod
    def generate_unique_path(cls, timestamp):
        pieces = map(str, divmod(int(timestamp.strftime('%s')), ONE_DAY))
        pieces.append('%s' % (uuid4().hex,))
        return '/'.join(pieces)

    def delete(self, *args, **kwargs):
        lock_key = 'fileblob:upload:{}'.format(self.checksum)
        with Lock(lock_key, timeout=600):
            if self.path:
                self.deletefile(commit=False)
            super(FileBlob, self).delete(*args, **kwargs)

    def get_storage(self):
        backend = settings.SENTRY_FILESTORE
        options = settings.SENTRY_FILESTORE_OPTIONS

        storage = get_storage_class(backend)
        return storage(**options)

    def deletefile(self, commit=False):
        assert self.path

        storage = self.get_storage()
        storage.delete(self.path)

        self.path = None

        if commit:
            self.save()

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
    blobs = models.ManyToManyField('sentry.FileBlob', through='sentry.FileBlobIndex')
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, null=True)

    # <Legacy fields>
    # Remove in 8.1
    blob = FlexibleForeignKey('sentry.FileBlob', null=True, related_name='legacy_blob')
    path = models.TextField(null=True)
    # </Legacy fields>

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_file'

    def getfile(self, *args, **kwargs):
        return FileObj(ChunkedFileBlobIndexWrapper(FileBlobIndex.objects.filter(
            file=self,
        ).select_related('blob').order_by('offset')), 'rb')

    def putfile(self, fileobj, blob_size=DEFAULT_BLOB_SIZE, commit=True):
        """
        Save a fileobj into a number of chunks.

        Returns a list of `FileBlobIndex` items.

        >>> indexes = file.putfile(fileobj)
        """
        results = []
        offset = 0
        checksum = sha1('')

        while True:
            contents = fileobj.read(blob_size)
            if not contents:
                break
            checksum.update(contents)

            blob_fileobj = ContentFile(contents)
            blob = FileBlob.from_file(blob_fileobj)

            results.append(
                FileBlobIndex.objects.create(
                    file=self,
                    blob=blob,
                    offset=offset,
                )
            )
            offset += blob.size
        self.size = offset
        self.checksum = checksum.hexdigest()
        metrics.timing('filestore.file-size', offset)
        if commit:
            self.save()
        return results


class FileBlobIndex(Model):
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    blob = FlexibleForeignKey('sentry.FileBlob')
    offset = BoundedPositiveIntegerField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_fileblobindex'
        unique_together = (('file', 'blob', 'offset'),)


class ChunkedFileBlobIndexWrapper(object):
    def __init__(self, indexes):
        # eager load from database incase its a queryset
        self._indexes = list(indexes)
        self._curfile = None
        self._curidx = None
        self.open()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, tb):
        self.close()

    def _nextidx(self):
        try:
            self._curidx = self._idxiter.next()
            self._curfile = self._curidx.blob.getfile()
        except StopIteration:
            self._curidx = None
            self._curfile = None

    @property
    def size(self):
        return sum(i.blob.size for i in self._indexes)

    def open(self):
        self.closed = False
        self.seek(0)

    def close(self):
        if self._curfile:
            self._curfile.close()
        self._curfile = None
        self._curidx = None
        self.closed = True

    def seek(self, pos):
        if self.closed:
            raise ValueError('I/O operation on closed file')
        if pos < 0:
            raise IOError('Invalid argument')
        for n, idx in enumerate(self._indexes[::-1]):
            if idx.offset <= pos:
                if idx != self._curidx:
                    self._idxiter = iter(self._indexes[-(n + 1):])
                    self._nextidx()
                break
        else:
            raise ValueError('Cannot seek to pos')
        self._curfile.seek(pos - self._curidx.offset)

    def tell(self):
        if self.closed:
            raise ValueError('I/O operation on closed file')
        return self._curidx.offset + self._curfile.tell()

    def read(self, bytes=4096):
        if self.closed:
            raise ValueError('I/O operation on closed file')
        result = ''
        while bytes and self._curfile is not None:
            blob_result = self._curfile.read(bytes)
            if not blob_result:
                self._nextidx()
                continue
            bytes -= len(blob_result)
            result += blob_result
        return result
