from __future__ import annotations

import os
import tempfile
import time
import zipfile
from io import BytesIO
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.models.debugfile import (
    DifMeta,
    ProjectDebugFile,
    create_dif_from_id,
    detect_dif_from_path,
)
from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase, TestCase

# This is obviously a freely generated UUID and not the checksum UUID.
# This is permissible if users want to send different UUIDs
PROGUARD_UUID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
PROGUARD_SOURCE = b"""\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
65:65:void <init>() -> <init>
67:67:java.lang.Class[] getClassContext() -> getClassContext
65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
"""


class DebugFileTest(TestCase):
    def test_delete_dif(self) -> None:
        dif = self.create_dif_file(
            debug_id="dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface", features=["debug", "unwind"]
        )

        dif_id = dif.id
        dif.delete()

        assert not ProjectDebugFile.objects.filter(id=dif_id).exists()
        assert not File.objects.filter(id=dif.file.id).exists()

    def test_find_dif_by_debug_id(self) -> None:
        debug_id1 = "dfb8e43a-f242-3d73-a453-aeb6a777ef75"
        debug_id2 = "19bd7a09-3e31-4911-a5cd-8e829b845407"
        debug_id3 = "7d402821-fae6-4ebc-bbb2-152f8e3b3352"

        self.create_dif_file(debug_id=debug_id1)
        dif1 = self.create_dif_file(debug_id=debug_id1)
        dif2 = self.create_dif_file(debug_id=debug_id2)

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project, debug_ids=[debug_id1, debug_id2, debug_id3]
        )

        assert difs[debug_id1].id == dif1.id
        assert difs[debug_id2].id == dif2.id
        assert debug_id3 not in difs

    def test_find_dif_by_feature(self) -> None:
        debug_id1 = "dfb8e43a-f242-3d73-a453-aeb6a777ef75"
        debug_id2 = "19bd7a09-3e31-4911-a5cd-8e829b845407"
        debug_id3 = "7d402821-fae6-4ebc-bbb2-152f8e3b3352"

        self.create_dif_file(debug_id=debug_id1, features=["debug"])
        dif1 = self.create_dif_file(debug_id=debug_id1, features=["debug"])
        self.create_dif_file(debug_id=debug_id1, features=["unwind"])
        dif2 = self.create_dif_file(debug_id=debug_id2)

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project, debug_ids=[debug_id1, debug_id2, debug_id3], features=["debug"]
        )

        assert difs[debug_id1].id == dif1.id
        assert difs[debug_id2].id == dif2.id
        assert debug_id3 not in difs

    def test_find_dif_by_features(self) -> None:
        debug_id1 = "dfb8e43a-f242-3d73-a453-aeb6a777ef75"
        debug_id2 = "19bd7a09-3e31-4911-a5cd-8e829b845407"
        debug_id3 = "7d402821-fae6-4ebc-bbb2-152f8e3b3352"

        dif1 = self.create_dif_file(debug_id=debug_id1, features=["debug", "unwind"])
        self.create_dif_file(debug_id=debug_id1, features=["debug"])
        self.create_dif_file(debug_id=debug_id1, features=["unwind"])
        dif2 = self.create_dif_file(debug_id=debug_id2)

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project,
            debug_ids=[debug_id1, debug_id2, debug_id3],
            features=["debug", "unwind"],
        )

        assert difs[debug_id1].id == dif1.id
        assert difs[debug_id2].id == dif2.id
        assert debug_id3 not in difs

    def test_find_legacy_dif_by_features(self) -> None:
        debug_id1 = "dfb8e43a-f242-3d73-a453-aeb6a777ef75"
        self.create_dif_file(debug_id=debug_id1)
        dif1 = self.create_dif_file(debug_id=debug_id1)

        # XXX: If no file has features, in a group, the newest one is chosen,
        # regardless of the required feature set.
        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project, debug_ids=[debug_id1], features=["debug"]
        )
        assert difs[debug_id1].id == dif1.id

    def test_find_dif_miss_by_features(self) -> None:
        debug_id = "dfb8e43a-f242-3d73-a453-aeb6a777ef75"
        self.create_dif_file(debug_id=debug_id, features=[])

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project, debug_ids=[debug_id], features=["debug"]
        )
        assert debug_id not in difs

    def test_find_missing(self) -> None:
        dif = self.create_dif_file(debug_id="dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface")
        ret = ProjectDebugFile.objects.find_missing([dif.checksum, "a" * 40], self.project)
        assert ret == ["a" * 40]

    def test_file_extension_dartsymbolmap(self) -> None:
        """Test that dartsymbolmap files return .json file extension."""
        # Create a file with dartsymbolmap content type
        file = File.objects.create(
            name="dartsymbolmap",
            type="project.dif",
            headers={"Content-Type": "application/x-dartsymbolmap+json"},
        )

        # Create a ProjectDebugFile
        dif = ProjectDebugFile.objects.create(
            file=file,
            checksum="test-checksum",
            object_name="dartsymbolmap",
            cpu_name="any",
            project_id=self.project.id,
            debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75",
            data={"features": ["mapping"]},
        )

        # Verify that file_extension returns .json
        assert dif.file_extension == ".json"

    def test_file_extension_macho_dbg(self) -> None:
        """Test that macho files return empty file extension."""
        file = File.objects.create(
            name="foo",
            type="project.dif",
            headers={"Content-Type": "application/x-mach-binary"},
        )

        dif = ProjectDebugFile.objects.create(
            file=file,
            checksum="test-checksum",
            object_name="foo",
            cpu_name="x86_64",
            project_id=self.project.id,
            debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75",
            data={"type": "dbg"},
        )

        assert dif.file_extension == ".debug"

    def test_file_extension_macho_exe(self) -> None:
        file = File.objects.create(
            name="foo",
            type="project.dif",
            headers={"Content-Type": "application/x-mach-binary"},
        )

        dif = ProjectDebugFile.objects.create(
            file=file,
            checksum="test-checksum",
            object_name="foo",
            cpu_name="x86_64",
            project_id=self.project.id,
            debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75",
            data={"type": "exe"},
        )

        assert dif.file_extension == ""

    def test_file_extension_macho_lib(self) -> None:
        file = File.objects.create(
            name="foo",
            type="project.dif",
            headers={"Content-Type": "application/x-mach-binary"},
        )

        dif = ProjectDebugFile.objects.create(
            file=file,
            checksum="test-checksum",
            object_name="foo",
            cpu_name="x86_64",
            project_id=self.project.id,
            debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75",
            data={"type": "lib"},
        )

        assert dif.file_extension == ""


