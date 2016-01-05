"""
sentry.web.frontend.generic
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.views.generic import TemplateView as BaseTemplateView

from sentry.web.helpers import render_to_response


def static_media(request, **kwargs):
    """
    Serve static files below a given point in the directory structure.
    """
    from django.contrib.staticfiles.views import serve

    module = kwargs.get('module')
    path = kwargs.get('path', '')
    version = kwargs.get('version')

    if module:
        path = '%s/%s' % (module, path)

    response = serve(request, path, insecure=True)

    # We need CORS for font files
    if path.endswith(('.js' '.ttf', '.ttc', '.otf', '.eot', '.woff', '.woff2')):
        response['Access-Control-Allow-Origin'] = '*'

    # If we have a version, we can cache it FOREVER
    if version is not None:
        response['Cache-Control'] = 'max-age=315360000'

    return response


class TemplateView(BaseTemplateView):
    def render_to_response(self, context, **response_kwargs):
        return render_to_response(
            request=self.request,
            template=self.get_template_names(),
            context=context,
            **response_kwargs
        )
