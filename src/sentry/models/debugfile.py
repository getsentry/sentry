"""
sentry.models.debugfile
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import re
import os
import six
import uuid
import time
import errno
import shutil
import hashlib
import logging
import tempfile

from jsonfield import JSONField
from django.db import models, transaction, IntegrityError
from django.db.models.fields.related import OneToOneRel

from symbolic import Archive, SymbolicError, ObjectErrorUnsupportedObject, \
    SYMCACHE_LATEST_VERSION, SymCache, SymCacheErrorMissingDebugInfo, \
    SymCacheErrorMissingDebugSection, CfiCache, CfiErrorMissingDebugInfo, \
    CFICACHE_LATEST_VERSION

from sentry import options
from sentry.cache import default_cache
from sentry.constants import KNOWN_DIF_FORMATS
from sentry.db.models import FlexibleForeignKey, Model, \
    sane_repr, BaseManager, BoundedPositiveIntegerField
from sentry.models.file import File
from sentry.reprocessing import resolve_processing_issue, \
    bump_reprocessing_revision
from sentry.utils import metrics
from sentry.utils.zip import safe_extract_zip
from sentry.utils.decorators import classproperty


logger = logging.getLogger(__name__)

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)

# How long we cache a conversion failure by checksum in cache.  Currently
# 10 minutes is assumed to be a reasonable value here.
CONVERSION_ERROR_TTL = 60 * 10

DIF_MIMETYPES = dict((v, k) for k, v in KNOWN_DIF_FORMATS.items())

_proguard_file_re = re.compile(r'/proguard/(?:mapping-)?(.*?)\.txt$')


def _get_idempotency_id(project, checksum):
    """For some operations an idempotency ID is needed."""
    return hashlib.sha1(b'%s|%s|project.dsym' % (
        str(project.id).encode('ascii'),
        checksum.encode('ascii'),
    )).hexdigest()


def get_assemble_status(project, checksum):
    """For a given file it checks what the current status of the assembling is.
    Returns a tuple in the form ``(status, details)`` where details is either
    `None` or a string identifying an error condition or notice.
    """
    cache_key = 'assemble-status:%s' % _get_idempotency_id(
        project, checksum)
    rv = default_cache.get(cache_key)
    if rv is None:
        return None, None
    return tuple(rv)


def set_assemble_status(project, checksum, state, detail=None):
    cache_key = 'assemble-status:%s' % _get_idempotency_id(
        project, checksum)

    # NB: Also cache successfully created debug files to avoid races between
    # multiple DIFs with the same identifier. On the downside, this blocks
    # re-uploads for 10 minutes.
    default_cache.set(cache_key, (state, detail), 600)


class BadDif(Exception):
    pass


class ProjectDebugFileManager(BaseManager):
    def find_missing(self, checksums, project):
        if not checksums:
            return []

        checksums = [x.lower() for x in checksums]
        missing = set(checksums)

        found = ProjectDebugFile.objects.filter(
            file__checksum__in=checksums, project=project
        ).values('file__checksum')

        for values in found:
            missing.discard(values.values()[0])

        return sorted(missing)

    def find_by_checksums(self, checksums, project):
        if not checksums:
            return []
        checksums = [x.lower() for x in checksums]
        return ProjectDebugFile.objects.filter(file__checksum__in=checksums, project=project)

    def find_by_debug_ids(self, project, debug_ids, features=None):
        """Finds debug information files matching the given debug identifiers.

        If a set of features is specified, only files that satisfy all features
        will be returned. This does not apply to legacy debug files that were
        not tagged with features.

        Returns a dict of debug files keyed by their debug identifier.
        """
        features = frozenset(features) if features is not None else frozenset()

        difs = ProjectDebugFile.objects \
            .filter(project=project, debug_id__in=debug_ids) \
            .select_related('file') \
            .order_by('-id')

        difs_by_id = {}
        for dif in difs:
            difs_by_id.setdefault(dif.debug_id, []).append(dif)

        rv = {}
        for debug_id, group in six.iteritems(difs_by_id):
            with_features = [dif for dif in group if 'features' in (dif.data or ())]

            # In case we've never computed features for any of these files, we
            # just take the first one and assume that it matches.
            if not with_features:
                rv[debug_id] = group[0]
                continue

            # There's at least one file with computed features. Older files are
            # considered redundant and will be deleted. We search for the first
            # file matching the given feature set. This might not resolve if no
            # DIF matches the given feature set.
            for dif in with_features:
                if dif.features >= features:
                    rv[debug_id] = dif
                    break

        return rv


class ProjectDebugFile(Model):
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    object_name = models.TextField()
    cpu_name = models.CharField(max_length=40)
    project = FlexibleForeignKey('sentry.Project', null=True)
    debug_id = models.CharField(max_length=64, db_column='uuid')
    code_id = models.CharField(max_length=64, null=True)
    data = JSONField(null=True)
    objects = ProjectDebugFileManager()

    class Meta:
        index_together = (('project', 'debug_id'), ('project', 'code_id'))
        db_table = 'sentry_projectdsymfile'
        app_label = 'sentry'

    __repr__ = sane_repr('object_name', 'cpu_name', 'debug_id')

    @property
    def file_format(self):
        ct = self.file.headers.get('Content-Type', 'unknown').lower()
        return KNOWN_DIF_FORMATS.get(ct, 'unknown')

    @property
    def file_extension(self):
        if self.file_format == 'breakpad':
            return '.sym'
        if self.file_format == 'macho':
            return '.dSYM'
        if self.file_format == 'proguard':
            return '.txt'
        if self.file_format == 'elf':
            return '.debug'

        return ''

    @property
    def supports_caches(self):
        return ProjectSymCacheFile.computes_from(self) \
            or ProjectCfiCacheFile.computes_from(self)

    @property
    def features(self):
        return frozenset((self.data or {}).get('features', []))

    def delete(self, *args, **kwargs):
        dif_id = self.id

        with transaction.atomic():
            # First, delete the debug file entity. This ensures no other
            # worker can attach caches to it. Integrity checks are deferred
            # within this transaction, so existing caches stay intact.
            super(ProjectDebugFile, self).delete(*args, **kwargs)

            # Explicitly select referencing caches and delete them. Using
            # the backref does not work, since `dif.id` is None after the
            # delete.
            symcaches = ProjectSymCacheFile.objects \
                .filter(debug_file_id=dif_id) \
                .select_related('cache_file')
            for symcache in symcaches:
                symcache.delete()

            cficaches = ProjectCfiCacheFile.objects \
                .filter(debug_file_id=dif_id) \
                .select_related('cache_file')
            for cficache in cficaches:
                cficache.delete()

        self.file.delete()


class ProjectCacheFile(Model):
    """Abstract base class for all debug cache files."""
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    cache_file = FlexibleForeignKey('sentry.File')
    debug_file = FlexibleForeignKey(
        'sentry.ProjectDebugFile',
        rel_class=OneToOneRel,
        db_column='dsym_file_id',
        on_delete=models.DO_NOTHING,
    )
    checksum = models.CharField(max_length=40)
    version = BoundedPositiveIntegerField()

    __repr__ = sane_repr('debug_file__debug_id', 'version')

    class Meta:
        abstract = True
        unique_together = (('project', 'debug_file'),)
        app_label = 'sentry'

    @classproperty
    def ignored_errors(cls):
        """Returns a set of errors that can safely be ignored during conversion.
        These errors should be expected by bad input data and do not indicate a
        programming error.
        """
        raise NotImplementedError

    @classproperty
    def required_features(cls):
        """Returns a set of features object files must have in order to support
        generating this cache.
        """
        raise NotImplementedError

    @classproperty
    def cache_cls(cls):
        """Returns the class of the raw cache referenced by this model. It can
        be used to load caches from the file system or to convert object files.
        """
        raise NotImplementedError

    @classproperty
    def cache_name(cls):
        """Returns the name of the cache class in lower case. Can be used for
        file extensions, cache keys, logs, etc.
        """
        return cls.cache_cls.__name__.lower()

    @classmethod
    def computes_from(cls, debug_file):
        """Indicates whether the cache can be computed from the given DIF."""
        return set(cls.required_features) <= debug_file.features

    @property
    def outdated(self):
        """Indicates whether this cache is outdated and needs to be recomputed.
        """
        raise NotImplemented

    def delete(self, *args, **kwargs):
        super(ProjectCacheFile, self).delete(*args, **kwargs)
        self.cache_file.delete()


class ProjectSymCacheFile(ProjectCacheFile):
    """Cache for native address symbolication: SymCache."""

    class Meta(ProjectCacheFile.Meta):
        db_table = 'sentry_projectsymcachefile'

    @classproperty
    def ignored_errors(cls):
        return (SymCacheErrorMissingDebugSection, SymCacheErrorMissingDebugInfo)

    @classproperty
    def required_features(cls):
        return ('debug',)

    @classproperty
    def cache_cls(cls):
        return SymCache

    @classmethod
    def computes_from(cls, debug_file):
        if debug_file.data is None:
            # Compatibility with legacy DIFs before features were introduced
            return debug_file.file_format in ('breakpad', 'macho', 'elf')
        return super(ProjectSymCacheFile, cls).computes_from(debug_file)

    @property
    def outdated(self):
        return self.version != SYMCACHE_LATEST_VERSION


class ProjectCfiCacheFile(ProjectCacheFile):
    """Cache for stack unwinding information: CfiCache."""

    class Meta(ProjectCacheFile.Meta):
        db_table = 'sentry_projectcficachefile'

    @classproperty
    def ignored_errors(cls):
        return (CfiErrorMissingDebugInfo,)

    @classproperty
    def required_features(cls):
        return ('unwind',)

    @classproperty
    def cache_cls(cls):
        return CfiCache

    @property
    def outdated(self):
        return self.version != CFICACHE_LATEST_VERSION


def clean_redundant_difs(project, debug_id):
    """Deletes redundant debug files from the database and file storage. A debug
    file is considered redundant if there is a newer file with the same debug
    identifier and the same or a superset of its features.
    """
    difs = ProjectDebugFile.objects \
        .filter(project=project, debug_id=debug_id) \
        .select_related('file') \
        .order_by('-id')

    all_features = set()
    for i, dif in enumerate(difs):
        # We always keep the latest file. If it has no features, likely the
        # previous files did not have features either and will be removed, or we
        # keep both. Subsequent uploads will remove this file later.
        if i > 0 and dif.features <= all_features:
            dif.delete()
        else:
            all_features.update(dif.features)


def create_dif_from_id(project, meta, fileobj=None, file=None):
    """This creates a mach dsym file or proguard mapping from the given
    debug id and open file object to a debug file.  This will not verify the
    debug id (intentionally so).  Use `detect_dif_from_path` to do that.
    """
    if meta.file_format == 'proguard':
        object_name = 'proguard-mapping'
    elif meta.file_format in ('macho', 'elf'):
        object_name = meta.name
    elif meta.file_format == 'breakpad':
        object_name = meta.name[:-4] if meta.name.endswith('.sym') else meta.name
    else:
        raise TypeError('unknown dif type %r' % (meta.file_format, ))

    if file is not None:
        checksum = file.checksum
    elif fileobj is not None:
        h = hashlib.sha1()
        while 1:
            chunk = fileobj.read(16384)
            if not chunk:
                break
            h.update(chunk)
        checksum = h.hexdigest()
        fileobj.seek(0, 0)
    else:
        raise RuntimeError('missing file object')

    dif = ProjectDebugFile.objects \
        .select_related('file') \
        .filter(project=project, debug_id=meta.debug_id, file__checksum=checksum, data__isnull=False) \
        .order_by('-id') \
        .first()

    if dif is not None:
        return dif, False

    if file is None:
        file = File.objects.create(
            name=meta.debug_id,
            type='project.dif',
            headers={'Content-Type': DIF_MIMETYPES[meta.file_format]},
        )
        file.putfile(fileobj)
    else:
        file.type = 'project.dif'
        file.headers['Content-Type'] = DIF_MIMETYPES[meta.file_format]
        file.save()

    dif = ProjectDebugFile.objects.create(
        file=file,
        debug_id=meta.debug_id,
        code_id=meta.code_id,
        cpu_name=meta.arch,
        object_name=object_name,
        project=project,
        data=meta.data,
    )

    # The DIF we've just created might actually be removed here again. But since
    # this can happen at any time in near or distant future, we don't care and
    # assume a successful upload. The DIF will be reported to the uploader and
    # reprocessing can start.
    clean_redundant_difs(project, meta.debug_id)

    resolve_processing_issue(
        project=project,
        scope='native',
        object='dsym:%s' % meta.debug_id,
    )

    return dif, True


def _analyze_progard_filename(filename):
    match = _proguard_file_re.search(filename)
    if match is None:
        return None

    ident = match.group(1)

    try:
        return six.text_type(uuid.UUID(ident))
    except Exception:
        pass


class DifMeta(object):
    def __init__(self, file_format, arch, debug_id, path, code_id=None, name=None, data=None):
        self.file_format = file_format
        self.arch = arch
        self.debug_id = debug_id
        self.code_id = code_id
        self.path = path
        self.data = data

        if name is not None:
            self.name = os.path.basename(name)
        elif path is not None:
            self.name = os.path.basename(path)

    @classmethod
    def from_object(cls, obj, path, name=None):
        return cls(
            file_format=obj.file_format,
            arch=obj.arch,
            debug_id=obj.debug_id,
            code_id=obj.code_id,
            path=path,
            # TODO: Extract the object name from the object
            name=name,
            data={
                'type': obj.kind,
                'features': list(obj.features),
            },
        )

    @property
    def basename(self):
        return os.path.basename(self.path)


def detect_dif_from_path(path, name=None):
    """This detects which kind of dif(Debug Information File) the path
    provided is. It returns an array since an Archive can contain more than
    one Object.
    """
    # proguard files (proguard/UUID.txt) or
    # (proguard/mapping-UUID.txt).
    proguard_id = _analyze_progard_filename(path)
    if proguard_id is not None:
        data = {'features': ['mapping']}
        return [DifMeta(
            file_format='proguard',
            arch='any',
            debug_id=proguard_id,
            code_id=None,
            path=path,
            name=name,
            data=data,
        )]

    # native debug information files (MachO, ELF or Breakpad)
    try:
        archive = Archive.open(path)
    except ObjectErrorUnsupportedObject as e:
        raise BadDif("Unsupported debug information file: %s" % e)
    except SymbolicError as e:
        logger.warning('dsymfile.bad-fat-object', exc_info=True)
        raise BadDif("Invalid debug information file: %s" % e)
    else:
        objs = []
        for obj in archive.iter_objects():
            objs.append(DifMeta.from_object(obj, path, name=name))
        return objs


def create_debug_file_from_dif(to_create, project):
    """Create a ProjectDebugFile from a dif (Debug Information File) and
    return an array of created objects.
    """
    rv = []
    for meta in to_create:
        with open(meta.path, 'rb') as f:
            dif, created = create_dif_from_id(project, meta, fileobj=f)
            if created:
                rv.append(dif)
    return rv


def create_files_from_dif_zip(fileobj, project, update_caches=True):
    """Creates all missing debug files from the given zip file.  This
    returns a list of all files created.
    """
    scratchpad = tempfile.mkdtemp()
    try:
        safe_extract_zip(fileobj, scratchpad, strip_toplevel=False)
        to_create = []

        for dirpath, dirnames, filenames in os.walk(scratchpad):
            for fn in filenames:
                fn = os.path.join(dirpath, fn)
                try:
                    difs = detect_dif_from_path(fn)
                except BadDif:
                    difs = None

                if difs is None:
                    difs = []
                to_create = to_create + difs

        rv = create_debug_file_from_dif(to_create, project)

        # Trigger generation of symcaches and cficaches to avoid dogpiling when
        # events start coming in.
        if update_caches:
            from sentry.tasks.symcache_update import symcache_update
            ids_to_update = [six.text_type(dif.debug_id) for dif in rv
                             if dif.supports_caches]
            if ids_to_update:
                symcache_update.delay(project_id=project.id,
                                      debug_ids=ids_to_update)

        # Uploading new dsysm changes the reprocessing revision
        bump_reprocessing_revision(project)

        return rv
    finally:
        shutil.rmtree(scratchpad)


class DIFCache(object):
    @property
    def cache_path(self):
        return options.get('dsym.cache-path')

    def get_project_path(self, project):
        return os.path.join(self.cache_path, six.text_type(project.id))

    def update_caches(self, project, debug_ids):
        """Updates symcaches and cficaches for all debug files matching the
        given debug ids, if the respective files support any of those caches.
        """
        # XXX: Worst case, this might download the same DIF twice.
        self._get_caches_impl(project, debug_ids, ProjectSymCacheFile)
        self._get_caches_impl(project, debug_ids, ProjectCfiCacheFile)

    def get_symcaches(self, project, debug_ids, on_dif_referenced=None,
                      with_conversion_errors=False):
        """Loads symcaches for the given debug IDs from the file system cache or
        blob store."""
        cachefiles, conversion_errors = self._get_caches_impl(
            project, debug_ids, ProjectSymCacheFile, on_dif_referenced)

        symcaches = self._load_cachefiles_via_fs(project, cachefiles, SymCache)
        if with_conversion_errors:
            return symcaches, dict((k, v) for k, v in conversion_errors.items())
        return symcaches

    def get_cficaches(self, project, debug_ids, on_dif_referenced=None,
                      with_conversion_errors=False):
        """Loads cficaches for the given debug IDs from the file system cache or
        blob store."""
        cachefiles, conversion_errors = self._get_caches_impl(
            project, debug_ids, ProjectCfiCacheFile, on_dif_referenced)
        cficaches = self._load_cachefiles_via_fs(project, cachefiles, CfiCache)
        if with_conversion_errors:
            return cficaches, dict((k, v) for k, v in conversion_errors.items())
        return cficaches

    def generate_caches(self, project, dif, filepath=None):
        """Generates a SymCache and CfiCache for the given debug information
        file if it supports these formats. Otherwise, a no - op. The caches are
        computed sequentially.
        The first error to occur is returned, otherwise None.
        """
        if not dif.supports_caches:
            return None

        if filepath:
            return self._generate_caches_impl(dif, filepath)

        with dif.file.getfile(as_tempfile=True) as tf:
            return self._generate_caches_impl(dif, tf.name)

    def fetch_difs(self, project, debug_ids, features=None):
        """Given some ids returns an id to path mapping for where the
        debug symbol files are on the FS.
        """
        debug_ids = [six.text_type(debug_id).lower() for debug_id in debug_ids]
        difs = ProjectDebugFile.objects.find_by_debug_ids(project, debug_ids, features)

        rv = {}
        for debug_id, dif in six.iteritems(difs):
            dif_path = os.path.join(self.get_project_path(project), debug_id)
            try:
                os.stat(dif_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                dif.file.save_to(dif_path)
            rv[debug_id] = dif_path

        return rv

    def _generate_caches_impl(self, dif, filepath):
        _, _, error = self._update_cachefile(dif, filepath, ProjectSymCacheFile)
        if error is not None:
            return error

        _, _, error = self._update_cachefile(dif, filepath, ProjectCfiCacheFile)

        # CFI generation will never fail to the user.  We instead log it here
        # for reference only.  This is because we have currently limited trust
        # in our CFI generation and even without CFI information we can
        # continue processing stacktraces.
        if error is not None:
            logger.warning('dsymfile.cfi-generation-failed', extra=dict(
                error=error,
                debug_id=dif.debug_id
            ))
            return None

        return None

    def _get_caches_impl(self, project, debug_ids, cls, on_dif_referenced=None):
        # Fetch debug files first and invoke the callback if we need
        debug_ids = [six.text_type(debug_id).lower() for debug_id in debug_ids]
        debug_files = ProjectDebugFile.objects.find_by_debug_ids(
            project, debug_ids, features=cls.required_features)

        # Notify the caller that we have used a symbol file
        if on_dif_referenced is not None:
            for debug_file in six.itervalues(debug_files):
                on_dif_referenced(debug_file)

        # Now find all the cache files we already have
        found_ids = [d.id for d in six.itervalues(debug_files)]
        existing_caches = cls.objects \
            .filter(project=project, debug_file_id__in=found_ids) \
            .select_related('cache_file', 'debug_file__debug_id')

        # Check for missing and out-of-date cache files. Outdated files are
        # removed to be re-created immediately.
        caches = []
        to_update = debug_files.copy()
        for cache_file in existing_caches:
            if cache_file.outdated:
                cache_file.delete()
            else:
                debug_id = cache_file.debug_file.debug_id
                to_update.pop(debug_id, None)
                caches.append((debug_id, cache_file, None))

        # If any cache files need to be updated, do that now
        if to_update:
            updated_cachefiles, conversion_errors = self._update_cachefiles(
                project, to_update.values(), cls)
            caches.extend(updated_cachefiles)
        else:
            conversion_errors = {}

        return caches, conversion_errors

    def _update_cachefiles(self, project, debug_files, cls):
        rv = []
        conversion_errors = {}

        for debug_file in debug_files:
            debug_id = debug_file.debug_id

            # Find all the known bad files we could not convert last time. We
            # use the debug identifier and file checksum to identify the source
            # DIF for historic reasons (debug_file.id would do, too).
            cache_key = 'scbe:%s:%s' % (debug_id, debug_file.file.checksum)
            err = default_cache.get(cache_key)
            if err is not None:
                conversion_errors[debug_id] = err
                continue

            # Download the original debug symbol and convert the object file to
            # a cache. This can either yield a cache object, an error or none of
            # the above. THE FILE DOWNLOAD CAN TAKE SIGNIFICANT TIME.
            with debug_file.file.getfile(as_tempfile=True) as tf:
                file, cache, err = self._update_cachefile(debug_file, tf.name, cls)

            # Store this conversion error so that we can skip subsequent
            # conversions. There might be concurrent conversions running for the
            # same debug file, however.
            if err is not None:
                default_cache.set(cache_key, err, CONVERSION_ERROR_TTL)
                conversion_errors[debug_id] = err
                continue

            if file is not None or cache is not None:
                rv.append((debug_id, file, cache))

        return rv, conversion_errors

    def _update_cachefile(self, debug_file, path, cls):
        debug_id = debug_file.debug_id

        # Skip silently if this cache cannot be computed from the given DIF
        if not cls.computes_from(debug_file):
            return None, None, None

        # Locate the object inside the Archive. Since we have keyed debug
        # files by debug_id, we expect a corresponding object. Otherwise, we
        # fail silently, just like with missing symbols.
        try:
            archive = Archive.open(path)
            obj = archive.get_object(debug_id=debug_id)
            if obj is None:
                return None, None, None

            # Check features from the actual object file, if this is a legacy
            # DIF where features have not been extracted yet.
            if (debug_file.data or {}).get('features') is None:
                if not set(cls.required_features) <= obj.features:
                    return None, None, None

            cache = cls.cache_cls.from_object(obj)
        except SymbolicError as e:
            if not isinstance(e, cls.ignored_errors):
                logger.error('dsymfile.%s-build-error' % cls.cache_name,
                             exc_info=True, extra=dict(debug_id=debug_id))

            metrics.incr('%s.failed' % cls.cache_name, tags={
                'error': e.__class__.__name__,
            }, skip_internal=False)

            return None, None, e.message

        file = File.objects.create(name=debug_id, type='project.%s' % cls.cache_name)
        file.putfile(cache.open_stream())

        # Try to insert the new Cache into the database. This only fail if
        # (1) another process has concurrently added the same sym cache, or if
        # (2) the debug symbol was deleted, either due to a newer upload or via
        # the API.
        try:
            with transaction.atomic():
                return cls.objects.create(
                    project=debug_file.project,
                    cache_file=file,
                    debug_file=debug_file,
                    checksum=debug_file.file.checksum,
                    version=cache.version,
                ), cache, None
        except IntegrityError:
            file.delete()

        # Check for a concurrently inserted cache and use that instead. This
        # could have happened (1) due to a concurrent insert, or (2) a new
        # upload that has already succeeded to compute a cache. The latter
        # case is extremely unlikely.
        cache_file = cls.objects \
            .filter(project=debug_file.project, debug_file__debug_id=debug_id) \
            .select_related('cache_file') \
            .order_by('-id') \
            .first()

        if cache_file is not None:
            return cache_file, None, None

        # There was no new cache, indicating that the debug file has been
        # replaced with a newer version. Another job will create the
        # corresponding cache eventually. To prevent querying the database
        # another time, simply use the in-memory cache for now:
        return None, cache, None

    def _load_cachefiles_via_fs(self, project, cachefiles, cls):
        rv = {}
        base = self.get_project_path(project)
        cls_name = cls.__name__.lower()

        for debug_id, model, cache in cachefiles:
            # If we're given a cache instance, use that over accessing the file
            # system or potentially even blob storage.
            if cache is not None:
                rv[debug_id] = cache
                continue
            elif model is None:
                raise RuntimeError('missing %s file to load from fs' % cls_name)

            # Try to locate a cached instance from the file system and bump the
            # timestamp to indicate it is still being used. Otherwise, download
            # from the blob store and place it in the cache folder.
            cachefile_name = '%s_%s.%s' % (model.id, model.version, cls_name)
            cachefile_path = os.path.join(base, cachefile_name)
            try:
                stat = os.stat(cachefile_path)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                model.cache_file.save_to(cachefile_path)
            else:
                now = int(time.time())
                if stat.st_ctime < now - ONE_DAY:
                    os.utime(cachefile_path, (now, now))

            rv[debug_id] = cls.open(cachefile_path)
        return rv

    def clear_old_entries(self):
        try:
            cache_folders = os.listdir(self.cache_path)
        except OSError:
            return

        cutoff = int(time.time()) - ONE_DAY_AND_A_HALF

        for cache_folder in cache_folders:
            cache_folder = os.path.join(self.cache_path, cache_folder)
            try:
                items = os.listdir(cache_folder)
            except OSError:
                continue
            for cached_file in items:
                cached_file = os.path.join(cache_folder, cached_file)
                try:
                    mtime = os.path.getmtime(cached_file)
                except OSError:
                    continue
                if mtime < cutoff:
                    try:
                        os.remove(cached_file)
                    except OSError:
                        pass


ProjectDebugFile.difcache = DIFCache()
