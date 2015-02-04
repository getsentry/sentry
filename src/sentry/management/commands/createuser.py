"""
sentry.management.commands.createuser
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import getpass
import sys

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, make_option

from sentry.models import User


class Command(BaseCommand):
    help = 'Creates a new user'

    option_list = BaseCommand.option_list + (
        make_option('--email', dest='email'),
        make_option('--superuser', dest='is_superuser', action='store_true', default=None),
        make_option('--no-password', dest='nopassword', action='store_true', default=False),
        make_option('--no-input', dest='noinput', action='store_true', default=False),
    )

    def _get_field(self, field_name):
        return User._meta.get_field(field_name)

    def get_email(self):
        raw_value = raw_input('Email: ')
        if not raw_value:
            raise CommandError('Invalid email address: This field cannot be blank')

        field = self._get_field('email')
        try:
            return field.clean(raw_value, None)
        except ValidationError as e:
            raise CommandError('Invalid email address: %s' % '; '.join(e.messages))

    def get_password(self):
        raw_value = getpass.getpass()

        field = self._get_field('password')
        try:
            return field.clean(raw_value, None)
        except ValidationError as e:
            raise CommandError('Invalid password: %s' % '; '.join(e.messages))

    def get_superuser(self):
        if raw_input('Should this user be a superuser? [yN] ').lower() == 'y':
            return True
        return False

    def handle(self, **options):
        email = options['email']
        is_superuser = options['is_superuser']

        if not options['noinput']:
            try:
                if not email:
                    email = self.get_email()

                if not options['nopassword']:
                    password = self.get_password()

                if is_superuser is None:
                    is_superuser = self.get_superuser()
            except KeyboardInterrupt:
                self.stderr.write("\nOperation cancelled.")
                sys.exit(1)

        else:
            password = None

        if not email:
            raise CommandError('Invalid or missing email address')

        if not options['nopassword'] and not password:
            raise CommandError('No password set and --no-password not passed')

        user = User(
            email=email,
            username=email,
            is_superuser=is_superuser,
            is_staff=is_superuser,
            is_active=True,
        )

        if password:
            user.set_password(password)

        user.save()

        self.stdout.write('User created: %s' % (email,))
