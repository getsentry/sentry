from __future__ import absolute_import

import six

from collections import Iterable
from sentry.mediators import Mediator, Param
from sentry.mediators.param import if_param


class Updater(Mediator):
    rule = Param("sentry.models.Rule")
    name = Param(six.string_types, required=False)
    environment = Param(int, required=False)
    project = Param("sentry.models.Project")
    action_match = Param(six.string_types, required=False)
    filter_match = Param(six.string_types, required=False)
    actions = Param(Iterable, required=False)
    conditions = Param(Iterable, required=False)
    frequency = Param(int, required=False)
    request = Param("rest_framework.request.Request", required=False)

    def call(self):
        self._update_name()
        self._update_environment()
        self._update_project()
        self._update_actions()
        self._update_action_match()
        self._update_filter_match()
        self._update_conditions()
        self._update_frequency()
        self.rule.save()
        return self.rule

    @if_param("name")
    def _update_name(self):
        self.rule.label = self.name

    def _update_environment(self):
        # environment can be None so we don't use the if_param decorator
        self.rule.environment_id = self.environment

    @if_param("project")
    def _update_project(self):
        self.rule.project = self.project

    @if_param("actions")
    def _update_actions(self):
        self.rule.data["actions"] = self.actions

    @if_param("action_match")
    def _update_action_match(self):
        self.rule.data["action_match"] = self.action_match

    @if_param("filter_match")
    def _update_filter_match(self):
        self.rule.data["filter_match"] = self.filter_match

    @if_param("conditions")
    def _update_conditions(self):
        self.rule.data["conditions"] = self.conditions

    @if_param("frequency")
    def _update_frequency(self):
        self.rule.data["frequency"] = self.frequency
