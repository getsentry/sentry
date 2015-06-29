from __future__ import absolute_import

from sentry import features
from sentry.web.frontend.base import BaseView, OrganizationView
from sentry.utils import json
from sentry.utils.functional import extract_lazy_object
from django.utils.safestring import mark_safe


class ReactMixin(object):
    def handle_react(self, request):
        if request.user.is_authenticated():
            # remove lazy eval
            request.user = extract_lazy_object(request.user)

        enabled_features = []
        if features.has('organizations:create', actor=request.user):
            enabled_features.append('organizations:create')
        if features.has('auth:register', actor=request.user):
            enabled_features.append('auth:register')

        context = {
            'features': mark_safe(json.dumps(enabled_features)),
        }

        return self.respond('sentry/bases/react.html', context)


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(OrganizationView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)


class GenericReactPageView(BaseView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)
