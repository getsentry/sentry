import uuid

from rest_framework import status
from rest_framework.response import Response

from sentry.seer.endpoints.utils import ResolvedSeerRun, resolve_seer_run
from sentry.seer.models.run import SeerRunMirrorStatus
from sentry.testutils.cases import TestCase


class ResolveSeerRunTest(TestCase):
    """Branch matrix for ``resolve_seer_run``.

    Owned here so the endpoints that call it (explorer chat, search-agent, and
    soon explorer autofix) only need a thin integration smoke test for their own
    response shape rather than re-testing every branch.
    """

    def test_numeric_id_with_row_returns_uuid(self) -> None:
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=555)

        result = resolve_seer_run("555", self.organization)

        assert result == ResolvedSeerRun(555, str(run.uuid))

    def test_numeric_id_without_row_passes_through(self) -> None:
        # Legacy run created before SeerRun mirroring: no row exists, so we fall
        # back to a bare passthrough with a None uuid.
        result = resolve_seer_run("555", self.organization)

        assert result == ResolvedSeerRun(555, None)

    def test_numeric_id_from_other_org_passes_through(self) -> None:
        # A numeric id scoped to another org does NOT 404 here — the numeric path
        # is the legacy passthrough and authz is enforced downstream in Seer. We
        # just can't enrich it with the uuid, so it resolves with uuid None.
        other_org = self.create_organization()
        self.create_seer_run(organization=other_org, seer_run_state_id=555)

        result = resolve_seer_run("555", self.organization)

        assert result == ResolvedSeerRun(555, None)

    def test_uuid_resolves_when_mirrored(self) -> None:
        run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=555,
            mirror_status=SeerRunMirrorStatus.LIVE,
        )

        result = resolve_seer_run(str(run.uuid), self.organization)

        assert result == ResolvedSeerRun(555, str(run.uuid))

    def test_uuid_with_failed_mirror_returns_error_session(self) -> None:
        run = self.create_seer_run(
            organization=self.organization,
            mirror_status=SeerRunMirrorStatus.FAILED,
        )

        result = resolve_seer_run(str(run.uuid), self.organization)

        assert isinstance(result, Response)
        assert result.data == {"session": {"status": "error"}}

    def test_uuid_pending_mirror_returns_processing_session(self) -> None:
        run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=None,
            mirror_status=SeerRunMirrorStatus.PENDING,
        )

        result = resolve_seer_run(str(run.uuid), self.organization)

        assert isinstance(result, Response)
        assert result.data == {"session": {"status": "processing"}}

    def test_uuid_pending_mirror_for_continue_returns_409(self) -> None:
        run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=None,
            mirror_status=SeerRunMirrorStatus.PENDING,
        )

        result = resolve_seer_run(str(run.uuid), self.organization, for_continue=True)

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_409_CONFLICT

    def test_uuid_failed_mirror_for_continue_returns_422(self) -> None:
        run = self.create_seer_run(
            organization=self.organization,
            mirror_status=SeerRunMirrorStatus.FAILED,
        )

        result = resolve_seer_run(str(run.uuid), self.organization, for_continue=True)

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_unknown_uuid_returns_404(self) -> None:
        result = resolve_seer_run(str(uuid.uuid4()), self.organization)

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_404_NOT_FOUND
        assert result.data == {"session": None}

    def test_uuid_from_other_org_returns_404(self) -> None:
        other_org = self.create_organization()
        run = self.create_seer_run(organization=other_org, seer_run_state_id=555)

        result = resolve_seer_run(str(run.uuid), self.organization)

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_404_NOT_FOUND
        assert result.data == {"session": None}

    def test_oversized_numeric_id_returns_400(self) -> None:
        result = resolve_seer_run("99999999999999999999", self.organization)

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_400_BAD_REQUEST

    def test_garbage_id_returns_400(self) -> None:
        result = resolve_seer_run("not-a-real-id", self.organization)

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_400_BAD_REQUEST
        assert result.data == {"detail": "Invalid run_id"}

    def test_none_id_returns_400(self) -> None:
        result = resolve_seer_run(None, self.organization)  # type: ignore[arg-type]

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_400_BAD_REQUEST
