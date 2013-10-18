"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_OWNER
from sentry.models import TagKey
from sentry.web.decorators import has_access
from sentry.web.forms.projects import ProjectTagsForm
from sentry.web.helpers import render_to_response


@has_access(MEMBER_OWNER)
def manage_project_tags(request, team, project):
    tag_list = filter(
        lambda x: not x.startswith('sentry:'),
        TagKey.objects.all_keys(project))

    if tag_list:
        form = ProjectTagsForm(project, tag_list, request.POST or None)
    else:
        form = None

    if form and form.is_valid():
        form.save()

        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(reverse('sentry-manage-project-tags', args=[project.team.slug, project.slug]))

    context = {
        'team': team,
        'tag_list': tag_list,
        'page': 'tags',
        'project': project,
        'form': form,
    }
    return render_to_response('sentry/projects/manage_tags.html', context, request)
