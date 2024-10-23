"""
sudo.signals
~~~~~~~~~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""

from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver
from django.http.request import HttpRequest

from sudo.utils import grant_sudo_privileges, revoke_sudo_privileges


@receiver(user_logged_in)
def grant(sender: object, request: HttpRequest, **kwargs: object) -> None:
    """
    Automatically grant sudo privileges when logging in.
    """
    grant_sudo_privileges(request)


@receiver(user_logged_out)
def revoke(sender: object, request: HttpRequest, **kwargs: object) -> None:
    """
    Automatically revoke sudo privileges when logging out.
    """
    revoke_sudo_privileges(request)
