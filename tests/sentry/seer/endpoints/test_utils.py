import uuid

from rest_framework import status
from rest_framework.response import Response

from sentry.auth.access import from_user
from sentry.seer.endpoints.utils import ResolvedSeerRun, authorize_seer_run, resolve_seer_run
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

    def test_user_scope_rejects_unmirrored_numeric_run(self) -> None:
        result = resolve_seer_run("555", self.organization, user_id=self.user.id)

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_403_FORBIDDEN

    def test_user_scope_rejects_another_users_numeric_run(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=555, user_id=self.user.id
        )
        other_user = self.create_user()

        result = resolve_seer_run(
            str(run.seer_run_state_id), self.organization, for_continue=True, user_id=other_user.id
        )

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_403_FORBIDDEN
        assert result.data == {"detail": "You do not have access to this run."}

    def test_user_scope_rejects_another_users_uuid_run(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=555, user_id=self.user.id
        )
        other_user = self.create_user()

        result = resolve_seer_run(
            str(run.uuid), self.organization, for_continue=True, user_id=other_user.id
        )

        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_403_FORBIDDEN
        assert result.data == {"detail": "You do not have access to this run."}

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


class AuthorizeSeerRunTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.teammate = self.create_user()
        self.create_member(organization=self.organization, user=self.owner, teams=[self.team])
        self.create_member(organization=self.organization, user=self.teammate, teams=[self.team])
        self.group = self.create_group(project=self.project)

    def _issue_run(self, user_id: int | None) -> None:
        run = self.create_seer_run(seer_run_state_id=555, user_id=user_id)
        self.create_seer_agent_run(run=run, source="autofix", group=self.group)

    def _authorize(self, user, *, write: bool, scopes=None):
        return authorize_seer_run(
            "555",
            self.organization,
            from_user(user, self.organization, scopes=scopes),
            user.id,
            for_continue=write,
            write=write,
        )

    def test_issue_run_teammate_with_event_write_can_write(self) -> None:
        self._issue_run(self.owner.id)

        assert isinstance(self._authorize(self.teammate, write=True), ResolvedSeerRun)

    def test_issue_run_ownerless_teammate_can_write(self) -> None:
        self._issue_run(None)

        assert isinstance(self._authorize(self.teammate, write=True), ResolvedSeerRun)

    def test_issue_run_member_without_write_scope_can_read_not_write(self) -> None:
        self._issue_run(self.owner.id)
        read_only = {"org:read", "project:read", "event:read"}

        assert isinstance(
            self._authorize(self.teammate, write=False, scopes=read_only), ResolvedSeerRun
        )
        result = self._authorize(self.teammate, write=True, scopes=read_only)
        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_403_FORBIDDEN

    def test_issue_run_no_project_access_forbidden(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        outsider = self.create_user()
        self.create_member(organization=self.organization, user=outsider, teams=[])
        self._issue_run(self.owner.id)

        for write in (False, True):
            result = self._authorize(outsider, write=write)
            assert isinstance(result, Response)
            assert result.status_code == status.HTTP_403_FORBIDDEN

    def test_personal_chat_owner_only(self) -> None:
        self.create_seer_run(seer_run_state_id=555, user_id=self.owner.id)

        for write in (False, True):
            assert isinstance(self._authorize(self.owner, write=write), ResolvedSeerRun)
            result = self._authorize(self.teammate, write=write)
            assert isinstance(result, Response)
            assert result.status_code == status.HTTP_403_FORBIDDEN

    def test_ownerless_non_issue_run_readable_not_writable(self) -> None:
        self.create_seer_run(seer_run_state_id=555, user_id=None)

        assert isinstance(self._authorize(self.teammate, write=False), ResolvedSeerRun)
        result = self._authorize(self.teammate, write=True)
        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_403_FORBIDDEN

    def test_legacy_numeric_id_without_row_readable_not_writable(self) -> None:
        assert self._authorize(self.owner, write=False) == ResolvedSeerRun(555, None)
        result = self._authorize(self.owner, write=True)
        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_403_FORBIDDEN
