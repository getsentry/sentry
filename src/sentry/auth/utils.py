from __future__ import absolute_import


def is_active_superuser(user):
    # TODO(dcramer): add VPN support via INTERNAL_IPS + ipaddr ranges
    return user.is_superuser
