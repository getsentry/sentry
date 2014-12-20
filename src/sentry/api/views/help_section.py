from __future__ import absolute_import

from django.http import Http404

from sentry.api.base import DocSection
from sentry.api.views.help_base import ApiHelpBase
from sentry.web.helpers import render_to_response


class ApiHelpSectionView(ApiHelpBase):
    auth_required = False

    def get(self, request, section_id):
        try:
            section = DocSection[section_id.upper()]
        except KeyError:
            raise Http404

        context = {
            'section': {
                'id': section.name.lower(),
                'name': section.value,
            },
            'resource_list': self.get_resources(section)
        }

        return render_to_response('sentry/help/api_section.html', context, request)