class CreateDebugFileTest(APITestCase):
    @property
    def file_path(self):
        return os.path.join(os.path.dirname(__file__), "fixtures", "crash.dsym")

    def create_dif(self, fileobj=None, file=None, **kwargs):
        args: dict[str, Any] = {
            "file_format": "macho",
            "arch": "x86_64",
            "debug_id": "67e9247c-814e-392b-a027-dbde6748fcbf",
            "data": {"features": ["debug"]},
            "path": "crash.dsym",
        }

        args.update(kwargs)
        return create_dif_from_id(self.project, DifMeta(**args), fileobj=fileobj, file=file)

    def test_create_dif_from_file(self) -> None:
        file = self.create_file(
            name="crash.dsym", checksum="dc1e3f3e411979d336c3057cce64294f3420f93a"
        )
        dif, created = self.create_dif(file=file)

        assert created
        assert dif is not None
        assert dif.file.type == "project.dif"
        assert "Content-Type" in dif.file.headers
        assert ProjectDebugFile.objects.filter(id=dif.id).exists()

    def test_create_dif_from_fileobj(self) -> None:
        with open(self.file_path, "rb") as f:
            dif, created = self.create_dif(fileobj=f)

        assert created
        assert dif is not None
        assert dif.file.type == "project.dif"
        assert "Content-Type" in dif.file.headers
        assert ProjectDebugFile.objects.filter(id=dif.id).exists()

    def test_keep_disjoint_difs(self) -> None:
        file = self.create_file(
            name="crash.dsym", checksum="dc1e3f3e411979d336c3057cce64294f3420f93a"
        )
        dif1, created1 = self.create_dif(file=file, data={"features": ["unwind"]})

        file = self.create_file(
            name="crash.dsym", checksum="2b92c5472f4442a27da02509951ea2e0f529511c"
        )
        dif2, created2 = self.create_dif(file=file, data={"features": ["debug"]})

        assert created1 and created2
        assert ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()

    def test_keep_overlapping_difs(self) -> None:
        file = self.create_file(
            name="crash.dsym", checksum="dc1e3f3e411979d336c3057cce64294f3420f93a"
        )
        dif1, created1 = self.create_dif(file=file, data={"features": ["symtab", "unwind"]})

        file = self.create_file(
            name="crash.dsym", checksum="2b92c5472f4442a27da02509951ea2e0f529511c"
        )
        dif2, created2 = self.create_dif(file=file, data={"features": ["symtab", "debug"]})

        assert created1 and created2
        assert ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()

    def test_keep_latest_dif(self) -> None:
        file = self.create_file(
            name="crash.dsym", checksum="dc1e3f3e411979d336c3057cce64294f3420f93a"
        )
        dif1, created1 = self.create_dif(file=file, data={"features": ["debug", "unwind"]})

        file = self.create_file(
            name="crash.dsym", checksum="2b92c5472f4442a27da02509951ea2e0f529511c"
        )
        dif2, created2 = self.create_dif(file=file, data={"features": ["debug"]})

        file = self.create_file(
            name="crash.dsym", checksum="3c60980275c4adc81a657f6aae00e11ed528b538"
        )
        dif3, created3 = self.create_dif(file=file, data={"features": []})

        # XXX: dif2 and dif3 would actually be redundant, but since they are more
        # recent than dif1 we keep both of them. This assumes that newer uploads
        # might contain more specific debug information and should therefore
        # receive precedence over older ones.
        assert created1 and created2 and created3
        assert ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif3.id).exists()

    def test_skip_redundant_dif(self) -> None:
        with open(self.file_path, "rb") as f:
            dif1, created1 = self.create_dif(fileobj=f)

        with open(self.file_path, "rb") as f:
            dif2, created2 = self.create_dif(fileobj=f)

        assert created1
        assert not created2
        assert dif1 == dif2

    def test_remove_redundant_dif(self) -> None:
        file = self.create_file(
            name="crash.dsym", checksum="dc1e3f3e411979d336c3057cce64294f3420f93a"
        )
        dif1, created1 = self.create_dif(file=file, data={"features": ["debug"]})

        file = self.create_file(
            name="crash.dsym", checksum="2b92c5472f4442a27da02509951ea2e0f529511c"
        )
        dif2, created2 = self.create_dif(file=file, data={"features": ["debug"]})

        assert created1 and created2
        assert not ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()


