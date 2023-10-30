from django.conf import settings
from django.contrib.auth.signals import user_logged_in, user_logged_out

from sentry.utils.settings import is_self_hosted


# Upon login, we automatically want to enable superuser
# status
def enable_superuser(request, user, **kwargs):
    ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV = getattr(
        settings, "ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV", False
    )

    prefilled_su_modal = request.session.pop("prefilled_su_modal", None)

    if is_self_hosted() or ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV or prefilled_su_modal:
        su = getattr(request, "superuser", None)
        if su:
            if user.is_superuser:
                su.set_logged_in(user, prefilled_su_modal=prefilled_su_modal)
            else:
                su._set_logged_out()


def disable_superuser(request, user, **kwargs):
    su = getattr(request, "superuser", None)
    if su:
        su.set_logged_out()


user_logged_in.connect(enable_superuser, dispatch_uid="enable_superuser", weak=False)

user_logged_out.connect(disable_superuser, dispatch_uid="disable_superuser", weak=False)
