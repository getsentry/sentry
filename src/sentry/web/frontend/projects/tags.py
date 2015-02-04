"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_ADMIN
from sentry.models import ProjectOption, TagKey, TagKeyStatus
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response


@has_access(MEMBER_ADMIN)
def manage_project_tags(request, organization, project):
    tag_list = TagKey.objects.filter(
        project=project,
        status=TagKeyStatus.VISIBLE,
    )

    enabled_filters = ProjectOption.objects.get_value(
        project, 'tags', [t.key for t in tag_list])
    enabled_annotations = ProjectOption.objects.get_value(
        project, 'annotations', ['sentry:user'])

    if request.POST:
        filters = request.POST.getlist('filters')
        ProjectOption.objects.set_value(
            project, 'tags', filters)

        annotations = request.POST.getlist('annotations')
        ProjectOption.objects.set_value(
            project, 'annotations', annotations)

        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(reverse('sentry-manage-project-tags', args=[project.organization.slug, project.slug]))

    context = {
        'organization': organization,
        'team': project.team,
        'project': project,
        'tag_list': tag_list,
        'enabled_filters': enabled_filters,
        'enabled_annotations': enabled_annotations,
        'page': 'tags',
    }
    return render_to_response('sentry/projects/manage_tags.html', context, request)