class DebugFilesClearTest(APITestCase):
    def test_simple_cache_clear(self) -> None:
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.writestr("proguard/%s.txt" % PROGUARD_UUID, PROGUARD_SOURCE)
        f.writestr("ignored-file.txt", b"This is just some stuff")
        f.close()

        response = self.client.post(
            url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )

        assert response.status_code == 201, response.content
        assert len(response.data) == 1
        assert response.data[0]["headers"] == {"Content-Type": "text/x-proguard+plain"}
        assert response.data[0]["sha1"] == "e6d3c5185dac63eddfdc1a5edfffa32d46103b44"
        assert response.data[0]["uuid"] == PROGUARD_UUID
        assert response.data[0]["objectName"] == "proguard-mapping"
        assert response.data[0]["cpuName"] == "any"
        assert response.data[0]["symbolType"] == "proguard"

        difs = ProjectDebugFile.difcache.fetch_difs(
            project=project, debug_ids=[PROGUARD_UUID], features=["mapping"]
        )
        assert len(difs) == 1
        assert os.path.isfile(difs[PROGUARD_UUID])

        # if we clear now, nothing happens
        ProjectDebugFile.difcache.clear_old_entries()
        assert os.path.isfile(difs[PROGUARD_UUID])

        # Put the time into the future
        real_time = time.time
        time.time = lambda: real_time() + 60 * 60 * 48
        try:
            ProjectDebugFile.difcache.clear_old_entries()
        finally:
            time.time = real_time

        # But it's gone now
        assert not os.path.isfile(difs[PROGUARD_UUID])


@pytest.mark.parametrize(
    ("path", "name", "uuid"),
    (
        (
            "/proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
            None,
            "00000000-0000-0000-0000-000000000000",
        ),
        (
            "/proguard/00000000-0000-0000-0000-000000000000.txt",
            None,
            "00000000-0000-0000-0000-000000000000",
        ),
        (
            "/var/folders/x5/zw3gnf_x3ts0dwg56362ftrw0000gn/T/tmpbs2r93sr",
            "/proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
            "00000000-0000-0000-0000-000000000000",
        ),
        (
            "/var/folders/x5/zw3gnf_x3ts0dwg56362ftrw0000gn/T/tmpbs2r93sr",
            "/proguard/00000000-0000-0000-0000-000000000000.txt",
            "00000000-0000-0000-0000-000000000000",
        ),
    ),
)
def test_proguard_files_detected(path: str, name: str | None, uuid: str) -> None:
    # ProGuard files are detected by the path/name, not the file contents.
    # So, the ProGuard check should not depend on the file existing.
    detected = detect_dif_from_path(path, name)

    assert len(detected) == 1

    (dif_meta,) = detected
    assert dif_meta.file_format == "proguard"
    assert dif_meta.debug_id == uuid
    assert dif_meta.data == {"features": ["mapping"]}


