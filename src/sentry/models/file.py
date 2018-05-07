"""
sentry.models.file
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import os
import six
import mmap
import tempfile

from hashlib import sha1
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.core.files.base import File as FileObj
from django.core.files.base import ContentFile
from django.core.files.storage import get_storage_class
from django.db import models, transaction
from django.utils import timezone
from jsonfield import JSONField

from sentry.app import locks
from sentry.db.models import (BoundedPositiveIntegerField, FlexibleForeignKey, Model)
from sentry.utils import metrics
from sentry.utils.retries import TimedRetryPolicy

ONE_DAY = 60 * 60 * 24

DEFAULT_BLOB_SIZE = 1024 * 1024  # one mb
CHUNK_STATE_HEADER = '__state'


def enum(**named_values):
    return type('Enum', (), named_values)


ChunkFileState = enum(
    OK='ok',  # File in database
    NOT_FOUND='not_found',  # File not found in database
    CREATED='created',  # File was created in the request and send to the worker for assembling
    ASSEMBLING='assembling',  # File still being processed by worker
    ERROR='error'  # Error happened during assembling
)


class AssembleChecksumMismatch(Exception):
    pass


def get_storage():
    from sentry import options
    backend = options.get('filestore.backend')
    options = options.get('filestore.options')

    try:
        backend = settings.SENTRY_FILESTORE_ALIASES[backend]
    except KeyError:
        pass

    storage = get_storage_class(backend)
    return storage(**options)


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

        checksum = sha1(b'')
        for chunk in fileobj:
            size += len(chunk)
            checksum.update(chunk)
        checksum = checksum.hexdigest()

        # TODO(dcramer): the database here is safe, but if this lock expires
        # and duplicate files are uploaded then we need to prune one
        lock = locks.get('fileblob:upload:{}'.format(checksum), duration=60 * 10)
        with TimedRetryPolicy(60)(lock.acquire):
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

            storage = get_storage()
            storage.save(blob.path, fileobj)
            blob.save()

        metrics.timing('filestore.blob-size', size)
        return blob

    @classmethod
    def generate_unique_path(cls, timestamp):
        pieces = [six.text_type(x) for x in divmod(int(timestamp.strftime('%s')), ONE_DAY)]
        pieces.append(uuid4().hex)
        return u'/'.join(pieces)

    def delete(self, *args, **kwargs):
        lock = locks.get('fileblob:upload:{}'.format(self.checksum), duration=60 * 10)
        with TimedRetryPolicy(60)(lock.acquire):
            if self.path:
                self.deletefile(commit=False)
            super(FileBlob, self).delete(*args, **kwargs)

    def deletefile(self, commit=False):
        assert self.path

        storage = get_storage()
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

        storage = get_storage()
        return storage.open(self.path)


class File(Model):
    __core__ = False

    name = models.TextField()
    type = models.CharField(max_length=64)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    headers = JSONField()
    blobs = models.ManyToManyField('sentry.FileBlob', through='sentry.FileBlobIndex')
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, null=True, db_index=True)

    # <Legacy fields>
    # Remove in 8.1
    blob = FlexibleForeignKey('sentry.FileBlob', null=True, related_name='legacy_blob')
    path = models.TextField(null=True)

    # </Legacy fields>

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_file'

    def _get_chunked_blob(self, mode=None, prefetch=False,
                          prefetch_to=None, delete=True):
        return ChunkedFileBlobIndexWrapper(
            FileBlobIndex.objects.filter(
                file=self,
            ).select_related('blob').order_by('offset'),
            mode=mode,
            prefetch=prefetch,
            prefetch_to=prefetch_to,
            delete=delete
        )

    def getfile(self, mode=None, prefetch=False, as_tempfile=False):
        """Returns a file object.  By default the file is fetched on
        demand but if prefetch is enabled the file is fully prefetched
        into a tempfile before reading can happen.

        Additionally if `as_tempfile` is passed a NamedTemporaryFile is
        returned instead which can help in certain situations where a
        tempfile is necessary.
        """
        if as_tempfile:
            prefetch = True
        impl = self._get_chunked_blob(mode, prefetch)
        if as_tempfile:
            return impl.detach_tempfile()
        return FileObj(impl, self.name)

    def save_to(self, path):
        """Fetches the file and emplaces it at a certain location.  The
        write is done atomically to a tempfile first and then moved over.
        If the directory does not exist it is created.
        """
        path = os.path.abspath(path)
        base = os.path.dirname(path)
        try:
            os.makedirs(base)
        except OSError:
            pass

        f = None
        try:
            f = self._get_chunked_blob(prefetch=True,
                                       prefetch_to=base,
                                       delete=False).detach_tempfile()
            os.rename(f.name, path)
            f.close()
            f = None
        finally:
            if f is not None:
                f.close()
                try:
                    os.remove(f.name)
                except Exception:
                    pass

    def putfile(self, fileobj, blob_size=DEFAULT_BLOB_SIZE, commit=True):
        """
        Save a fileobj into a number of chunks.

        Returns a list of `FileBlobIndex` items.

        >>> indexes = file.putfile(fileobj)
        """
        results = []
        offset = 0
        checksum = sha1(b'')

        while True:
            contents = fileobj.read(blob_size)
            if not contents:
                break
            checksum.update(contents)

            blob_fileobj = ContentFile(contents)
            blob = FileBlob.from_file(blob_fileobj)

            results.append(FileBlobIndex.objects.create(
                file=self,
                blob=blob,
                offset=offset,
            ))
            offset += blob.size
        self.size = offset
        self.checksum = checksum.hexdigest()
        metrics.timing('filestore.file-size', offset)
        if commit:
            self.save()
        return results

    def assemble_from_file_blob_ids(self, file_blob_ids, checksum, commit=True):
        """
        This creates a file, from file blobs and returns a temp file with the
        contents.
        """
        tf = tempfile.NamedTemporaryFile()
        with transaction.atomic():
            file_blobs = FileBlob.objects.filter(id__in=file_blob_ids).all()
            # Make sure the blobs are sorted with the order provided
            file_blobs = sorted(file_blobs, key=lambda blob: file_blob_ids.index(blob.id))

            new_checksum = sha1(b'')
            offset = 0
            for blob in file_blobs:
                FileBlobIndex.objects.create(
                    file=self,
                    blob=blob,
                    offset=offset,
                )
                for chunk in blob.getfile().chunks():
                    new_checksum.update(chunk)
                    tf.write(chunk)
                offset += blob.size

            self.size = offset
            self.checksum = new_checksum.hexdigest()

            if checksum != self.checksum:
                raise AssembleChecksumMismatch('Checksum mismatch')

        metrics.timing('filestore.file-size', offset)
        if commit:
            self.save()
        tf.flush()
        tf.seek(0)
        return tf


class FileBlobIndex(Model):
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    blob = FlexibleForeignKey('sentry.FileBlob')
    offset = BoundedPositiveIntegerField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_fileblobindex'
        unique_together = (('file', 'blob', 'offset'), )


class ChunkedFileBlobIndexWrapper(object):
    def __init__(self, indexes, mode=None, prefetch=False,
                 prefetch_to=None, delete=True):
        # eager load from database incase its a queryset
        self._indexes = list(indexes)
        self._curfile = None
        self._curidx = None
        if prefetch:
            self.prefetched = True
            self._prefetch(prefetch_to, delete)
        else:
            self.prefetched = False
        self.mode = mode
        self.open()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, tb):
        self.close()

    def detach_tempfile(self):
        if not self.prefetched:
            raise TypeError('Can only detech tempfiles in prefetch mode')
        rv = self._curfile
        self._curfile = None
        self.close()
        rv.seek(0)
        return rv

    def _nextidx(self):
        assert not self.prefetched, 'this makes no sense'
        old_file = self._curfile
        try:
            try:
                self._curidx = six.next(self._idxiter)
                self._curfile = self._curidx.blob.getfile()
            except StopIteration:
                self._curidx = None
                self._curfile = None
        finally:
            if old_file is not None:
                old_file.close()

    @property
    def size(self):
        return sum(i.blob.size for i in self._indexes)

    def open(self):
        self.closed = False
        self.seek(0)

    def _prefetch(self, prefetch_to=None, delete=True):
        size = self.size
        f = tempfile.NamedTemporaryFile(prefix='._prefetch-',
                                        dir=prefetch_to,
                                        delete=delete)
        if size == 0:
            self._curfile = f
            return

        # Zero out the file
        f.seek(size - 1)
        f.write('\x00')
        f.flush()

        mem = mmap.mmap(f.fileno(), size)

        def fetch_file(offset, getfile):
            with getfile() as sf:
                while 1:
                    chunk = sf.read(65535)
                    if not chunk:
                        break
                    mem[offset:offset + len(chunk)] = chunk
                    offset += len(chunk)

        with ThreadPoolExecutor(max_workers=4) as exe:
            for idx in self._indexes:
                exe.submit(fetch_file, idx.offset, idx.blob.getfile)

        mem.flush()
        self._curfile = f

    def close(self):
        if self._curfile:
            self._curfile.close()
        self._curfile = None
        self._curidx = None
        self.closed = True

    def seek(self, pos):
        if self.closed:
            raise ValueError('I/O operation on closed file')

        if self.prefetched:
            return self._curfile.seek(pos)

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
        if self.prefetched:
            return self._curfile.tell()
        if self._curfile is None:
            return self.size
        return self._curidx.offset + self._curfile.tell()

    def read(self, n=-1):
        if self.closed:
            raise ValueError('I/O operation on closed file')

        if self.prefetched:
            return self._curfile.read(n)

        result = bytearray()

        # Read to the end of the file
        if n < 0:
            while self._curfile is not None:
                blob_result = self._curfile.read(32768)
                if not blob_result:
                    self._nextidx()
                else:
                    result.extend(blob_result)

        # Read until a certain number of bytes are read
        else:
            while n > 0 and self._curfile is not None:
                blob_result = self._curfile.read(min(n, 32768))
                if not blob_result:
                    self._nextidx()
                else:
                    n -= len(blob_result)
                    result.extend(blob_result)

        return bytes(result)


class FileBlobOwner(Model):
    __core__ = False

    blob = FlexibleForeignKey('sentry.FileBlob')
    organization = FlexibleForeignKey('sentry.Organization')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_fileblobowner'
        unique_together = (('blob', 'organization'), )
