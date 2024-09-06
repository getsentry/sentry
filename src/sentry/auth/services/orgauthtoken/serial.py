from sentry.auth.services.orgauthtoken.model import RpcOrgAuthToken
from sentry.models.orgauthtoken import OrgAuthToken


def serialize_org_auth_token(token: OrgAuthToken) -> RpcOrgAuthToken:
    return RpcOrgAuthToken(
        organization_id=token.organization_id,
        id=token.id,
        token_hashed=token.token_hashed,
        name=token.name,
        scope_list=token.scope_list or [],
        created_by_id=token.created_by_id,
        date_deactivated=token.date_deactivated,
    )
