from django.contrib.auth.signals import user_logged_out


def disable_staff(request, user, **kwargs):
    su = getattr(request, "staff", None)
    if su:
        su.set_logged_out()


user_logged_out.connect(disable_staff, dispatch_uid="disable_staff", weak=False)
