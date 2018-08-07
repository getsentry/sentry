from __future__ import absolute_import

from sentry.db.models import (
    ArrayField, BoundedPositiveIntegerField, Model, FlexibleForeignKey, sane_repr
)
from django.db import models
from jsonfield import JSONField
from django.utils import timezone
from sentry.constants import ObjectStatus
from django.utils.translation import ugettext_lazy as _


class PluginFeatures(object):
    issue_basic = 'issue_basic'
    issue_sync = 'issue_sync'
    repository = 'repository'


class PluginHealth(Model):
    __core__ = True

    name = models.CharField(max_length=128, db_index=True)
    features_list = ArrayField(of=models.TextField)
    date_added = models.DateTimeField(default=timezone.now)
    link = models.URLField(null=True, blank=True)
    author = models.CharField(max_length=64)
    metadata = JSONField()
    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (ObjectStatus.VISIBLE,
             _('Active')), (ObjectStatus.PENDING_DELETION, _('Pending Deletion')),
            (ObjectStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
        ),
        db_index=True
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_pluginhealth'

    __repr__ = sane_repr('name')

    def run_tests(self):
        plugin_test = PluginHealthTest.objects.create(
            plugin_id=self.id,
        )
        plugin_test.test_data = plugin_test.run_tests(self)
        plugin_test.save()
        return plugin_test


class PluginHealthTest(Model):
    date_added = models.DateTimeField(default=timezone.now)
    plugin = FlexibleForeignKey('sentry.PluginHealth')
    test_data = JSONField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_pluginhealthtest'
        unique_together = (('plugin', 'date_added'))

    __repr__ = sane_repr('plugin', 'date_added')

    def run_tests(self, plugin_health):
        return {
            'configure_test': self.configure_test(plugin_health),
            'create_issue_test': self.create_issue_test(plugin_health),
            'link_issue_test': self.link_issue_test(plugin_health),
            'sync_assignment_test': self.sync_assignment_test(plugin_health),
            'sync_comment_test': self.sync_comment_test(plugin_health),
            'sync_status_test': self.sync_status_test(plugin_health),
            'repository_test': self.repository_test(plugin_health),
        }

    def configure_test(self, plugin_health):
        test_results = None
        return test_results

    def create_issue_test(self, plugin_health):
        if PluginFeatures.issue_basic not in plugin_health.features_list:
            return None
        test_results = None
        return test_results

    def link_issue_test(self, plugin_health):
        if PluginFeatures.issue_basic not in plugin_health.features_list:
            return None
        test_results = None
        return test_results

    def sync_assignment_test(self, plugin_health):
        if PluginFeatures.issue_sync not in plugin_health.features_list:
            return None
        test_results = None
        return test_results

    def sync_comment_test(self, plugin_health):
        if PluginFeatures.issue_sync not in plugin_health.features_list:
            return None
        test_results = None
        return test_results

    def sync_status_test(self, plugin_health):
        if PluginFeatures.issue_sync not in plugin_health.features_list:
            return None
        test_results = None
        return test_results

    def repository_test(self, plugin_health):
        if PluginFeatures.repository not in plugin_health.features_list:
            return None
        test_results = None
        return test_results
