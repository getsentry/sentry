from uuid import uuid4

from django.conf import settings
from django.core.exceptions import MiddlewareNotUsed
from django.utils.deprecation import MiddlewareMixin


class CspHeaderMiddleware(MiddlewareMixin):
    settings_key = "CSP_HEADER"

    def __init__(self, *args, **kwargs):
        header = getattr(settings, self.settings_key, None)
        if not header:
            raise MiddlewareNotUsed()

        self.key = header[0]
        self.header_data = header[1]
        self.value = "; ".join(map(lambda h: "{} {}".format(h[0], " ".join(h[1])), header[1]))
        super().__init__(*args, **kwargs)

    def process_request(self, request):
        if not hasattr(request, "csp_nonce"):
            request.csp_nonce = uuid4().hex

    def process_response(self, request, response):
        if response.get("Content-Type", "")[:9] == "text/html":
            # if we have an existing value for the CSP header, keep it
            # and just add the rest to the end
            # note this is a hack and will create duplicate blocks if a block
            # in the CSP_HEADER setting collides with what's provided in the existing
            # header value. A real solution would have to do a more intelligent merge
            # similar to https://django-csp.readthedocs.io/en/latest/
            value = self.value
            if response.get(self.key, None):
                value = response.get(self.key) + "; "
                value += "; ".join(
                    f"{directive} {' '.join(values)}"
                    for directive, values in self.header_data
                    if directive not in value
                )
            if hasattr(request, "csp_nonce"):
                value = value.replace("{nonce}", request.csp_nonce)
            response[self.key] = value
        return response


class CspReportOnlyHeaderMiddleware(CspHeaderMiddleware):
    settings_key = "CSP_REPORT_ONLY"