@pytest.mark.parametrize(
    ("path", "name"),
    (
        ("/var/folders/x5/zw3gnf_x3ts0dwg56362ftrw0000gn/T/tmpbs2r93sr", None),
        ("/var/folders/x5/zw3gnf_x3ts0dwg56362ftrw0000gn/T/tmpbs2r93sr", "not-a-proguard-file.txt"),
        (
            # Note: "/" missing from beginning of path
            "proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
            None,
        ),
        (
            "/var/folders/x5/zw3gnf_x3ts0dwg56362ftrw0000gn/T/tmpbs2r93sr",
            # Note: "/" missing from beginning of path
            "proguard/mapping-00000000-0000-0000-0000-000000000000.txt",
        ),
    ),
)
def test_proguard_file_not_detected(path: str, name: str | None) -> None:
    with pytest.raises(FileNotFoundError):
        # If the file is not detected as a ProGuard file, detect_dif_from_path
        # attempts to open the file, which probably doesn't exist.
        # Note that if the path or name does exist as a file on the filesystem,
        # this test will fail.
        detect_dif_from_path(path, name)


def test_dartsymbolmap_file_detected() -> None:
    """Test that dartsymbolmap files are properly detected and validated."""
    # Create a temporary dartsymbolmap file (array format)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as f:
        f.write('["ExceptionClass", "xyz", "DatabaseError", "abc"]')
        f.flush()

        detected = detect_dif_from_path(
            f.name, name="dartsymbolmap.json", debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75"
        )

        assert len(detected) == 1
        dif_meta = detected[0]

        assert dif_meta.file_format == "dartsymbolmap"
        assert dif_meta.arch == "any"
        assert dif_meta.debug_id == "b8e43a-f242-3d73-a453-aeb6a777ef75"
        assert dif_meta.name == "dartsymbolmap.json"
        assert dif_meta.data == {"features": ["mapping"]}


def test_dartsymbolmap_file_odd_array_fails() -> None:
    """Test that dartsymbolmap with odd number of elements fails."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as f:
        f.write('["one", "two", "three"]')  # Odd number of elements
        f.flush()

        from sentry.models.debugfile import BadDif

        with pytest.raises(
            BadDif, match="dartsymbolmap array must have an even number of elements"
        ):
            detect_dif_from_path(
                f.name, name="dartsymbolmap.json", debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75"
            )


def test_dartsymbolmap_file_dict_format() -> None:
    """Test that dict format JSON files are detected as Il2Cpp, not dartsymbolmap."""
    # Note: Files starting with '{' are detected as Il2Cpp files, not dartsymbolmap
    # This is because determine_dif_kind() checks for '{' before '[' and assigns Il2Cpp
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as f:
        f.write('{"xyz": "ExceptionClass", "abc": "DatabaseError"}')
        f.flush()

        # This will be detected as Il2Cpp, not dartsymbolmap
        detected = detect_dif_from_path(
            f.name, name="dartsymbolmap.json", debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75"
        )

        assert len(detected) == 1
        dif_meta = detected[0]

        # Should be detected as il2cpp, not dartsymbolmap
        assert dif_meta.file_format == "il2cpp"
        assert dif_meta.debug_id == "b8e43a-f242-3d73-a453-aeb6a777ef75"


def test_dartsymbolmap_file_invalid_json() -> None:
    """Test that invalid JSON fails for dartsymbolmap."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as f:
        f.write("[invalid json")
        f.flush()

        from sentry.models.debugfile import BadDif

        with pytest.raises(BadDif, match="Invalid dartsymbolmap:"):
            detect_dif_from_path(
                f.name, name="dartsymbolmap.json", debug_id="b8e43a-f242-3d73-a453-aeb6a777ef75"
            )


def test_dartsymbolmap_file_missing_debug_id() -> None:
    """Test that dartsymbolmap without debug_id fails."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as f:
        f.write('["one", "two"]')
        f.flush()

        from sentry.models.debugfile import BadDif

        with pytest.raises(BadDif, match="Missing debug_id for dartsymbolmap"):
            detect_dif_from_path(f.name, name="dartsymbolmap.json", debug_id=None)
