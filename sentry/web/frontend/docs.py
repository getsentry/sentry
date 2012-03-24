"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.models import ProjectMember, MEMBER_SYSTEM
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response, render_to_string

PLATFORM_LIST = (
    'python',
    'django',
    'flask',
    'php',
    'java',
    'node.js',
    'express',
    'connect',
)


@has_access(MEMBER_SYSTEM)
def client_guide(request, project, platform):
    if platform not in PLATFORM_LIST:
        return HttpResponseRedirect(reverse('sentry'))

    member = ProjectMember.objects.get(user=request.user, project=project)
    dsn = member.get_dsn()

    template = 'sentry/partial/client_config/%s.html' % (platform,)

    context = {
        'platform': platform,
        'platform_title': platform.title(),
        'project': project,
        'dsn': dsn,
    }

    if request.is_ajax():
        return render_to_response(template, context, request)

    context['template'] = render_to_string(template, context, request)

    return render_to_response('sentry/projects/docs/client_config.html', context, request)
