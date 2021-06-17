from django.conf import settings
from django.core.exceptions import MiddlewareNotUsed
from django.utils.deprecation import MiddlewareMixin


class SetRemoteAddrFromForwardedFor(MiddlewareMixin):
    def __init__(self, *args, **kwargs):
        if not getattr(settings, "SENTRY_USE_X_FORWARDED_FOR", True):
            raise MiddlewareNotUsed
        super().__init__(*args, **kwargs)

    def _remove_port_number(self, ip_address):
        if "[" in ip_address and "]" in ip_address:
            # IPv6 address with brackets, possibly with a port number
            return ip_address[ip_address.find("[") + 1 : ip_address.find("]")]
        if "." in ip_address and ip_address.rfind(":") > ip_address.rfind("."):
            # IPv4 address with port number
            # the last condition excludes IPv4-mapped IPv6 addresses
            return ip_address.rsplit(":", 1)[0]
        return ip_address

    def process_request(self, request):
        try:
            real_ip = request.META["HTTP_X_FORWARDED_FOR"]
        except KeyError:
            pass
        else:
            # HTTP_X_FORWARDED_FOR can be a comma-separated list of IPs.
            # Take just the first one.
            real_ip = real_ip.split(",")[0].strip()
            real_ip = self._remove_port_number(real_ip)
            request.META["REMOTE_ADDR"] = real_ip
