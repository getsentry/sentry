from __future__ import absolute_import

from django.contrib.auth.signals import user_logged_in, user_logged_out


# Upon login, we automatically want to enable superuser
# status
def enable_superuser(request, user, **kwargs):
    su = getattr(request, "superuser", None)
    if su:
        if user.is_superuser:
            su.set_logged_in(user)
        else:
            su._set_logged_out()


def disable_superuser(request, user, **kwargs):
    su = getattr(request, "superuser", None)
    if su:
        su.set_logged_out()


user_logged_in.connect(enable_superuser, dispatch_uid="enable_superuser", weak=False)

user_logged_out.connect(disable_superuser, dispatch_uid="disable_superuser", weak=False)
