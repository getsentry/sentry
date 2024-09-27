from functools import wraps

from csp.utils import build_policy
from django.test import override_settings


def require_script_src_nonce(view_method):
    @wraps(view_method)
    def wrapper(request, *args, **kwargs):
        response = view_method(request, *args, **kwargs)
        config = getattr(response, "_csp_config", None)
        update = getattr(response, "_csp_update", None)
        replace = getattr(response, "_csp_replace", None)
        nonce = getattr(request, "_csp_nonce", None)
        with override_settings(CSP_INCLUDE_NONCE_IN=["script-src"]):
            csp = build_policy(config=config, update=update, replace=replace, nonce=nonce)

        response.headers["Content-Security-Policy"] = csp
        return response

    return wrapper
