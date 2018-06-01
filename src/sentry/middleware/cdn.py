from __future__ import absolute_import


class CdnMiddleware(object):
    cdn_paths = [
        '/js-sdk-loader/'
    ]

    def process_response(self, request, response):
        if request.path.startswith(tuple(self.cdn_paths)):
            response['Vary'] = 'Accept-Encoding'
        return response
