from __future__ import absolute_import

from django.core.cache import cache
from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    Model,
    sane_repr
)


class Feature(object):
    """
    prerequesites: list of feature_id's that are requirements or tuples (which are ORs)
    """
    def __init__(self, slug, name, location, prerequisite=None):
        """
        Args:
            slug(str): unique
            name(str): Human readable
            type(str): what kind of feature: language, framework, code, webui, admin
            prerequesite(list): list of feature slugs or tuples. Tuples indicate OR relationships.
        """
        self.slug = slug
        self.name = name
        self.location = location
        self.prerequisite = prerequisite

    def __repr__(self):
        return self.name

features = [
    # Languages
    Feature("python", "Python", "language"),
    Feature("javascript", "JavaScript", "language"),
    Feature("node", "Node.js", "language"),
    Feature("ruby", "Ruby", "language"),
    Feature("java", "Java", "language"),
    Feature("cocoa", "Cocoa", "language"),
    Feature("objc", "Objective-C", "language"),
    Feature("php", "PHP", "language"),
    Feature("go", "Go", "language"),
    Feature("csharp", "C#", "language"),
    Feature("perl", "Perl", "language"),
    Feature("elixir", "Elixir", "language"),
    Feature("cfml", "CFML", "language"),
    Feature("groovy", "Groovy", "language"),
    Feature("csp", "CSP Reports", "language"),

    # Frameworks
    Feature("flask", "Flask", "framework", prerequisite=["python"]),
    Feature("django", "Django", "framework", prerequisite=["python"]),
    Feature("celery", "Celery", "framework", prerequisite=["python"]),
    Feature("bottle", "Bottle", "framework", prerequisite=["python"]),
    Feature("pylons", "Pylons", "framework", prerequisite=["python"]),
    Feature("tornado", "Tornado", "framework", prerequisite=["python"]),
    Feature("webpy", "web.py", "framework", prerequisite=["python"]),
    Feature("zope", "Zope", "framework", prerequisite=["python"]),

    # Configuration
    Feature("first_event", "First Event", "code", prerequisite=["first_project"]),
    Feature("release_tracking", "Release Tracking", "code", prerequisite=["first_event"]),
    Feature("environment_tracking", "Environment Tracking", "code", prerequisite=["first_event"]),
    Feature("user_tracking", "User Tracking", "code", prerequisite=["first_event"]),
    Feature("custom_tags", "Custom Tags", "code", prerequisite=["first_event"]),
    Feature("source_maps", "Source Maps", "code", prerequisite=["first_event", "javascript"]),
    Feature("user_feedback", "User Feedback", "code", prerequisite=["user_tracking"]),
    Feature("api", "API", "code", prerequisite=["first_event"]),
    Feature("breadcrumbs", "Breadcrumbs", "code", prerequisite=["first_event", ("python", "javascript", "node", "php")]),
    # Feature("resolve_in_commit", "Resolve in Commit", "code", prerequisite=["first_event", "releases"]),

    # Web UI
    Feature("first_project", "First Project", "web"),
    Feature("invite_team", "Invite Team", "web", prerequisite=["first_project"]),
    Feature("assignment", "Assign Issue", "web", prerequisite=["invite_team", "first_event"]),
    Feature("resolved_in_release", "Resolve in Next Release", "web", prerequisite=["release_tracking"]),
    # Feature("snooze", "Snooze Issue", "web", prerequisite=["first_event"]),
    # Feature("merge", "Merge Issues", "web", prerequisite=["first_event"]),
    Feature("advanced_search", "Advanced Search", "web", prerequisite=["first_event"]),
    Feature("saved_search", "Saved Search", "web", prerequisite=["advanced_search"]),
    Feature("inbound_filters", "Inbound Filters", "web", prerequisite=["first_event"]),
    Feature("alert_rules", "Alert Rules", "web", prerequisite=["first_event"]),
    Feature("issue_tracker_integration", "Issue Tracker Integration", "web", prerequisite=["first_project"]),
    Feature("notification_integration", "Notification Integration", "web", prerequisite=["first_project"]),
    # Feature("releases", "Releases", "web", prerequisite=["first_project"]),

    # Admin UI
    Feature("sso", "SSO", "admin", prerequisite=["invite_team"]),
    Feature("data_scrubbers", "Data Scrubbers", "admin", prerequisite=["first_event"]),

    # Future features
    # Feature("Health Metrics", "code"),
    # Feature("Customer Support Integration", "web", prerequisite=["User Tracking"]),
    # Feature("ETL Integration", "web", prerequesite=["First Event"]),
    # Feature("2-Factor Auth", "web", prerequisite=["Invite Team"]),
]

# No feature slug should be duplicate
assert len(features) == len(set([f.slug for f in features]))


class FeatureAdoptionManager(BaseManager):
    def record(self, organization_id, feature_slug, **kwargs):
        cache_key = 'featureadoption:%s:%s' % (
            organization_id,
            feature_slug,
        )
        if cache.get(cache_key) is None:
            row, created = self.create_or_update(
                organization_id=organization_id,
                feature_slug=feature_slug,
                values={
                    'date_modified': timezone.now(),
                    'complete': True,
                },
                defaults={
                    'applicable': True,  # Only on the first time should override CS
                },
            )
            # Store marker to prevent running all the time
            cache.set(cache_key, 1, 3600)
            return created

        return False


class FeatureAdoption(Model):
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    feature_slug = models.SlugField()
    date_completed = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(null=True)
    complete = models.BooleanField(default=False)
    applicable = models.BooleanField(default=True)  # Is this feature applicable to this team?
    data = JSONField()

    objects = FeatureAdoptionManager()

    __repr__ = sane_repr('organization_id', 'feature_slug', 'complete', 'applicable')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_featureadoption'
        unique_together = (('organization', 'feature_slug'),)
