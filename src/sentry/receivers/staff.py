from django.contrib.auth.signals import user_logged_out
from django.http.request import HttpRequest


def disable_staff(request: HttpRequest, user: object, **kwargs: object) -> None:
    staff = getattr(request, "staff", None)
    if staff:
        staff.set_logged_out()


user_logged_out.connect(disable_staff, dispatch_uid="disable_staff", weak=False)
