from __future__ import annotations

from typing import Any, Mapping

from sentry.models import AuditLogEntry, AuthIdentity, AuthProvider, Organization, Team, User
from sentry.services.hybrid_cloud.audit import AuditLogMetadata, AuditLogService
from sentry.services.hybrid_cloud.auth import ApiAuthIdentity, ApiAuthProvider
from sentry.services.hybrid_cloud.organization import ApiOrganizationMember
from sentry.services.hybrid_cloud.user import APIUser, user_service


class DatabaseBackedAuditLogService(AuditLogService):
    @staticmethod
    def _resolve_user(user: APIUser | int | None) -> User | None:
        if user is None:
            return None
        if isinstance(user, int):
            user_id = user
        else:
            user_id = user.id
        return User.objects.get(id=user_id)

    def write_audit_log(self, *, metadata: AuditLogMetadata, data: Mapping[str, Any]) -> None:
        organization = Organization.objects.get(id=metadata.organization.id)
        AuditLogEntry.objects.create(
            organization=organization,
            event=metadata.event,
            actor_label=metadata.actor_label,
            actor=self._resolve_user(metadata.actor),
            ip_address=metadata.ip_address,
            target_object=metadata.target_object,
            target_user=self._resolve_user(metadata.target_user),
            data=data,
        )

    def log_organization_membership(
        self, *, metadata: AuditLogMetadata, organization_member: ApiOrganizationMember
    ) -> None:
        user_id = organization_member.user_id
        assert user_id is not None
        user = user_service.get_user(user_id=user_id)
        assert user is not None

        team_ids = [mt.team_id for mt in organization_member.member_teams]
        team_slugs = list(Team.objects.filter(id__in=team_ids).values_list("slug", flat=True))

        data = {
            "email": user.email,
            "user": None,  # TODO,
            "teams": team_ids,
            "teams_slugs": team_slugs,
            "has_global_access": organization_member.has_global_access,
            "role": organization_member.role,
            "invite_status": None,  # TODO
        }
        return self.write_audit_log(metadata=metadata, data=data)

    def log_auth_provider(self, *, metadata: AuditLogMetadata, provider: ApiAuthProvider) -> None:
        model = AuthProvider.objects.get(id=provider.id)
        data = model.get_audit_log_data()
        return self.write_audit_log(metadata=metadata, data=data)

    def log_auth_identity(
        self, *, metadata: AuditLogMetadata, auth_identity: ApiAuthIdentity
    ) -> None:
        model = AuthIdentity.objects.get(id=auth_identity.id)
        data = model.get_audit_log_data()  # TODO: Adapt to Api dataclass
        return self.write_audit_log(metadata=metadata, data=data)
