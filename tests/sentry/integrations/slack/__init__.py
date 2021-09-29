from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    Organization,
    OrganizationIntegration,
    User,
)


def install_slack(organization: Organization, workspace_id: str = "TXXXXXXX1") -> Integration:
    integration = Integration.objects.create(
        external_id=workspace_id,
        metadata={
            "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "domain_name": "sentry.slack.com",
            "installation_type": "born_as_bot",
        },
        name="Awesome Team",
        provider="slack",
    )
    OrganizationIntegration.objects.create(organization=organization, integration=integration)
    return integration


def add_identity(
    integration: Integration, user: User, external_id: str = "UXXXXXXX1"
) -> IdentityProvider:
    idp = IdentityProvider.objects.create(
        type="slack", external_id=integration.external_id, config={}
    )
    Identity.objects.create(
        user=user, idp=idp, external_id=external_id, status=IdentityStatus.VALID
    )
    return idp
