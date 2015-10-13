from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.models import Rule
from sentry.web.frontend.base import ProjectView


class ProjectRuleRemoveView(ProjectView):
    required_scope = 'project:write'

    def post(self, request, organization, team, project, rule_id):
        path = reverse('sentry-project-rules', args=[organization.slug, project.slug])

        try:
            rule = Rule.objects.get(project=project, id=rule_id)
        except Rule.DoesNotExist:
            return self.redirect(path)

        rule.delete()

        messages.add_message(request, messages.SUCCESS,
            _('The rule was removed.'))

        return self.redirect(path)
