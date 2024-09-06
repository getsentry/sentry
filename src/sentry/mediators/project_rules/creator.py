from django.db import router
from rest_framework.request import Request

from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.types.actor import Actor


class Creator(Mediator):
    name = Param(str)
    environment = Param(int, required=False)
    owner = Param(Actor, required=False)
    project = Param(Project)
    action_match = Param(str)
    filter_match = Param(str, required=False)
    actions = Param(list)
    conditions = Param(list)
    frequency = Param(int)
    request = Param(Request, required=False)
    using = router.db_for_write(Project)

    def call(self):
        self.rule = self._create_rule()
        return self.rule

    def _create_rule(self):
        kwargs = self._get_kwargs()
        rule = Rule.objects.create(**kwargs)

        return rule

    def _get_kwargs(self):
        data = {
            "filter_match": self.filter_match,
            "action_match": self.action_match,
            "actions": self.actions,
            "conditions": self.conditions,
            "frequency": self.frequency,
        }
        _kwargs = {
            "label": self.name,
            "environment_id": self.environment or None,
            "project": self.project,
            "data": data,
            "owner": self.owner,
        }
        return _kwargs
