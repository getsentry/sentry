from __future__ import absolute_import

from sentry.rules import rules
from sentry.models import Rule
from sentry.web.frontend.base import ProjectView


def _generate_rule_label(project, rule, data):
    rule_cls = rules.get(data['id'])
    if rule_cls is None:
        return

    rule_inst = rule_cls(project, data=data, rule=rule)
    return rule_inst.render_label()


class ProjectRulesView(ProjectView):
    required_scope = 'project:write'

    def get(self, request, organization, team, project):
        rule_list = []
        for rule in Rule.objects.filter(project=project):
            conditions = []
            for data in rule.data['conditions']:
                conditions.append(_generate_rule_label(project, rule, data))
            conditions = filter(bool, conditions)

            actions = []
            for data in rule.data['actions']:
                actions.append(_generate_rule_label(project, rule, data))
            actions = filter(bool, actions)

            rule_list.append({
                'id': rule.id,
                'label': rule.label,
                'match': rule.data.get('action_match', 'all'),
                'actions': actions,
                'conditions': conditions,
            })

        context = {
            'page': 'rules',
            'rule_list': rule_list,
        }

        return self.respond('sentry/projects/rules/list.html', context)
