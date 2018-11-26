from __future__ import absolute_import

from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint


class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(JiraIssueUpdatedWebhook, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        # TODO implement.
        pass
