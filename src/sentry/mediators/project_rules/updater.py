from django.db import router
from rest_framework.request import Request

from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.models.actor import Actor
from sentry.models.project import Project
from sentry.models.rule import Rule


class Updater(Mediator):
    rule = Param(Rule)
    name = Param(str, required=False)
    owner = Param(int, required=False)
    environment = Param(int, required=False)
    project = Param(Project)
    action_match = Param(str, required=False)
    filter_match = Param(str, required=False)
    actions = Param(list, required=False)
    conditions = Param(list, required=False)
    frequency = Param(int, required=False)
    request = Param(Request, required=False)
    using = router.db_for_write(Project)

    def call(self):
        self._update_name()
        self._update_owner()
        self._update_environment()
        self._update_project()
        self._update_actions()
        self._update_action_match()
        self._update_filter_match()
        self._update_conditions()
        self._update_frequency()
        self.rule.save()
        return self.rule

    def _update_name(self):
        if self.name:
            self.rule.label = self.name

    def _update_owner(self) -> None:
        self.rule.owner = Actor.objects.get(id=self.owner) if self.owner else None

    def _update_environment(self):
        self.rule.environment_id = self.environment

    def _update_project(self):
        if self.project:
            self.rule.project = self.project

    def _update_actions(self):
        if self.actions:
            self.rule.data["actions"] = self.actions

    def _update_action_match(self):
        if self.action_match:
            self.rule.data["action_match"] = self.action_match

    def _update_filter_match(self):
        if self.filter_match:
            self.rule.data["filter_match"] = self.filter_match

    def _update_conditions(self):
        self.rule.data["conditions"] = self.conditions or []

    def _update_frequency(self):
        if self.frequency:
            self.rule.data["frequency"] = self.frequency
