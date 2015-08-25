"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from sentry.constants import MEMBER_ADMIN
from sentry.models import TagKey, TagKeyStatus
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response


@has_access(MEMBER_ADMIN)
def manage_project_tags(request, organization, project):
    tag_list = TagKey.objects.filter(
        project=project,
        status=TagKeyStatus.VISIBLE,
    )

    context = {
        'organization': organization,
        'team': project.team,
        'project': project,
        'tag_list': tag_list,
        'page': 'tags',
    }
    return render_to_response('sentry/projects/manage_tags.html', context, request)
