from __future__ import absolute_import

import re
import os
import six
import uuid
import errno
import shutil
import hashlib
import logging
import tempfile

from django.db import models

from symbolic import Archive, SymbolicError, ObjectErrorUnsupportedObject, normalize_debug_id

from sentry import options
from sentry.constants import KNOWN_DIF_FORMATS
from sentry.db.models import FlexibleForeignKey, Model, sane_repr, BaseManager, JSONField
from sentry.models.file import File, clear_cached_files
from sentry.reprocessing import resolve_processing_issue, bump_reprocessing_revision
from sentry.utils.zip import safe_extract_zip


logger = logging.getLogger(__name__)

# How long we cache a conversion failure by checksum in cache.  Currently
# 10 minutes is assumed to be a reasonable value here.
CONVERSION_ERROR_TTL = 60 * 10

DIF_MIMETYPES = dict((v, k) for k, v in KNOWN_DIF_FORMATS.items())

_proguard_file_re = re.compile(r"/proguard/(?:mapping-)?(.*?)\.txt$")


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
        ).values("file__checksum")

        for values in found:
            missing.discard(list(values.values())[0])

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

        difs = (
            ProjectDebugFile.objects.filter(project=project, debug_id__in=debug_ids)
            .select_related("file")
            .order_by("-id")
        )

        difs_by_id = {}
        for dif in difs:
            difs_by_id.setdefault(dif.debug_id, []).append(dif)

        rv = {}
        for debug_id, group in six.iteritems(difs_by_id):
            with_features = [dif for dif in group if "features" in (dif.data or ())]

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

    file = FlexibleForeignKey("sentry.File")
    object_name = models.TextField()
    cpu_name = models.CharField(max_length=40)
    project = FlexibleForeignKey("sentry.Project", null=True, db_constraint=False)
    debug_id = models.CharField(max_length=64, db_column=u"uuid")
    code_id = models.CharField(max_length=64, null=True)
    data = JSONField(null=True)
    objects = ProjectDebugFileManager()

    class Meta:
        index_together = (("project", "debug_id"), ("project", "code_id"))
        db_table = "sentry_projectdsymfile"
        app_label = "sentry"

    __repr__ = sane_repr("object_name", "cpu_name", "debug_id")

    @property
    def file_format(self):
        ct = self.file.headers.get("Content-Type", "unknown").lower()
        return KNOWN_DIF_FORMATS.get(ct, "unknown")

    @property
    def file_type(self):
        if self.data:
            return self.data.get("type")

    @property
    def file_extension(self):
        if self.file_format == "breakpad":
            return ".sym"
        if self.file_format == "macho":
            return "" if self.file_type == "exe" else ".dSYM"
        if self.file_format == "proguard":
            return ".txt"
        if self.file_format == "elf":
            return "" if self.file_type == "exe" else ".debug"
        if self.file_format == "pe":
            return ".exe" if self.file_type == "exe" else ".dll"
        if self.file_format == "pdb":
            return ".pdb"
        if self.file_format == "sourcebundle":
            return ".src.zip"

        return ""

    @property
    def features(self):
        return frozenset((self.data or {}).get("features", []))

    def delete(self, *args, **kwargs):
        super(ProjectDebugFile, self).delete(*args, **kwargs)
        self.file.delete()


