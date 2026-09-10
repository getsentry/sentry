from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson

from sentry.preprod.analytics import PreprodStatusCheckApprovalCreatedEvent
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.manifest import (
    ComparisonImageResult,
    ComparisonManifest,
    ComparisonPlan,
    ComparisonSummary,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.tasks import (
    ImageFingerprint,
    _build_comparison_fingerprints,
    _find_approved_sibling,
    _hash_only_diffs,
    _HashOnlyDiff,
    _try_auto_approve_snapshot,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_any_analytics_event,
    assert_not_analytics_event,
)
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

    def test_skipped_images_excluded_from_fingerprints(self):
        manifest = self._make_manifest(
            {
                "changed.png": ComparisonImageResult(
                    status="changed", head_hash="b", base_hash="c"
                ),
                "skipped.png": ComparisonImageResult(status="skipped", base_hash="e"),
            }
        )
        fps = _build_comparison_fingerprints(manifest)
        assert fps == {ImageFingerprint("changed.png", "changed", "b")}

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


class HashOnlyDiffsTest(TestCase):
    def test_identical_sets_return_empty_list(self):
        fps = {ImageFingerprint("a.png", "changed", "h1")}
        assert _hash_only_diffs(fps, set(fps)) == []

    def test_hash_only_difference_is_returned(self):
        head = {
            ImageFingerprint("a.png", "changed", "h1"),
            ImageFingerprint("b.png", "added", "same"),
        }
        sibling = {
            ImageFingerprint("a.png", "changed", "h2"),
            ImageFingerprint("b.png", "added", "same"),
        }
        assert _hash_only_diffs(head, sibling) == [_HashOnlyDiff("a.png", "h1", "h2")]

    def test_renamed_hash_only_difference_is_returned(self):
        head = {ImageFingerprint("new.png", "renamed", "h1", "old.png")}
        sibling = {ImageFingerprint("new.png", "renamed", "h2", "old.png")}
        assert _hash_only_diffs(head, sibling) == [_HashOnlyDiff("new.png", "h1", "h2")]

    def test_renamed_with_different_previous_name_is_structural(self):
        head = {ImageFingerprint("new.png", "renamed", "h1", "old.png")}
        sibling = {ImageFingerprint("new.png", "renamed", "h1", "other.png")}
        assert _hash_only_diffs(head, sibling) is None

    def test_status_difference_is_structural(self):
        head = {ImageFingerprint("a.png", "changed", "h1")}
        sibling = {ImageFingerprint("a.png", "added", "h1")}
        assert _hash_only_diffs(head, sibling) is None

    def test_extra_head_image_is_structural(self):
        head = {
            ImageFingerprint("a.png", "changed", "h1"),
            ImageFingerprint("b.png", "changed", "h9"),
        }
        sibling = {ImageFingerprint("a.png", "changed", "h1")}
        assert _hash_only_diffs(head, sibling) is None

    def test_missing_head_image_is_structural(self):
        head = {ImageFingerprint("a.png", "changed", "h1")}
        sibling = {
            ImageFingerprint("a.png", "changed", "h1"),
            ImageFingerprint("b.png", "removed"),
        }
        assert _hash_only_diffs(head, sibling) is None

    def test_removed_and_errored_never_produce_pairs(self):
        head = {ImageFingerprint("a.png", "removed"), ImageFingerprint("b.png", "errored")}
        sibling = {ImageFingerprint("a.png", "removed"), ImageFingerprint("b.png", "errored")}
        assert _hash_only_diffs(head, sibling) == []

    def test_pairs_are_sorted_by_name(self):
        head = {
            ImageFingerprint("z.png", "changed", "z1"),
            ImageFingerprint("a.png", "changed", "a1"),
        }
        sibling = {
            ImageFingerprint("z.png", "changed", "z2"),
            ImageFingerprint("a.png", "changed", "a2"),
        }
        assert _hash_only_diffs(head, sibling) == [
            _HashOnlyDiff("a.png", "a1", "a2"),
            _HashOnlyDiff("z.png", "z1", "z2"),
        ]


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

    def _create_head_artifact(self, pr_number: int = 42) -> PreprodArtifact:
        cc = self.create_commit_comparison(
            organization=self.organization,
            pr_number=pr_number,
            head_repo_name="owner/repo",
        )
        return self.create_preprod_artifact(
            project=self.project,
            commit_comparison=cc,
            app_id="com.example.app",
        )

    def _plan(self, sibling: PreprodArtifact | None, comparison_key: str | None) -> ComparisonPlan:
        return ComparisonPlan(
            head_artifact_id=999,
            base_artifact_id=998,
            chunks=[],
            non_diff_images={},
            sibling_artifact_id=sibling.id if sibling else None,
            sibling_comparison_key=comparison_key,
        )

    def _approve(
        self,
        head_artifact: PreprodArtifact,
        head_manifest: ComparisonManifest,
        plan: ComparisonPlan,
        session: MagicMock,
        sibling_images: dict[str, ComparisonImageResult] | None = None,
    ) -> None:
        _try_auto_approve_snapshot(
            head_artifact, head_manifest, plan, sibling_images or {}, session
        )

    def test_find_approved_sibling_returns_human_sibling_manifest(self):
        images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
        }
        human_sibling, human_key, human_json = self._create_approved_sibling(
            pr_number=42, comparison_images=images
        )
        auto_sibling, auto_key, auto_json = self._create_approved_sibling(
            pr_number=42, comparison_images=images
        )
        PreprodComparisonApproval.objects.filter(preprod_artifact=auto_sibling).update(
            extras={"auto_approval": True, "prev_approved_artifact_id": human_sibling.id}
        )
        head_artifact = self._create_head_artifact()
        session = _mock_session_with_manifests({human_key: human_json, auto_key: auto_json})

        sibling = _find_approved_sibling(head_artifact, session)

        assert sibling is not None
        assert sibling.artifact_id == human_sibling.id
        assert sibling.comparison_key == human_key
        assert set(sibling.manifest.images) == {"screen1.png"}
        session.get.assert_called_once_with(human_key)

    def test_find_approved_sibling_returns_none_without_pr(self):
        cc = self.create_commit_comparison(organization=self.organization, pr_number=None)
        head_artifact = self.create_preprod_artifact(
            project=self.project, commit_comparison=cc, app_id="com.example.app"
        )
        assert _find_approved_sibling(head_artifact, MagicMock()) is None

    @patch("sentry.analytics.record")
    def test_auto_approves_when_fingerprints_match(self, mock_analytics):
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
        self._approve(head_artifact, head_manifest, self._plan(sibling, comp_key), session)

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
        assert approval.extras["threshold_matched_image_count"] == 0

        assert_any_analytics_event(
            mock_analytics,
            PreprodStatusCheckApprovalCreatedEvent(
                organization_id=self.organization.id,
                project_id=self.project.id,
                artifact_id=head_artifact.id,
                product="snapshots",
                source="auto",
            ),
        )

    @patch("sentry.analytics.record")
    def test_no_auto_approve_when_fingerprints_differ(self, mock_analytics):
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
        }
        sibling, comp_key, comp_json = self._create_approved_sibling(
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
                "screen2.png": ComparisonImageResult(status="added", head_hash="new"),
            }
        )

        session = _mock_session_with_manifests({comp_key: comp_json})
        self._approve(head_artifact, head_manifest, self._plan(sibling, comp_key), session)

        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

        assert_not_analytics_event(mock_analytics, PreprodStatusCheckApprovalCreatedEvent)

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
        self._approve(head_artifact, head_manifest, self._plan(None, None), session)
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
        self._approve(head_artifact, head_manifest, self._plan(None, None), session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_no_auto_approve_when_no_changes(self):
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images={
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="abc", base_hash="old1"
                ),
            },
        )
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="unchanged", head_hash="a", base_hash="a"
                ),
            }
        )
        session = MagicMock()
        self._approve(head_artifact, head_manifest, self._plan(sibling, comp_key), session)
        assert not PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()
        session.get.assert_not_called()

    def test_handles_missing_comparison_manifest(self):
        sibling, comp_key, _ = self._create_approved_sibling(
            pr_number=42,
            comparison_images={
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="abc", base_hash="old1"
                ),
            },
        )
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(status="changed", head_hash="abc"),
            }
        )

        session = MagicMock()
        session.get.side_effect = Exception("Not found")
        self._approve(head_artifact, head_manifest, self._plan(sibling, comp_key), session)
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

        head_artifact = self._create_head_artifact()

        assert _find_approved_sibling(head_artifact, MagicMock()) is None

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

        head_artifact = self._create_head_artifact()

        assert _find_approved_sibling(head_artifact, MagicMock()) is None

    def test_auto_approves_with_renamed_images(self):
        shared_images = {
            "new_name.png": ComparisonImageResult(
                status="renamed", head_hash="abc", previous_image_file_name="old_name.png"
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
                "new_name.png": ComparisonImageResult(
                    status="renamed", head_hash="abc", previous_image_file_name="old_name.png"
                ),
            }
        )

        session = _mock_session_with_manifests({comp_key: comp_json})
        self._approve(head_artifact, head_manifest, self._plan(sibling, comp_key), session)
        assert PreprodComparisonApproval.objects.filter(
            preprod_artifact=head_artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

    def test_auto_approves_selective_build_against_full_build(self):
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
            "screen2.png": ComparisonImageResult(
                status="unchanged", head_hash="same", base_hash="same"
            ),
            "screen3.png": ComparisonImageResult(
                status="unchanged", head_hash="same2", base_hash="same2"
            ),
        }
        sibling, comp_key, comp_json = self._create_approved_sibling(
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
                    status="changed", head_hash="abc", base_hash="old1"
                ),
                "screen2.png": ComparisonImageResult(
                    status="unchanged", head_hash="same", base_hash="same"
                ),
                "screen3.png": ComparisonImageResult(status="skipped", base_hash="same2"),
            }
        )

        session = _mock_session_with_manifests({comp_key: comp_json})
        self._approve(head_artifact, head_manifest, self._plan(sibling, comp_key), session)

        approval = PreprodComparisonApproval.objects.get(
            preprod_artifact=head_artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )
        assert approval.extras is not None
        assert approval.extras["auto_approval"] is True
        assert approval.extras["prev_approved_artifact_id"] == sibling.id

    @patch("sentry.analytics.record")
    def test_auto_approves_when_sibling_results_unchanged(self, mock_analytics):
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images={
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="sibling-hash", base_hash="old1"
                ),
            },
        )
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="head-hash", base_hash="old1"
                ),
            }
        )
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="unchanged",
                head_hash="head-hash",
                base_hash="sibling-hash",
                changed_pixels=3,
                total_pixels=10000,
            )
        }
        session = _mock_session_with_manifests({comp_key: comp_json})

        self._approve(
            head_artifact, head_manifest, self._plan(sibling, comp_key), session, sibling_images
        )

        approval = PreprodComparisonApproval.objects.get(preprod_artifact=head_artifact)
        assert approval.extras is not None
        assert approval.extras["auto_approval"] is True
        assert approval.extras["prev_approved_artifact_id"] == sibling.id
        assert approval.extras["threshold_matched_image_count"] == 1
        session.get.assert_called_once_with(comp_key)
        assert_any_analytics_event(
            mock_analytics,
            PreprodStatusCheckApprovalCreatedEvent(
                organization_id=self.organization.id,
                project_id=self.project.id,
                artifact_id=head_artifact.id,
                product="snapshots",
                source="auto",
            ),
        )

    def test_no_auto_approve_when_sibling_result_changed(self):
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images={
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="sibling-hash", base_hash="old1"
                ),
            },
        )
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="head-hash", base_hash="old1"
                ),
            }
        )
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="head-hash", base_hash="sibling-hash"
            )
        }
        self._approve(
            head_artifact,
            head_manifest,
            self._plan(sibling, comp_key),
            _mock_session_with_manifests({comp_key: comp_json}),
            sibling_images,
        )
        assert not PreprodComparisonApproval.objects.filter(preprod_artifact=head_artifact).exists()

    def test_no_auto_approve_when_sibling_result_missing(self):
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images={
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="sibling-hash", base_hash="old1"
                ),
            },
        )
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="head-hash", base_hash="old1"
                ),
            }
        )
        self._approve(
            head_artifact,
            head_manifest,
            self._plan(sibling, comp_key),
            _mock_session_with_manifests({comp_key: comp_json}),
            {},
        )
        assert not PreprodComparisonApproval.objects.filter(preprod_artifact=head_artifact).exists()

    def test_no_auto_approve_when_sibling_result_hashes_mismatch(self):
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images={
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="sibling-hash", base_hash="old1"
                ),
            },
        )
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="head-hash", base_hash="old1"
                ),
            }
        )
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="unchanged", head_hash="stale-head", base_hash="sibling-hash"
            )
        }
        self._approve(
            head_artifact,
            head_manifest,
            self._plan(sibling, comp_key),
            _mock_session_with_manifests({comp_key: comp_json}),
            sibling_images,
        )
        assert not PreprodComparisonApproval.objects.filter(preprod_artifact=head_artifact).exists()

    def test_no_auto_approve_when_plan_has_no_sibling(self):
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {"screen1.png": ComparisonImageResult(status="changed", head_hash="h", base_hash="b")}
        )
        session = MagicMock()
        self._approve(head_artifact, head_manifest, self._plan(None, None), session)
        assert not PreprodComparisonApproval.objects.filter(preprod_artifact=head_artifact).exists()
        session.get.assert_not_called()

    def test_no_auto_approve_when_status_differs_even_if_pixels_match(self):
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42,
            comparison_images={
                "screen1.png": ComparisonImageResult(status="added", head_hash="sibling-hash"),
            },
        )
        head_artifact = self._create_head_artifact()
        head_manifest = self._create_head_manifest(
            {
                "screen1.png": ComparisonImageResult(
                    status="changed", head_hash="head-hash", base_hash="old1"
                ),
            }
        )
        sibling_images = {
            "screen1.png": ComparisonImageResult(
                status="unchanged", head_hash="head-hash", base_hash="sibling-hash"
            )
        }
        session = _mock_session_with_manifests({comp_key: comp_json})
        self._approve(
            head_artifact, head_manifest, self._plan(sibling, comp_key), session, sibling_images
        )

        assert not PreprodComparisonApproval.objects.filter(preprod_artifact=head_artifact).exists()
        session.get.assert_called_once_with(comp_key)

    def test_sibling_selection_skips_auto_approved_builds(self):
        images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
        }
        human_sibling, human_key, human_json = self._create_approved_sibling(
            pr_number=42, comparison_images=images
        )
        auto_sibling, auto_key, auto_json = self._create_approved_sibling(
            pr_number=42, comparison_images=images
        )
        PreprodComparisonApproval.objects.filter(preprod_artifact=auto_sibling).update(
            extras={"auto_approval": True, "prev_approved_artifact_id": human_sibling.id}
        )

        head_artifact = self._create_head_artifact()

        session = _mock_session_with_manifests({human_key: human_json, auto_key: auto_json})
        sibling = _find_approved_sibling(head_artifact, session)

        assert sibling is not None
        assert sibling.artifact_id == human_sibling.id
        session.get.assert_called_once_with(human_key)

    def test_sibling_selection_keeps_human_approval_with_other_extras(self):
        images = {
            "screen1.png": ComparisonImageResult(
                status="changed", head_hash="abc", base_hash="old1"
            ),
        }
        sibling, comp_key, comp_json = self._create_approved_sibling(
            pr_number=42, comparison_images=images
        )
        PreprodComparisonApproval.objects.filter(preprod_artifact=sibling).update(
            extras={"github_user_info": {"login": "reviewer"}}
        )

        head_artifact = self._create_head_artifact()

        session = _mock_session_with_manifests({comp_key: comp_json})
        result = _find_approved_sibling(head_artifact, session)

        assert result is not None
        assert result.artifact_id == sibling.id
        session.get.assert_called_once_with(comp_key)
