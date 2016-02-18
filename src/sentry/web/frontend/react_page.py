from __future__ import absolute_import

from django.middleware.csrf import get_token as get_csrf_token
from django.http import HttpResponse
from django.template import loader, Context

from sentry.models import Project
from sentry.signals import first_event_pending
from sentry.web.frontend.base import BaseView, OrganizationView


class ReactMixin(object):
    def handle_react(self, request):
        context = Context({'request': request})

        # Force a new CSRF token to be generated and set in user's
        # Cookie. Alternatively, we could use context_processor +
        # template tag, but in this case, we don't need a form on the
        # page. So there's no point in rendering a random `<input>` field.
        get_csrf_token(request)

        template = loader.render_to_string('sentry/bases/react.html', context)

        response = HttpResponse(template)
        response['Content-Type'] = 'text/html'

        return response


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(OrganizationView, ReactMixin):
    def handle(self, request, organization, **kwargs):
        if 'project_id' in kwargs and request.GET.get('onboarding'):
            project = Project.objects.filter(organization=organization, slug=kwargs['project_id']).first()
            first_event_pending.send(project=project, user=request.user, sender=self)
        return self.handle_react(request)


class GenericReactPageView(BaseView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)