def clean_redundant_difs(project, debug_id):
    """Deletes redundant debug files from the database and file storage. A debug
    file is considered redundant if there is a newer file with the same debug
    identifier and the same or a superset of its features.
    """
    difs = (
        ProjectDebugFile.objects.filter(project=project, debug_id=debug_id)
        .select_related("file")
        .order_by("-id")
    )

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
    if meta.file_format == "proguard":
        object_name = "proguard-mapping"
    elif meta.file_format in ("macho", "elf", "pdb", "pe", "sourcebundle"):
        object_name = meta.name
    elif meta.file_format == "breakpad":
        object_name = meta.name[:-4] if meta.name.endswith(".sym") else meta.name
    else:
        raise TypeError("unknown dif type %r" % (meta.file_format,))

    if file is not None:
        checksum = file.checksum
    elif fileobj is not None:
        h = hashlib.sha1()
        while True:
            chunk = fileobj.read(16384)
            if not chunk:
                break
            h.update(chunk)
        checksum = h.hexdigest()
        fileobj.seek(0, 0)
    else:
        raise RuntimeError("missing file object")

    dif = (
        ProjectDebugFile.objects.select_related("file")
        .filter(
            project=project, debug_id=meta.debug_id, file__checksum=checksum, data__isnull=False
        )
        .order_by("-id")
        .first()
    )

    if dif is not None:
        return dif, False

    if file is None:
        file = File.objects.create(
            name=meta.debug_id,
            type="project.dif",
            headers={"Content-Type": DIF_MIMETYPES[meta.file_format]},
        )
        file.putfile(fileobj)
    else:
        file.type = "project.dif"
        file.headers["Content-Type"] = DIF_MIMETYPES[meta.file_format]
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

    resolve_processing_issue(project=project, scope="native", object="dsym:%s" % meta.debug_id)

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
    def from_object(cls, obj, path, name=None, debug_id=None):
        if debug_id is not None:
            try:
                debug_id = normalize_debug_id(debug_id)
            except SymbolicError:
                debug_id = None

        # Only allow overrides in the debug_id's age if the rest of the debug id
        # matches with what we determine from the object file. We generally
        # trust the server more than the client.
        obj_id = obj.debug_id
        if obj_id and debug_id and obj_id[:36] == debug_id[:36]:
            obj_id = debug_id

        return cls(
            file_format=obj.file_format,
            arch=obj.arch,
            debug_id=obj_id,
            code_id=obj.code_id,
            path=path,
            # TODO: Extract the object name from the object
            name=name,
            data={"type": obj.kind, "features": list(obj.features)},
        )

    @property
    def basename(self):
        return os.path.basename(self.path)


def detect_dif_from_path(path, name=None, debug_id=None):
    """This detects which kind of dif(Debug Information File) the path
    provided is. It returns an array since an Archive can contain more than
    one Object.
    """
    # proguard files (proguard/UUID.txt) or
    # (proguard/mapping-UUID.txt).
    proguard_id = _analyze_progard_filename(path)
    if proguard_id is not None:
        data = {"features": ["mapping"]}
        return [
            DifMeta(
                file_format="proguard",
                arch="any",
                debug_id=proguard_id,
                code_id=None,
                path=path,
                name=name,
                data=data,
            )
        ]

    # native debug information files (MachO, ELF or Breakpad)
    try:
        archive = Archive.open(path)
    except ObjectErrorUnsupportedObject as e:
        raise BadDif("Unsupported debug information file: %s" % e)
    except SymbolicError as e:
        logger.warning("dsymfile.bad-fat-object", exc_info=True)
        raise BadDif("Invalid debug information file: %s" % e)
    else:
        objs = []
        for obj in archive.iter_objects():
            objs.append(DifMeta.from_object(obj, path, name=name, debug_id=debug_id))
        return objs


def create_debug_file_from_dif(to_create, project):
    """Create a ProjectDebugFile from a dif (Debug Information File) and
    return an array of created objects.
    """
    rv = []
    for meta in to_create:
        with open(meta.path, "rb") as f:
            dif, created = create_dif_from_id(project, meta, fileobj=f)
            if created:
                rv.append(dif)
    return rv


def create_files_from_dif_zip(fileobj, project):
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

        # Uploading new dsysm changes the reprocessing revision
        bump_reprocessing_revision(project)

        return rv
    finally:
        shutil.rmtree(scratchpad)


class DIFCache(object):
    @property
    def cache_path(self):
        return options.get("dsym.cache-path")

    def get_project_path(self, project):
        return os.path.join(self.cache_path, six.text_type(project.id))

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

    def clear_old_entries(self):
        clear_cached_files(self.cache_path)


ProjectDebugFile.difcache = DIFCache()
