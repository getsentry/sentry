from __future__ import absolute_import, print_function

from django.core.management import call_command
from django.db.models.signals import post_syncdb
from django.utils.six.moves import input

from sentry.models import User


def create_first_user(app, created_models, verbosity, db, **kwargs):
    if User not in created_models:
        return
    if not kwargs.get('interactive', True):
        return
    msg = ("Would you like to create a user account now? (yes/no): ")
    confirm = input(msg)
    while 1:
        if confirm not in ('yes', 'no'):
            confirm = input('Please enter either "yes" or "no": ')
            continue
        if confirm == 'yes':
            call_command("createuser", interactive=True, database=db)
        break


post_syncdb.connect(
    create_first_user,
    dispatch_uid="create_first_user",
    weak=False,
)
