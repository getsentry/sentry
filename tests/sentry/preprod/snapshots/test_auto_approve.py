from __future__ import annotations

from unittest.mock import MagicMock

import orjson

from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.manifest import (
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonSummary,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.tasks import (
    ImageFingerprint,
    _build_comparison_fingerprints,
    _try_auto_approve_snapshot,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


class BuildComparisonFingerprintsTest(TestCase):
    def _make_manifest(self, images: dict[str, ComparisonImageResult]) -> ComparisonManifest:
        changed = sum(1 for i in images.values() if i.status == "changed")
        added = sum(1 for i in images.values() if i.status == "added")
        removed = sum(1 for i in images.values() if i.status == "removed")
        errored = sum(1 for i in images.values() if i.status == "errored")
        renamed = sum(1 for i in images.values() if i.status == "renamed")
        unchanged = sum(1 for i in images.values() if i.status == "unchanged")
        return ComparisonManifest(
            head_artifact_id=1,
            base_artifact_id=2,
            summary=ComparisonSummary(
                total=len(images),
                changed=changed,
                added=added,
                removed=removed,
                errored=errored,
                renamed=renamed,
                unchanged=unchanged,
            ),
            images=images,
        )

    def test_mixed_statuses(self):
        manifest = self._make_manifest(
            {
                "unchanged.png": ComparisonImageResult(
                    status="unchanged", head_hash="a", base_hash="a"
                ),
                "changed.png": ComparisonImageResult(
                    status="changed", head_hash="b", base_hash="c"
                ),
                "added.png": ComparisonImageResult(status="added", head_hash="d"),
                "removed.png": ComparisonImageResult(status="removed", base_hash="e"),
                "errored.png": ComparisonImageResult(status="errored"),
                "renamed.png": ComparisonImageResult(
                    status="renamed", head_hash="f", previous_image_file_name="old.png"
                ),
            }
        )
        fps = _build_comparison_fingerprints(manifest)
        assert fps == {
            ImageFingerprint("changed.png", "changed", "b"),
            ImageFingerprint("added.png", "added", "d"),
            ImageFingerprint("removed.png", "removed"),
            ImageFingerprint("errored.png", "errored"),
            ImageFingerprint("renamed.png", "renamed", "f", "old.png"),
        }

    def test_empty_manifest_returns_empty_set(self):
        manifest = self._make_manifest({})
        fps = _build_comparison_fingerprints(manifest)
        assert fps == set()

    def test_skips_changed_with_missing_head_hash(self):
        manifest = self._make_manifest(
            {
                "no_hash.png": ComparisonImageResult(status="changed", base_hash="abc"),
                "has_hash.png": ComparisonImageResult(
                    status="changed", head_hash="def", base_hash="ghi"
                ),
            }
        )
        fps = _build_comparison_fingerprints(manifest)
        assert fps == {ImageFingerprint("has_hash.png", "changed", "def")}

    def test_skips_renamed_with_missing_hash_or_previous_name(self):
        manifest = self._make_manifest(
            {
                "no_hash.png": ComparisonImageResult(
                    status="renamed", previous_image_file_name="old.png"
                ),
                "no_prev.png": ComparisonImageResult(status="renamed", head_hash="abc"),
                "valid.png": ComparisonImageResult(
                    status="renamed", head_hash="def", previous_image_file_name="old_valid.png"
                ),
            }
        )
        fps = _build_comparison_fingerprints(manifest)
        assert fps == {ImageFingerprint("valid.png", "renamed", "def", "old_valid.png")}


def _mock_session_with_manifests(manifests_by_key: dict[str, bytes]) -> MagicMock:
    session = MagicMock()

    def _get(key):
        result = MagicMock()
        if key in manifests_by_key:
            result.payload.read.return_value = manifests_by_key[key]
        else:
            raise Exception(f"Key not found: {key}")
        return result

    session.get.side_effect = _get
    return session


@cell_silo_test
class TryAutoApproveSnapshotTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _create_approved_sibling(
        self,
        pr_number: int,
        comparison_images: dict,
        app_id: str = "com.example.app",
        build_configuration=None,
    ) -> tuple[PreprodArtifact, str, bytes]:
        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=pr_number,
            head_repo_name="owner/repo",
        )
        artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id=app_id,
            build_configuration=build_configuration,
        )
        head_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=10,
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=self.create_commit_comparison(organization=self.organization),
        )
        base_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=base_artifact,
            image_count=10,
        )
        comparison_key = f"{self.organization.id}/{self.project.id}/{artifact.id}/{base_artifact.id}/comparison.json"
        PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.SUCCESS,
            images_changed=1,
            extras={"comparison_key": comparison_key},
        )
        PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )

        manifest = ComparisonManifest(
            head_artifact_id=artifact.id,
            base_artifact_id=base_artifact.id,
            summary=ComparisonSummary(
                total=len(comparison_images),
                changed=sum(1 for i in comparison_images.values() if i.status == "changed"),
                added=sum(1 for i in comparison_images.values() if i.status == "added"),
                removed=sum(1 for i in comparison_images.values() if i.status == "removed"),
                errored=sum(1 for i in comparison_images.values() if i.status == "errored"),
                renamed=sum(1 for i in comparison_images.values() if i.status == "renamed"),
                unchanged=sum(1 for i in comparison_images.values() if i.status == "unchanged"),
            ),
            images=comparison_images,
        )
        return artifact, comparison_key, orjson.dumps(manifest.dict())

    def _create_head_manifest(self, images: dict) -> ComparisonManifest:
        return ComparisonManifest(
            head_artifact_id=999,
            base_artifact_id=998,
            summary=ComparisonSummary(
                total=len(images),
                changed=sum(1 for i in images.values() if i.status == "changed"),
                added=sum(1 for i in images.values() if i.status == "added"),
                removed=sum(1 for i in images.values() if i.status == "removed"),
                errored=sum(1 for i in images.values() if i.status == "errored"),
                renamed=sum(1 for i in images.values() if i.status == "renamed"),
                unchanged=sum(1 for i in images.values() if i.status == "unchanged"),
            ),
            images=images,
        )

    def test_auto_approves_when_fingerprints_match(self):
        shared_images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
            "screen2.png": ComparisonImageResult(
                status="unchanged", head_hash="same", base_hash="same"
            ),
        }
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images=shared_images,
        )

        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )

        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="abc", base_hash="new_base1"
                ),
                "screen2.png": ComparisonImageResult(
                    status="unchanged", head_hash="same", base_hash="same"
                ),
                "screen3.png": ComparisonImageResult(
                    status="unchanged", head_hash="extra", base_hash="extra"
                ),
            }
        )

        session = _mock_session_with_manifests({comp_key: comp_json})
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)

        approval = PreprodComparisonApproval.objects.get(
            preprod_artifact=head_artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )
        assert approval.approved_by_id is None
        assert approval.approved_at is not None
        assert approval.extras is not None
        assert approval.extras["auto_approval"] is True
        assert approval.extras["prev_approved_artifact_id"] == sibling.id

    def test_no_auto_approve_when_fingerprints_differ(self):
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
        }
        _, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images=sibling_images,
        )

        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )

        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="DIFFERENT", base_hash="old1"
                ),
            }
        )

        session = _mock_session_with_manifests({comp_key: comp_json})
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)

        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_no_auto_approve_when_no_pr_number(self):
        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=None,
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
        )
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(status="changed", head_hash="abc"),
            }
        )
        session = MagicMock()
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_no_auto_approve_when_no_approved_sibling(self):
        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(status="changed", head_hash="abc"),
            }
        )
        session = MagicMock()
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_no_auto_approve_when_no_changes(self):
        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
        )
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="unchanged", head_hash="a", base_hash="a"
                ),
            }
        )
        session = MagicMock()
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_handles_missing_comparison_manifest(self):
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
        }
        _, comp_key, _ = self._create_approved_sibling(
            pr_number=42,
            comparison_images=sibling_images,
        )

        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(status="changed", head_hash="abc"),
            }
        )

        session = MagicMock()
        session.get.side_effect = Exception("Not found")
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_matches_on_app_id_and_build_config(self):
        shared_images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
        }
        self._create_approved_sibling(
            pr_number=42,
            comparison_images=shared_images,
            app_id="com.other.app",
        )

        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(status="changed", head_hash="abc"),
            }
        )
        session = MagicMock()
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_no_auto_approve_when_sibling_not_approved_for_snapshots(self):
        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        sibling = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )
        head_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=sibling,
            image_count=10,
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=self.create_commit_comparison(organization=self.organization),
        )
        base_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=base_artifact,
            image_count=10,
        )
        PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.SUCCESS,
            images_changed=1,
        )
        PreprodComparisonApproval.objects.create(
            preprod_artifact=sibling,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )

        cc2 = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc2,
            app_id="com.example.app",
        )
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(status="changed", head_hash="abc"),
            }
        )
        session = MagicMock()
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_auto_approves_with_renamed_images(self):
        shared_images = {
            "new_name.png": ComparisonImageResult(
                status="renamed", head_hash="abc", previous_image_file_name="old_name.png"
            ),
        }
        _, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images=shared_images,
        )

        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=42,
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )

        head_manifest = self._create_head_manifest(
            {
                "new_name.png": ComparisonImageResult(
                    status="renamed", head_hash="abc", previous_image_file_name="old_name.png"
                ),
            }
        )

        session = _mock_session_with_manifests({comp_key: comp_json})
        _try_auto_approve_snapshot(head_artifact, head_manifest, session)
        assert PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()
