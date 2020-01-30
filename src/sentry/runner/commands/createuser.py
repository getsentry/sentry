from __future__ import absolute_import, print_function

import click
import sys
from sentry.runner.decorators import configuration


def _get_field(field_name):
    from sentry.models import User

    return User._meta.get_field(field_name)


def _get_email():
    from django.core.exceptions import ValidationError

    rv = click.prompt("Email")
    field = _get_field("email")
    try:
        return field.clean(rv, None)
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


@click.command()
@click.option("--email")
@click.option("--password")
@click.option("--superuser/--no-superuser", default=None, is_flag=True)
@click.option("--no-password", default=False, is_flag=True)
@click.option("--no-input", default=False, is_flag=True)
@click.option("--force-update", default=False, is_flag=True)
@configuration
def createuser(email, password, superuser, no_password, no_input, force_update):
    "Create a new user."
    if not no_input:
        if not email:
            email = _get_email()

        if not (password or no_password):
            password = _get_password()

        if superuser is None:
            superuser = _get_superuser()

    if superuser is None:
        superuser = False

    if not email:
        raise click.ClickException("Invalid or missing email address.")

    # TODO(mattrobenolt): Accept password over stdin?
    if not no_password and not password:
        raise click.ClickException("No password set and --no-password not passed.")

    from sentry import roles
    from sentry.models import User
    from django.conf import settings

    user = User(
        email=email, username=email, is_superuser=superuser, is_staff=superuser, is_active=True
    )

    if password:
        user.set_password(password)

    if User.objects.filter(username=email).exists():
        if force_update:
            user.save(force_update=force_update)
            click.echo("User updated: %s" % (email,))
        else:
            click.echo("User: %s exists, use --force-update to force" % (email,))
            sys.exit(3)
    else:
        user.save()
        click.echo("User created: %s" % (email,))

        # TODO(dcramer): kill this when we improve flows
        if settings.SENTRY_SINGLE_ORGANIZATION:
            from sentry.models import Organization, OrganizationMember, OrganizationMemberTeam, Team

            org = Organization.get_default()
            if superuser:
                role = roles.get_top_dog().id
            else:
                role = org.default_role
            member = OrganizationMember.objects.create(organization=org, user=user, role=role)

            # if we've only got a single team let's go ahead and give
            # access to that team as its likely the desired outcome
            teams = list(Team.objects.filter(organization=org)[0:2])
            if len(teams) == 1:
                OrganizationMemberTeam.objects.create(team=teams[0], organizationmember=member)
            click.echo("Added to organization: %s" % (org.slug,))
