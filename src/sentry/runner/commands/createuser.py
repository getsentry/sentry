import click

from sentry.runner.decorators import configuration


def _get_field(field_name):
    from sentry.models import User

    return User._meta.get_field(field_name)


def _get_email():
    from django.core.exceptions import ValidationError

    rv = click.prompt("Email")
    field = _get_field("email")
    try:
        return [field.clean(rv, None)]
    except ValidationError as e:
        raise click.ClickException("; ".join(e.messages))


def _get_password():
    from django.core.exceptions import ValidationError

    rv = click.prompt("Password", hide_input=True, confirmation_prompt=True)
    field = _get_field("password")
    try:
        return field.clean(rv, None)
    except ValidationError as e:
        raise click.ClickException("; ".join(e.messages))


def _get_superuser():
    return click.confirm("Should this user be a superuser?", default=False)


def _set_superadmin(user):
    """
    superadmin role approximates superuser (model attribute) but leveraging
    Sentry's role system.
    """
    from sentry.models import UserRole, UserRoleUser

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
def createuser(emails, org_id, password, superuser, staff, no_password, no_input, force_update):
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
    from sentry.models import User

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
                raise click.ClickException(f"User: {email} exists, use --force-update to force.")
        # Create a new user if they don't already exist.
        else:
            user = User.objects.create(**fields)
            verb = "created"

            # TODO(dcramer): kill this when we improve flows
            if settings.SENTRY_SINGLE_ORGANIZATION:
                from sentry.models import (
                    Organization,
                    OrganizationMember,
                    OrganizationMemberTeam,
                    Team,
                )

                # Get the org if specified, otherwise use the default.
                if org_id:
                    org = Organization.objects.get(id=org_id)
                else:
                    org = Organization.get_default()

                if superuser:
                    role = roles.get_top_dog().id
                else:
                    role = org.default_role
                member = OrganizationMember.objects.create(
                    organization=org, user_id=user.id, role=role
                )

                # if we've only got a single team let's go ahead and give
                # access to that team as its likely the desired outcome
                teams = list(Team.objects.filter(organization=org)[0:2])
                if len(teams) == 1:
                    OrganizationMemberTeam.objects.create(team=teams[0], organizationmember=member)
                click.echo(f"Added to organization: {org.slug}")

        if password:
            user.set_password(password)
            user.save()

        if superuser and (settings.SENTRY_SELF_HOSTED or settings.SENTRY_SINGLE_ORGANIZATION):
            _set_superadmin(user)

        click.echo(f"User {verb}: {email}")
