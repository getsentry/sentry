from __future__ import annotations

import click

from sentry.runner.decorators import configuration


@click.command()
@click.option("--name", required=True, help="Organization name.")
@click.option(
    "--slug",
    default=None,
    help="URL-friendly slug. Derived from name if omitted.",
)
@click.option("--owner-email", required=True, help="Email of the organization owner.")
@click.option(
    "--no-default-team",
    default=False,
    is_flag=True,
    help="Skip creating a default team.",
)
@configuration
def createorg(
    name: str,
    slug: str | None,
    owner_email: str,
    no_default_team: bool,
) -> None:
    "Create a new organization."

    from sentry.services.organization.model import (
        OrganizationOptions,
        OrganizationProvisioningOptions,
        PostProvisionOptions,
    )
    from sentry.services.organization.provisioning import (
        OrganizationProvisioningException,
        organization_provisioning_service,
    )
    from sentry.users.models.user import User
    from sentry.users.services.user.serial import serialize_generic_user

    owner = User.objects.get(email=owner_email)
    rpc_owner = serialize_generic_user(owner)
    assert rpc_owner  # remove None

    provision_args = OrganizationProvisioningOptions(
        provision_options=OrganizationOptions(
            name=name,
            slug=slug or name,
            owner=rpc_owner,
            create_default_team=not no_default_team,
        ),
        post_provision_options=PostProvisionOptions(),
    )

    try:
        rpc_org = organization_provisioning_service.provision_organization_in_cell(
            provisioning_options=provision_args,
        )
    except OrganizationProvisioningException as e:
        raise click.ClickException(str(e))

    click.echo(f"Organization created: {rpc_org.name} (slug: {rpc_org.slug}, id: {rpc_org.id})")
