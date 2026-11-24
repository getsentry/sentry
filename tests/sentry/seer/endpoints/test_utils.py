import uuid

from rest_framework import status
from rest_framework.response import Response

from sentry.auth.access import from_user
from sentry.seer.endpoints.utils import ResolvedSeerRun, authorize_seer_run, resolve_seer_run
from sentry.seer.models.run import SeerAgentRun, SeerRunMirrorStatus
from sentry.testutils.cases import TestCase
from sentry.users.models.user import User


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

    def _authorize(
        self,
        user: User,
        *,
        scopes: set[str] | None = None,
        publish: bool = False,
        run_id: str = "555",
    ) -> ResolvedSeerRun | Response:
        return authorize_seer_run(
            run_id,
            self.organization,
            from_user(user, self.organization, scopes=scopes),
            user.id,
            publish=publish,
        )

    def _assert_forbidden(self, result: ResolvedSeerRun | Response) -> None:
        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_403_FORBIDDEN

    def test_issue_run_teammate_with_run_scope_allowed(self) -> None:
        self._issue_run(self.owner.id)

        assert isinstance(self._authorize(self.teammate), ResolvedSeerRun)

    def test_issue_run_ownerless_teammate_allowed(self) -> None:
        self._issue_run(None)

        assert isinstance(self._authorize(self.teammate), ResolvedSeerRun)

    def test_issue_run_member_without_run_scope_forbidden(self) -> None:
        self._issue_run(self.owner.id)

        self._assert_forbidden(
            self._authorize(self.teammate, scopes={"org:read", "project:read", "event:read"})
        )

    def test_issue_run_owner_without_run_scope_allowed(self) -> None:
        self._issue_run(self.owner.id)

        result = self._authorize(self.owner, scopes={"org:read", "event:read"})

        assert isinstance(result, ResolvedSeerRun)

    def test_issue_run_no_project_access_forbidden(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        outsider = self.create_user()
        self.create_member(organization=self.organization, user=outsider, teams=[])
        self._issue_run(self.owner.id)

        self._assert_forbidden(self._authorize(outsider))

    def test_ownerless_run_with_deleted_group_forbidden(self) -> None:
        self._issue_run(None)
        SeerAgentRun.objects.filter(run__seer_run_state_id=555).update(group_id=10**12)

        self._assert_forbidden(self._authorize(self.teammate))

    def test_publishing_on_issue_run_needs_owner_or_publish_scope(self) -> None:
        self._issue_run(self.owner.id)
        seer_only = {"org:read", "project:read", "seer:write"}

        assert isinstance(self._authorize(self.teammate, scopes=seer_only), ResolvedSeerRun)
        self._assert_forbidden(self._authorize(self.teammate, scopes=seer_only, publish=True))
        assert isinstance(self._authorize(self.teammate, publish=True), ResolvedSeerRun)
        assert isinstance(
            self._authorize(self.owner, scopes=seer_only, publish=True), ResolvedSeerRun
        )

    def test_personal_chat_owner_only(self) -> None:
        self.create_seer_run(seer_run_state_id=555, user_id=self.owner.id)

        assert isinstance(self._authorize(self.owner), ResolvedSeerRun)
        self._assert_forbidden(self._authorize(self.teammate))

    def test_owned_project_chat_stays_owner_only(self) -> None:
        run = self.create_seer_run(seer_run_state_id=555, user_id=self.owner.id)
        self.create_seer_agent_run(run=run, source="chat", project=self.project)

        self._assert_forbidden(self._authorize(self.teammate))

    def test_ownerless_automated_run_needs_run_scope(self) -> None:
        self.create_seer_run(seer_run_state_id=555, user_id=None)

        assert isinstance(self._authorize(self.teammate), ResolvedSeerRun)
        self._assert_forbidden(
            self._authorize(self.teammate, scopes={"org:read", "project:read", "event:read"})
        )

    def test_ownerless_project_run_needs_project_access(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        outsider = self.create_user()
        self.create_member(organization=self.organization, user=outsider, teams=[])
        run = self.create_seer_run(seer_run_state_id=555, user_id=None)
        self.create_seer_agent_run(run=run, source="investigation", project=self.project)

        assert isinstance(self._authorize(self.teammate), ResolvedSeerRun)
        self._assert_forbidden(self._authorize(outsider))

    def test_legacy_numeric_id_without_row_forbidden(self) -> None:
        self._assert_forbidden(self._authorize(self.owner))

    def test_pending_personal_chat_forbidden_before_status(self) -> None:
        run = self.create_seer_run(user_id=self.owner.id, seer_run_state_id=None)

        self._assert_forbidden(self._authorize(self.teammate, run_id=str(run.uuid)))
        result = self._authorize(self.owner, run_id=str(run.uuid))
        assert isinstance(result, Response)
        assert result.status_code == status.HTTP_409_CONFLICT
