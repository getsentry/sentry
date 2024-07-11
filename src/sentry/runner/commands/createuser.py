from __future__ import annotations

from typing import TYPE_CHECKING

import click

from sentry.runner.decorators import configuration

if TYPE_CHECKING:
    from django.db.models.fields import Field

    from sentry.users.models.user import User


def _get_field(field_name: str) -> Field[str, str]:
    from django.db.models.fields import Field

    from sentry.users.models.user import User

    ret = User._meta.get_field(field_name)
    assert isinstance(ret, Field), ret
    return ret


def _get_email() -> list[str]:
    from django.core.exceptions import ValidationError

    rv = click.prompt("Email")
    field = _get_field("email")
    try:
        return [field.clean(rv, None)]
    except ValidationError as e:
        raise click.ClickException("; ".join(e.messages))


def _get_password() -> str:
    from django.core.exceptions import ValidationError

    rv = click.prompt("Password", hide_input=True, confirmation_prompt=True)
    field = _get_field("password")
    try:
        return field.clean(rv, None)
    except ValidationError as e:
        raise click.ClickException("; ".join(e.messages))


def _get_superuser() -> bool:
    return click.confirm("Should this user be a superuser?", default=False)


def _set_superadmin(user: User) -> None:
    """
    superadmin role approximates superuser (model attribute) but leveraging
    Sentry's role system.
    """
    from sentry.users.models.userrole import UserRole, UserRoleUser

    role = UserRole.objects.get(name="Super Admin")
    UserRoleUser.objects.create(user=user, role=role)


@click.command()
@click.option(
    "--email",
    "emails",
    multiple=True,
    default=None,
    help="Email(s) to create account(s) for.",
)
@click.option(
    "--org-id",
    default=None,
    help="Org ID to add users to, if not provided will use the default Org.",
)
@click.option("--password")
@click.option(
    "--superuser/--no-superuser",
    default=None,
    is_flag=True,
    help="Superusers have full access to Sentry, across all organizations.",
)
@click.option(
    "--staff/--no-staff",
    default=None,
    is_flag=True,
    help="Staff users have access to Django backend.",
)
@click.option("--no-password", default=False, is_flag=True)
@click.option("--no-input", default=False, is_flag=True)
@click.option(
    "--force-update", default=False, is_flag=True, help="If true, will update existing users."
)
@configuration
def createuser(
    emails: list[str] | None,
    org_id: str | None,
    password: str | None,
    superuser: bool | None,
    staff: bool | None,
    no_password: bool,
    no_input: bool,
    force_update: bool,
) -> None:
    "Create a new user."

    from django.conf import settings

    if not no_input:
        if not emails:
            emails = _get_email()

        if not (password or no_password):
            password = _get_password()

        if superuser is None:
            superuser = _get_superuser()

    if superuser is None:
        superuser = False

    # Prevent a user from being set to staff without superuser
    if not superuser and staff:
        click.echo("Non-superuser asked to be given staff access, correcting to staff=False")
        staff = False

    # Default staff to match the superuser setting
    if staff is None:
        staff = superuser

    # Verify we have an email to work with.
    if not emails:
        raise click.ClickException("Invalid or missing email address.")

    if not no_password and not password:
        raise click.ClickException("No password set and --no-password not passed.")

    from sentry import roles
    from sentry.users.models.user import User

    # Loop through the email list provided.
    for email in emails:
        fields = dict(
            email=email,
            username=email,
            is_superuser=superuser,
            is_staff=staff,
            is_active=True,
        )

        verb = None
        try:
            user = User.objects.get(username=email)
        except User.DoesNotExist:
            user = None

        # Update the user if they already exist.
        if user is not None:
            if force_update:
                user.update(**fields)
                verb = "updated"
            else:
                click.echo(f"User: {email} exists, use --force-update to force.")
                continue

        # Create a new user if they don't already exist.
        else:
            user = User.objects.create(**fields)
            verb = "created"

            # TODO(dcramer): kill this when we improve flows
            if settings.SENTRY_SINGLE_ORGANIZATION:
                from sentry.organizations.services.organization import organization_service

                # Get the org if specified, otherwise use the default.
                if org_id:
                    org_context = organization_service.get_organization_by_id(
                        id=org_id, include_teams=False, include_projects=False
                    )
                    if org_context is None:
                        raise Exception("Organization ID not found")
                    org = org_context.organization
                else:
                    org = organization_service.get_default_organization()

                if superuser:
                    role = roles.get_top_dog().id
                else:
                    role = org.default_role
                member = organization_service.add_organization_member(
                    organization_id=org.id,
                    default_org_role=org.default_role,
                    user_id=user.id,
                    role=role,
                )

                # if we've only got a single team let's go ahead and give
                # access to that team as its likely the desired outcome
                team = organization_service.get_single_team(organization_id=org.id)
                if team is not None:
                    organization_service.add_team_member(
                        organization_id=org.id, team_id=team.id, organization_member_id=member.id
                    )
                click.echo(f"Added to organization: {org.slug}")

        if password:
            user.set_password(password)
            user.save()

        if superuser and (settings.SENTRY_SELF_HOSTED or settings.SENTRY_SINGLE_ORGANIZATION):
            _set_superadmin(user)

        click.echo(f"User {verb}: {email}")
