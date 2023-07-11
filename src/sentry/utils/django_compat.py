import django

if django.VERSION >= (3,):
    from django.utils.http import url_has_allowed_host_and_scheme
else:
    from django.utils.http import is_safe_url as url_has_allowed_host_and_scheme

__all__ = ("url_has_allowed_host_and_scheme",)
