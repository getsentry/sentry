"""
sudo.signals
~~~~~~~~~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver

from sudo.utils import grant_sudo_privileges, revoke_sudo_privileges


@receiver(user_logged_in)
def grant(sender, request, **kwargs):
    """
    Automatically grant sudo privileges when logging in.
    """
    grant_sudo_privileges(request)


@receiver(user_logged_out)
def revoke(sender, request, **kwargs):
    """
    Automatically revoke sudo privileges when logging out.
    """
    revoke_sudo_privileges(request)
