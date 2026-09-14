from sentry.auth.principal import (
    AuthenticatedServiceAccountPrincipal,
    AuthenticatedUserPrincipal,
)


def test_principal_identifiers_are_namespaced() -> None:
    user = AuthenticatedUserPrincipal(id=42, display_name="Human")
    service_account = AuthenticatedServiceAccountPrincipal(
        id=42,
        organization_id=1,
        display_name="Deploy bot",
    )

    assert user.identifier == "user:42"
    assert service_account.identifier == "service_account:42"
    assert user.identifier != service_account.identifier
