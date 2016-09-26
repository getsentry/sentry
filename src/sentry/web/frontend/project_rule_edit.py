from __future__ import absolute_import

from sentry.rules import rules
from sentry.models import Rule, RuleStatus
from sentry.web.frontend.base import ProjectView
from sentry.utils import json
from sentry.utils.http import absolute_uri


class ProjectRuleEditView(ProjectView):
    required_scope = 'project:write'

    def get(self, request, organization, team, project, rule_id=None):
        if rule_id:
            try:
                rule = Rule.objects.get(
                    project=project,
                    id=rule_id,
                    status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE],
                )
            except Rule.DoesNotExist:
                path = '/{}/{}/settings/alerts/rules/'.format(organization.slug, project.slug)
                return self.redirect(absolute_uri(path))
        else:
            rule = Rule(project=project)

        action_list = []
        condition_list = []

        # TODO: conditions need to be based on actions
        for rule_type, rule_cls in rules:
            node = rule_cls(project)
            context = {
                'id': node.id,
                'label': node.label,
                'html': node.render_form(),
            }

            if rule_type.startswith('condition/'):
                condition_list.append(context)
            elif rule_type.startswith('action/'):
                action_list.append(context)

        context = {
            'rule': rule,
            'page': 'rules',
            'action_list': json.dumps(action_list),
            'condition_list': json.dumps(condition_list),
        }

        return self.respond('sentry/projects/rules/new.html', context)
