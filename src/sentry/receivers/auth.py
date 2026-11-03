import logging

from django.contrib.auth.models import update_last_login
from django.contrib.auth.signals import user_logged_in
from django.db.utils import DatabaseError
from django.http.request import HttpRequest

from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption


# Set user language if set
def set_language_on_logon(request: HttpRequest, user: User, **kwargs: object) -> None:
    language = UserOption.objects.get_value(user=user, key="language")
    if language and hasattr(request, "session"):
        request.session["django_language"] = language


def safe_update_last_login(sender: type[User], user: User, **kwargs: object) -> None:
    """
    Identical to Django's built-in handler except that we gracefully
    handle database failures.

    tl;dr logging in should not fail when a db is read-only
    """
    try:
        update_last_login(sender, user, **kwargs)
    except DatabaseError as exc:
        logging.warning(str(exc), exc_info=True)


def remove_lost_password_hashes(sender: type[User], user: User, **kwargs: object) -> None:
    # Remove pending password recovery hashes; user was able to login
    user.clear_lost_passwords()


user_logged_in.disconnect(update_last_login)
user_logged_in.connect(safe_update_last_login, dispatch_uid="safe_update_last_login", weak=False)

user_logged_in.connect(set_language_on_logon, dispatch_uid="set_language_on_logon", weak=False)
user_logged_in.connect(
    remove_lost_password_hashes, dispatch_uid="remove_lost_password_hashes", weak=False
)
