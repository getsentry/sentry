from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson
import pytest
from objectstore_client.client import RequestError

from sentry.preprod.models import PreprodArtifact, PreprodSnapshotComparison
from sentry.preprod.snapshots.image_diff.types import DiffResult
from sentry.preprod.snapshots.tasks import _retry_objectstore, compare_snapshots
from sentry.testutils.cases import TestCase

TASKS = "sentry.preprod.snapshots.tasks"


class RetryObjectstoreTest(TestCase):
    def test_retries_once_then_succeeds_on_429(self) -> None:
        calls = []

        def op() -> str:
            calls.append(1)
            if len(calls) < 2:
                raise RequestError("rate limited", status=429, response="")
            return "ok"

        with patch("sentry.preprod.snapshots.tasks.time.sleep"):
            assert _retry_objectstore(op) == "ok"
        assert len(calls) == 2

    def test_gives_up_after_one_retry(self) -> None:
        calls = []

        def op() -> str:
            calls.append(1)
            raise RequestError("rate limited", status=429, response="")

        with patch("sentry.preprod.snapshots.tasks.time.sleep"), pytest.raises(RequestError):
            _retry_objectstore(op)
        assert len(calls) == 2

    def test_does_not_retry_non_transient_status(self) -> None:
        calls = []

        def op() -> str:
            calls.append(1)
            raise RequestError("not found", status=404, response="")

        with pytest.raises(RequestError):
            _retry_objectstore(op)
        assert len(calls) == 1


def _manifest_bytes(images: dict[str, str]) -> bytes:
    return orjson.dumps(
        {
            "images": {
                name: {"content_hash": h, "width": 10, "height": 10} for name, h in images.items()
            },
            "selective": False,
            "all_image_file_names": None,
        }
    )


def _diff_result(changed_pixels: int) -> DiffResult:
    return DiffResult(
        diff_mask_png=b"\x89PNGfake",
        changed_pixels=changed_pixels,
        total_pixels=100,
        aligned_height=10,
        before_width=10,
        before_height=10,
        after_width=10,
        after_height=10,
    )


class CompareSnapshotsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.head_artifact = self.create_preprod_artifact(
            project=self.project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        self.base_artifact = self.create_preprod_artifact(
            project=self.project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        self.head_key = (
            f"{self.organization.id}/{self.project.id}/{self.head_artifact.id}/manifest.json"
        )
        self.base_key = (
            f"{self.organization.id}/{self.project.id}/{self.base_artifact.id}/manifest.json"
        )
        # The factory does not accept extras=; set manifest_key explicitly after creation.
        self.head_metrics = self.create_preprod_snapshot_metrics(self.head_artifact)
        self.head_metrics.extras = {"manifest_key": self.head_key}
        self.head_metrics.save()
        self.base_metrics = self.create_preprod_snapshot_metrics(self.base_artifact)
        self.base_metrics.extras = {"manifest_key": self.base_key}
        self.base_metrics.save()

    def _make_session(self, head_images: dict[str, str], base_images: dict[str, str]) -> MagicMock:
        manifests = {
            self.head_key: _manifest_bytes(head_images),
            self.base_key: _manifest_bytes(base_images),
        }

        def _get(key: str) -> MagicMock:
            result = MagicMock()
            if key in manifests:
                result.payload.read.return_value = manifests[key]
            else:  # image fetch: f"{org}/{project}/{hash}"
                result.payload.read.return_value = b"imgbytes"
            return result

        session = MagicMock()
        session.get.side_effect = _get
        return session

    def _run(self, session: MagicMock, diff_results: list[DiffResult | None]) -> None:
        with (
            patch(f"{TASKS}.get_preprod_session", return_value=session),
            patch(f"{TASKS}.OdiffServer"),
            patch(f"{TASKS}.compare_images_batch", return_value=diff_results),
            patch(f"{TASKS}.update_preprod_snapshot_vcs"),
            patch(f"{TASKS}._try_auto_approve_snapshot"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=self.head_artifact.id,
                base_artifact_id=self.base_artifact.id,
            )

    def test_compare_snapshots_success_serial(self) -> None:
        session = self._make_session(
            head_images={"a.png": "h1", "b.png": "same"},
            base_images={"a.png": "h0", "b.png": "same"},
        )
        self._run(session, diff_results=[_diff_result(changed_pixels=50)])

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics=self.head_metrics, base_snapshot_metrics=self.base_metrics
        )
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 1
        assert comparison.images_unchanged == 1
        put_keys = [c.kwargs.get("key") for c in session.put.call_args_list]
        assert any("/diff/" in (k or "") for k in put_keys)
        assert any(k and k.endswith("comparison.json") for k in put_keys)

    def test_compare_snapshots_spawns_n_servers_for_many_batches(self) -> None:
        session = self._make_session(
            head_images={f"img{i}.png": f"h{i}a" for i in range(6)},
            base_images={f"img{i}.png": f"h{i}b" for i in range(6)},
        )
        with (
            patch(f"{TASKS}.get_preprod_session", return_value=session),
            patch(f"{TASKS}.OdiffServer") as mock_server,
            patch(
                f"{TASKS}.compare_images_batch",
                side_effect=lambda pairs, server=None: [_diff_result(5) for _ in pairs],
            ),
            patch(f"{TASKS}.update_preprod_snapshot_vcs"),
            patch(f"{TASKS}._try_auto_approve_snapshot"),
            patch(f"{TASKS}.MAX_PIXELS_PER_BATCH", 100),
            self.options({"preprod.snapshots.odiff-worker-count": 3}),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=self.head_artifact.id,
                base_artifact_id=self.base_artifact.id,
            )
        # 6 images at 100px each -> 1 pair per batch -> 6 batches; min(3, 6) == 3 servers
        assert mock_server.call_count == 3
        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics=self.head_metrics, base_snapshot_metrics=self.base_metrics
        )
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 6

    def test_compare_snapshots_logs_odiff_phase_summary(self) -> None:
        session = self._make_session(
            head_images={"a.png": "h1", "b.png": "same"},
            base_images={"a.png": "h0", "b.png": "same"},
        )
        with (
            patch(f"{TASKS}.get_preprod_session", return_value=session),
            patch(f"{TASKS}.OdiffServer"),
            patch(f"{TASKS}.compare_images_batch", return_value=[_diff_result(50)]),
            patch(f"{TASKS}.update_preprod_snapshot_vcs"),
            patch(f"{TASKS}._try_auto_approve_snapshot"),
            patch(f"{TASKS}.logger") as mock_logger,
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=self.head_artifact.id,
                base_artifact_id=self.base_artifact.id,
            )
        messages = [c.args[0] for c in mock_logger.info.call_args_list]
        assert "compare_snapshots: odiff phase complete" in messages

    def test_compare_snapshots_batch_failure_is_isolated(self) -> None:
        session = self._make_session(
            head_images={"a.png": "h1"},
            base_images={"a.png": "h0"},
        )

        def _put(data, key=None, content_type=None):
            if "/diff/" in (key or ""):
                raise RuntimeError("mask upload failed")
            return MagicMock()

        session.put.side_effect = _put
        with (
            patch(f"{TASKS}.get_preprod_session", return_value=session),
            patch(f"{TASKS}.OdiffServer"),
            patch(f"{TASKS}.compare_images_batch", return_value=[_diff_result(5)]),
            patch(f"{TASKS}.update_preprod_snapshot_vcs"),
            patch(f"{TASKS}._try_auto_approve_snapshot"),
        ):
            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=self.head_artifact.id,
                base_artifact_id=self.base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics=self.head_metrics, base_snapshot_metrics=self.base_metrics
        )
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 0
        comparison_json = next(
            c.args[0]
            for c in session.put.call_args_list
            if (c.kwargs.get("key") or "").endswith("comparison.json")
        )
        images = orjson.loads(comparison_json)["images"]
        assert images["a.png"]["status"] == "errored"

    def test_compare_snapshots_per_image_processing_failure(self) -> None:
        session = self._make_session(
            head_images={"a.png": "h1", "b.png": "h3"},
            base_images={"a.png": "h0", "b.png": "h2"},
        )
        # both pairs change; odiff yields a result for a.png and None (failed) for b.png
        self._run(session, diff_results=[_diff_result(50), None])

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics=self.head_metrics, base_snapshot_metrics=self.base_metrics
        )
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 1
        comparison_json = next(
            c.args[0]
            for c in session.put.call_args_list
            if (c.kwargs.get("key") or "").endswith("comparison.json")
        )
        images = orjson.loads(comparison_json)["images"]
        assert images["a.png"]["status"] == "changed"
        assert images["b.png"]["status"] == "errored"
        assert images["b.png"]["reason"] == "image_processing_failed"

    def test_compare_snapshots_retries_rate_limited_manifest(self) -> None:
        session = self._make_session(
            head_images={"a.png": "h1"},
            base_images={"a.png": "h0"},
        )
        underlying_get = session.get.side_effect
        state = {"throttled": False}

        def flaky_get(key: str) -> MagicMock:
            if key == self.head_key and not state["throttled"]:
                state["throttled"] = True
                raise RequestError("rate limited", status=429, response="")
            return underlying_get(key)

        session.get.side_effect = flaky_get
        with patch("sentry.preprod.snapshots.tasks.time.sleep"):
            self._run(session, diff_results=[_diff_result(50)])

        assert state["throttled"]  # the 429 was hit and retried, not fatal
        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics=self.head_metrics, base_snapshot_metrics=self.base_metrics
        )
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
