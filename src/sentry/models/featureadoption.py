from __future__ import absolute_import

import logging

from django.db import models, IntegrityError, transaction
from django.utils import timezone
from jsonfield import JSONField

from sentry.adoption import manager
from sentry.adoption.manager import UnknownFeature
from sentry.db.models import (BaseManager, FlexibleForeignKey, Model, sane_repr)
from sentry.utils import redis

logger = logging.getLogger(__name__)

FEATURE_ADOPTION_REDIS_KEY = 'organization-feature-adoption:{}'

# Languages
manager.add(0, "python", "Python", "language")
manager.add(1, "javascript", "JavaScript", "language")
manager.add(2, "node", "Node.js", "language")
manager.add(3, "ruby", "Ruby", "language")
manager.add(4, "java", "Java", "language")
manager.add(5, "cocoa", "Cocoa", "language")
manager.add(6, "objc", "Objective-C", "language")
manager.add(7, "php", "PHP", "language")
manager.add(8, "go", "Go", "language")
manager.add(9, "csharp", "C#", "language")
manager.add(10, "perl", "Perl", "language")
manager.add(11, "elixir", "Elixir", "language")
manager.add(12, "cfml", "CFML", "language")
manager.add(13, "groovy", "Groovy", "language")
manager.add(14, "csp", "CSP Reports", "language")

# Frameworks
manager.add(20, "flask", "Flask", "integration", prerequisite=["python"])
manager.add(21, "django", "Django", "integration", prerequisite=["python"])
manager.add(22, "celery", "Celery", "integration", prerequisite=["python"])
manager.add(23, "bottle", "Bottle", "integration", prerequisite=["python"])
manager.add(24, "pylons", "Pylons", "integration", prerequisite=["python"])
manager.add(25, "tornado", "Tornado", "integration", prerequisite=["python"])
manager.add(26, "webpy", "web.py", "integration", prerequisite=["python"])
manager.add(27, "zope", "Zope", "integration", prerequisite=["python"])

# Configuration
manager.add(40, "first_event", "First Event", "code", prerequisite=["first_project"])
manager.add(41, "release_tracking", "Release Tracking", "code", prerequisite=["first_event"])
manager.add(
    42, "environment_tracking", "Environment Tracking", "code", prerequisite=["first_event"]
)
manager.add(43, "user_tracking", "User Tracking", "code", prerequisite=["first_event"])
manager.add(44, "custom_tags", "Custom Tags", "code", prerequisite=["first_event"])
manager.add(45, "source_maps", "Source Maps", "code",
            prerequisite=["first_event", ("javascript", "node")])
manager.add(46, "user_feedback", "User Feedback", "code", prerequisite=["user_tracking"])
# manager.add(47, "api", "API", "code", prerequisite=["first_event"])  #
# Challenging to determine what organization (i.e. api/0/organizations/)
manager.add(48, "breadcrumbs", "Breadcrumbs", "code", prerequisite=[
            "first_event", ("python", "javascript", "node", "php")])
# TODO(ehfeng) manager.add("resolve_in_commit", "Resolve in Commit",
# "code", prerequisite=["first_event", "releases"])

# Web UI
manager.add(60, "first_project", "First Project", "web")
manager.add(61, "invite_team", "Invite Team", "web", prerequisite=["first_project"])
manager.add(62, "assignment", "Assign Issue", "web", prerequisite=["invite_team", "first_event"])
manager.add(63, "resolved_in_release", "Resolve in Next Release", "web",
            prerequisite=["release_tracking"])
manager.add(64, "advanced_search", "Advanced Search", "web", prerequisite=["first_event"])
manager.add(65, "saved_search", "Saved Search", "web", prerequisite=["advanced_search"])
manager.add(66, "inbound_filters", "Inbound Filters", "web", prerequisite=["first_event"])
manager.add(67, "alert_rules", "Alert Rules", "web", prerequisite=["first_event"])
manager.add(68, "issue_tracker_integration", "Issue Tracker Integration", "web",
            prerequisite=["first_project"])
