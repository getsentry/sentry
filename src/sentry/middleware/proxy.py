from __future__ import absolute_import

import six


class SetRemoteAddrFromForwardedFor(object):
    def process_request(self, request):
        try:
            real_ip = request.META['HTTP_X_FORWARDED_FOR']
        except KeyError:
            pass
        else:
            # HTTP_X_FORWARDED_FOR can be a comma-separated list of IPs.
            # Take just the first one.
            real_ip = real_ip.split(",")[0]
            if ':' in real_ip and '.' in real_ip:
                # Strip the port number off of an IPv4 FORWARDED_FOR entry.
                real_ip = real_ip.split(':', 1)[0]
            request.META['REMOTE_ADDR'] = real_ip


class ContentLengthHeaderMiddleware(object):
    """
    Ensure that we have a proper Content-Length/Transfer-Encoding header
    """

    def process_response(self, request, response):
        if 'Transfer-Encoding' in response or 'Content-Length' in response:
            return response

        if not response.streaming:
            response['Content-Length'] = six.text_type(len(response.content))

        return response
