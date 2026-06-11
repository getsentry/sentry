from __future__ import annotations

from unittest.mock import MagicMock

import orjson
from objectstore_client import RequestError

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.reconstruction import (
    fold_child_onto_parent,
    reconstruct_base_manifest,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


def _m(names_to_hashes, *, selective=False, all_image_file_names=None):
    return SnapshotManifest(
        images={
            n: ImageMetadata(content_hash=h, width=10, height=10)
            for n, h in names_to_hashes.items()
        },
        selective=selective,
        all_image_file_names=all_image_file_names,
    )


def test_fold_inherits_untouched_and_overlays_changed():
    parent = _m({"Help": "v0", "Feed": "v0", "Settings": "v0"})
    child = _m({"Feed": "v1"}, selective=True)  # changed Feed only
    resolved = fold_child_onto_parent(child, parent)
    assert {n: m.content_hash for n, m in resolved.images.items()} == {
        "Help": "v0",
        "Feed": "v1",
        "Settings": "v0",
    }
    assert resolved.selective is False


def test_fold_mode1_drops_removed_names():
    parent = _m({"Help": "v0", "Feed": "v0", "Old": "v0"})
    child = _m({"Feed": "v1"}, selective=True, all_image_file_names=["Help", "Feed"])
    resolved = fold_child_onto_parent(child, parent)
    assert set(resolved.images.keys()) == {"Help", "Feed"}  # "Old" dropped
    assert resolved.images["Feed"].content_hash == "v1"


def test_fold_mode2_keeps_phantom_on_rename():
    parent = _m({"old.png": "v0", "Keep": "v0"})
    child = _m({"new.png": "v0"}, selective=True)  # rename old->new, mode 2
    resolved = fold_child_onto_parent(child, parent)
    # Mode 2 cannot express removals: both names persist (documented limitation).
    assert set(resolved.images.keys()) == {"old.png", "new.png", "Keep"}


def _session(manifests_by_key: dict[str, bytes]) -> MagicMock:
    session = MagicMock()

    def _get(key):
        if key not in manifests_by_key:
            raise RequestError(f"Key not found: {key}", 404, "not found")
        result = MagicMock()
        result.payload.read.return_value = manifests_by_key[key]
        return result

    session.get.side_effect = _get
    return session


@cell_silo_test
class ReconstructBaseManifestTest(TestCase):
    def _commit(self, head_sha, base_sha):
        return CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="o/r",
            base_repo_name="o/r",
            head_sha=head_sha,
            base_sha=base_sha,
            provider="github",
        )

    def _build(self, head_sha, base_sha, images, *, selective, key):
        cc = self._commit(head_sha, base_sha)
        artifact = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc
        )
        metrics = self.create_preprod_snapshot_metrics(artifact, is_selective=selective)
        metrics.extras = {"manifest_key": key}
        metrics.save()
        manifest = _m(images, selective=selective)
        return artifact, key, orjson.dumps(manifest.dict())

    def test_non_selective_base_returns_as_is(self):
        artifact, key, blob = self._build(
            "h_main", None, {"a": "v0"}, selective=False, key="k_main"
        )
        result = reconstruct_base_manifest(artifact, _session({key: blob}))
        assert result.unresolvable is False and result.incomplete is False
        assert result.manifest is not None
        assert {n: m.content_hash for n, m in result.manifest.images.items()} == {"a": "v0"}

    def test_three_deep_carries_pr1_change(self):
        a_main, k_main, b_main = self._build(
            "h_main",
            None,
            {"Help": "v0", "Feed": "v0", "Settings": "v0"},
            selective=False,
            key="k_main",
        )
        a_pr1, k_pr1, b_pr1 = self._build(
            "h_pr1", "h_main", {"Feed": "v1"}, selective=True, key="k_pr1"
        )
        a_pr2, k_pr2, b_pr2 = self._build(
            "h_pr2", "h_pr1", {"Help": "v2"}, selective=True, key="k_pr2"
        )
        session = _session({k_main: b_main, k_pr1: b_pr1, k_pr2: b_pr2})
        result = reconstruct_base_manifest(a_pr2, session)
        assert result.incomplete is False and result.unresolvable is False
        assert result.manifest is not None
        assert {n: m.content_hash for n, m in result.manifest.images.items()} == {
            "Help": "v2",
            "Feed": "v1",  # PR1's change carried forward, NOT main's v0
            "Settings": "v0",
        }

    def test_missing_ancestor_manifest_is_incomplete(self):
        a_main, k_main, b_main = self._build(
            "h_main", None, {"a": "v0"}, selective=False, key="k_main"
        )
        a_pr1, k_pr1, b_pr1 = self._build(
            "h_pr1", "h_main", {"a": "v1"}, selective=True, key="k_pr1"
        )
        # main's manifest blob is absent from the session -> incomplete.
        session = _session({k_pr1: b_pr1})
        result = reconstruct_base_manifest(a_pr1, session)
        assert result.incomplete is True
        assert result.manifest is None

    def test_no_non_selective_ancestor_is_unresolvable(self):
        # selective build whose base_sha is null -> no complete reference exists.
        a_pr1, k_pr1, b_pr1 = self._build("h_pr1", None, {"a": "v1"}, selective=True, key="k_pr1")
        result = reconstruct_base_manifest(a_pr1, _session({k_pr1: b_pr1}))
        assert result.unresolvable is True
        assert result.manifest is None

    def test_cycle_in_chain_is_unresolvable(self):
        # A's base points at B, B's base points back at A -> cycle -> unresolvable.
        a, k_a, b_a = self._build("h_a", "h_b", {"x": "v1"}, selective=True, key="k_a")
        b, k_b, b_b = self._build("h_b", "h_a", {"y": "v1"}, selective=True, key="k_b")
        result = reconstruct_base_manifest(a, _session({k_a: b_a, k_b: b_b}))
        assert result.unresolvable is True
        assert result.manifest is None

    def test_resolves_ancestor_when_base_repo_name_is_null(self):
        # Non-fork PR: the child's commit_comparison has base_repo_name=None. The ancestor
        # must still be found via the head_repo_name fallback.
        a_main, k_main, b_main = self._build(
            "h_main", None, {"a": "v0"}, selective=False, key="k_main"
        )
        cc_pr1 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="o/r",
            base_repo_name=None,
            head_sha="h_pr1",
            base_sha="h_main",
            provider="github",
        )
        a_pr1 = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc_pr1
        )
        m_pr1 = self.create_preprod_snapshot_metrics(a_pr1, is_selective=True)
        m_pr1.extras = {"manifest_key": "k_pr1"}
        m_pr1.save()
        b_pr1 = orjson.dumps(_m({"a": "v1"}, selective=True).dict())
        result = reconstruct_base_manifest(a_pr1, _session({k_main: b_main, "k_pr1": b_pr1}))
        assert result.incomplete is False and result.unresolvable is False
        assert result.manifest is not None
        assert {n: m.content_hash for n, m in result.manifest.images.items()} == {"a": "v1"}

    def test_corrupt_ancestor_manifest_is_unresolvable(self):
        # A corrupt ancestor manifest is permanent — it will never become valid by waiting,
        # so it must terminate (unresolvable) immediately rather than deferring through the
        # whole grace window and failing as a misleading TIMEOUT.
        a_main, k_main, b_main = self._build(
            "h_main", None, {"a": "v0"}, selective=False, key="k_main"
        )
        a_pr1, k_pr1, b_pr1 = self._build(
            "h_pr1", "h_main", {"a": "v1"}, selective=True, key="k_pr1"
        )
        session = _session({k_main: b"not-valid-json{{{", k_pr1: b_pr1})
        result = reconstruct_base_manifest(a_pr1, session)
        assert result.unresolvable is True
        assert result.incomplete is False
        assert result.manifest is None
        assert result.error_message is not None

    def test_completeness_uses_manifest_flag_not_db_flag(self):
        # The manifest is the single source of truth for "is this a complete anchor".
        # Here the DB flag (is_selective=False) DISAGREES with the manifest
        # (selective=True). The walk must trust the manifest and fold this build as a
        # selective layer onto main, NOT treat its partial manifest as the complete base.
        a_main, k_main, b_main = self._build(
            "h_main", None, {"x": "v0", "y": "v0"}, selective=False, key="k_main"
        )
        cc = self._commit("h_x", "h_main")
        a_x = self.create_preprod_artifact(
            project=self.project, app_id="com.x", commit_comparison=cc
        )
        # DB says full (drift), manifest says selective (the truth: only "x" uploaded).
        m_x = self.create_preprod_snapshot_metrics(a_x, is_selective=False)
        m_x.extras = {"manifest_key": "k_x"}
        m_x.save()
        b_x = orjson.dumps(_m({"x": "v1"}, selective=True).dict())

        result = reconstruct_base_manifest(a_x, _session({k_main: b_main, "k_x": b_x}))

        assert result.incomplete is False and result.unresolvable is False
        assert result.manifest is not None
        # Folded onto main: x overlaid (v1), y inherited (v0). If the walk had trusted the
        # DB flag it would have returned only {"x": "v1"} (the partial manifest as-is).
        assert {n: m.content_hash for n, m in result.manifest.images.items()} == {
            "x": "v1",
            "y": "v0",
        }