manager.add(69, "notification_integration", "Notification Integration", "web",
            prerequisite=["first_project"])
manager.add(70, "delete_and_discard", "Delete and Discard Future Events", "web",
            prerequisite=["first_event"])
# TODO(ehfeng) manager.add("snooze", "Snooze Issue", "web", prerequisite=["first_event"])
# TODO(ehfeng) manager.add("merge", "Merge Issues", "web", prerequisite=["first_event"])
# TODO(ehfeng) manager.add("releases", "Releases", "web", prerequisite=["first_project"])

# Admin UI
manager.add(80, "sso", "SSO", "admin", prerequisite=["invite_team"])
manager.add(81, "data_scrubbers", "Data Scrubbers", "admin", prerequisite=["first_event"])


class FeatureAdoptionManager(BaseManager):
    def in_cache(self, organization_id, feature_id):
        org_key = FEATURE_ADOPTION_REDIS_KEY.format(organization_id)
        feature_matches = []
        with redis.clusters.get('default').map() as client:
            feature_matches.append(client.sismember(org_key, feature_id))

        return any([p.value for p in feature_matches])

    def set_cache(self, organization_id, feature_id):
        org_key = FEATURE_ADOPTION_REDIS_KEY.format(organization_id)
        with redis.clusters.get('default').map() as client:
            client.sadd(org_key, feature_id)
        return True

    def get_all_cache(self, organization_id):
        org_key = FEATURE_ADOPTION_REDIS_KEY.format(organization_id)
        result = []
        with redis.clusters.get('default').map() as client:
            result.append(client.smembers(org_key))

        return {int(x) for x in set.union(* [p.value for p in result])}

    def bulk_set_cache(self, organization_id, *args):
        if not args:
            return False

        org_key = FEATURE_ADOPTION_REDIS_KEY.format(organization_id)
        with redis.clusters.get('default').map() as client:
            client.sadd(org_key, *args)
        return True

    def record(self, organization_id, feature_slug, **kwargs):
        try:
            feature_id = manager.get_by_slug(feature_slug).id
        except UnknownFeature as e:
            logger.exception(e)
            return False

        if not self.in_cache(organization_id, feature_id):
            row, created = self.create_or_update(
                organization_id=organization_id, feature_id=feature_id, complete=True
            )
            self.set_cache(organization_id, feature_id)
            return created

        return False

    def bulk_record(self, organization_id, feature_slugs, **kwargs):
        features = []

        try:
            feature_ids = set([manager.get_by_slug(slug).id for slug in feature_slugs])
        except UnknownFeature as e:
            logger.exception(e)
            return False

        incomplete_feature_ids = feature_ids - self.get_all_cache(organization_id)

        if not incomplete_feature_ids:
            return False

        for feature_id in incomplete_feature_ids:
            features.append(
                FeatureAdoption(
                    organization_id=organization_id, feature_id=feature_id, complete=True
                )
            )
        try:
            with transaction.atomic():
                self.bulk_create(features)
                return True

        except IntegrityError:
            # This can occur if redis somehow loses the set of complete features and
            # we attempt to insert duplicate (org_id, feature_id) rows
            # This also will happen if we get parallel processes running `bulk_record` and
            # `get_all_cache` returns in the second process before the first process
            # can `bulk_set_cache`.
            return False
        finally:
            return self.bulk_set_cache(organization_id, *incomplete_feature_ids)

    def get_by_slug(self, organization, slug):
        return self.filter(
            organization=organization, feature_id=manager.get_by_slug(slug).id
        ).first()


class FeatureAdoption(Model):
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    feature_id = models.PositiveIntegerField(choices=[(f.id, f.name) for f in manager.all()])
    date_completed = models.DateTimeField(default=timezone.now)
    complete = models.BooleanField(default=False)
    applicable = models.BooleanField(default=True)  # Is this feature applicable to this team?
    data = JSONField()

    objects = FeatureAdoptionManager()

    __repr__ = sane_repr('organization_id', 'feature_id', 'complete', 'applicable')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_featureadoption'
        unique_together = (('organization', 'feature_id'), )
