from __future__ import absolute_import

from django.conf import settings
from django.http import HttpResponse
from django.middleware.csrf import get_token as get_csrf_token
from django.template import loader, Context

from sentry.models import Project
from sentry.signals import first_event_pending
from sentry.web.frontend.base import BaseView, OrganizationView


class ReactMixin(object):
    def get_context(self, request):
        # this hook is utilized by getsentry
        return {
            'request': request,
            'CSRF_COOKIE_NAME': settings.CSRF_COOKIE_NAME,
        }

    def handle_react(self, request):
        context = Context(self.get_context(request))

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
    def handle_auth_required(self, request, *args, **kwargs):
        # If user is a superuser (but not active, because otherwise this method would never be called)
        # Then allow client to handle the route and respond to any API request errors
        if request.user.is_superuser:
            return self.handle_react(request)

        # For normal users, let parent class handle (e.g. redirect to login page)
        return super(ReactPageView, self).handle_auth_required(request, *args, **kwargs)

    def handle(self, request, organization, **kwargs):
        if 'project_id' in kwargs and request.GET.get('onboarding'):
            project = Project.objects.filter(
                organization=organization, slug=kwargs['project_id']
            ).first()
            first_event_pending.send(project=project, user=request.user, sender=self)
        return self.handle_react(request)


class GenericReactPageView(BaseView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)
