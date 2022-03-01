from django.contrib.auth.signals import user_logged_out


def disable_superuser(request, user, **kwargs):
    su = getattr(request, "superuser", None)
    if su:
        su.set_logged_out()


user_logged_out.connect(disable_superuser, dispatch_uid="disable_superuser", weak=False)
