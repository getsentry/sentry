from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.organizationmember import OrganizationMember
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service


def find_user_for_scm_actor(
    *,
    organization_id: int,
    integration_id: int,
    username: str,
    external_id: str | int | None = None,
) -> RpcUser | None:
    external_actors = ExternalActor.objects.filter(
        organization_id=organization_id,
        integration_id=integration_id,
        user_id__isnull=False,
    )

    user_ids: set[int] = set()
    if external_id is not None:
        user_ids = {
            user_id
            for user_id in external_actors.filter(external_id=str(external_id)).values_list(
                "user_id", flat=True
            )
            if user_id is not None
        }
        if len(user_ids) > 1:
            return None

    if not user_ids:
        user_ids = {
            user_id
            for user_id in external_actors.filter(
                external_name__iexact=f"@{username.lstrip('@')}"
            ).values_list("user_id", flat=True)
            if user_id is not None
        }

    if len(user_ids) != 1:
        return None

    user_id = user_ids.pop()
    if not OrganizationMember.objects.filter(
        organization_id=organization_id, user_id=user_id
    ).exists():
        return None

    return user_service.get_user(user_id=user_id)
