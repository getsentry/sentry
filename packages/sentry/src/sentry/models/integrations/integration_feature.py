from collections import defaultdict
from enum import Enum
from typing import List, Union

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, BoundedPositiveIntegerField, Model
from sentry.db.models.manager import BaseManager
from sentry.models.integrations.doc_integration import DocIntegration
from sentry.models.integrations.sentry_app import SentryApp


class Feature:
    API = 0
    ISSUE_LINK = 1
    STACKTRACE_LINK = 2
    EVENT_HOOKS = 3
    PROJECT_MANAGEMENT = 4
    INCIDENT_MANAGEMENT = 5
    FEATURE_FLAG = 6
    ALERTS = 7
    RELEASE_MANAGEMENT = 8
    VISUALIZATION = 9
    CHAT = 11
    SESSION_REPLAY = 12

    @classmethod
    def as_choices(cls):
        return (
            (cls.API, "integrations-api"),
            (cls.ISSUE_LINK, "integrations-issue-link"),
            (cls.STACKTRACE_LINK, "integrations-stacktrace-link"),
            (cls.EVENT_HOOKS, "integrations-event-hooks"),
            (cls.PROJECT_MANAGEMENT, "integrations-project-management"),
            (cls.INCIDENT_MANAGEMENT, "integrations-incident-management"),
            (cls.FEATURE_FLAG, "integrations-feature-flag"),
            (cls.ALERTS, "integrations-alert-rule"),
            (cls.RELEASE_MANAGEMENT, "integrations-release-management"),
            (cls.VISUALIZATION, "integrations-visualization"),
            (cls.CHAT, "integrations-chat"),
            (cls.SESSION_REPLAY, "integrations-session-replay"),
        )

    @classmethod
    def as_str(cls, feature):
        if feature == cls.ISSUE_LINK:
            return "integrations-issue-link"
        if feature == cls.STACKTRACE_LINK:
            return "integrations-stacktrace-link"
        if feature == cls.EVENT_HOOKS:
            return "integrations-event-hooks"
        if feature == cls.PROJECT_MANAGEMENT:
            return "integrations-project-management"
        if feature == cls.INCIDENT_MANAGEMENT:
            return "integrations-incident-management"
        if feature == cls.FEATURE_FLAG:
            return "integrations-feature-flag"
        if feature == cls.ALERTS:
            return "integrations-alert-rule"
        if feature == cls.RELEASE_MANAGEMENT:
            return "integrations-release-management"
        if feature == cls.VISUALIZATION:
            return "integrations-visualization"
        if feature == cls.CHAT:
            return "integrations-chat"
        if feature == cls.SESSION_REPLAY:
            return "integrations-session-replay"
        return "integrations-api"

    @classmethod
    def description(cls, feature, name):
        if feature == cls.PROJECT_MANAGEMENT:
            return "Create or link issues in %s from Sentry issue groups." % name
        if feature == cls.INCIDENT_MANAGEMENT:
            return "Manage incidents and outages by sending Sentry notifications to %s." % name
        if feature == cls.FEATURE_FLAG:
            return "Improve visibility into feature flagging by sending Sentry errors to %s." % name
        if feature == cls.ISSUE_LINK:
            return "Organizations can **create or link Sentry issues** to another service."
        if feature == cls.STACKTRACE_LINK:
            return "Organizations can **open a line to Sentry's stack trace** in another service."
        if feature == cls.EVENT_HOOKS:
            return "%s allows organizations to **forward events to another service**." % name
        if feature == cls.ALERTS:
            return "Configure Sentry alerts to trigger notifications in %s." % name
        if feature == cls.RELEASE_MANAGEMENT:
            return "Notify Sentry of new releases being deployed in %s." % name
        if feature == cls.VISUALIZATION:
            return "Visualize Sentry data in %s." % name
        if feature == cls.CHAT:
            return "Get Sentry notifications in %s." % name
        if feature == cls.SESSION_REPLAY:
            return "Link Sentry errors to the session replay in %s." % name
        # default
        return (
            "%s can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course)."
            % name
        )


class IntegrationTypes(Enum):
    SENTRY_APP = 0
    DOC_INTEGRATION = 1


INTEGRATION_MODELS_BY_TYPE = {
    IntegrationTypes.SENTRY_APP.value: SentryApp,
    IntegrationTypes.DOC_INTEGRATION.value: DocIntegration,
}


class IntegrationFeatureManager(BaseManager):
    def get_by_targets_as_dict(
        self, targets: List[Union[SentryApp, DocIntegration]], target_type: IntegrationTypes
    ):
        """
        Returns a dict mapping target_id (key) to List[IntegrationFeatures] (value)
        """
        features = self.filter(
            target_type=target_type.value, target_id__in={target.id for target in targets}
        )
        features_by_target = defaultdict(set)
        for feature in features:
            features_by_target[feature.target_id].add(feature)
        return features_by_target

    def get_descriptions_as_dict(self, features: List["IntegrationFeature"]):
        """
        Returns a dict mapping IntegrationFeature id (key) to description (value)
        This will do bulk requests for each type of Integration, rather than individual transactions for
        requested description.
        """
        # Create a mapping of {int_type: {int_id: description}}
        # e.g. {0 : {1 : "ExampleApp1", "2": "ExampleApp2"}}
        #      (where 0 == IntegrationTypes.SENTRY_APP.value)
        #      (where 1,2 == SentryApp.id)
        names_by_id_by_type = defaultdict(dict)
        for integration_type, model in INTEGRATION_MODELS_BY_TYPE.items():
            model_ids = {
                feature.target_id for feature in features if feature.target_type == integration_type
            }
            for integration in model.objects.filter(id__in=model_ids):
                names_by_id_by_type[integration_type][integration.id] = integration.name
        # Interpret the above mapping to directly map {feature_id: description}
        return {
            feature.id: Feature.description(
                feature.feature, names_by_id_by_type[feature.target_type][feature.target_id]
            )
            for feature in features
        }

    def clean_update(
        self,
        incoming_features: List[int],
        target: Union[SentryApp, DocIntegration],
        target_type: IntegrationTypes,
    ):
        # Delete any unused features
        IntegrationFeature.objects.filter(
            target_id=target.id, target_type=target_type.value
        ).exclude(feature__in=incoming_features).delete()

        # Create any new features
        for feature in incoming_features:
            IntegrationFeature.objects.get_or_create(
                target_id=target.id,
                target_type=target_type.value,
                feature=feature,
            )


class IntegrationFeature(Model):
    __include_in_export__ = False

    objects = IntegrationFeatureManager()

    # the id of the sentry_app or doc_integration
    target_id = BoundedBigIntegerField()
    target_type = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (IntegrationTypes.SENTRY_APP, "sentry_app"),
            (IntegrationTypes.DOC_INTEGRATION, "doc_integration"),
        ),
    )
    user_description = models.TextField(null=True)
    feature = BoundedPositiveIntegerField(default=0, choices=Feature.as_choices())
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integrationfeature"
        unique_together = (("target_id", "target_type", "feature"),)

    def feature_str(self):
        return Feature.as_str(self.feature)

    @property
    def description(self):
        from sentry.models import DocIntegration, SentryApp

        if self.user_description:
            return self.user_description

        if self.target_type == IntegrationTypes.SENTRY_APP.value:
            integration = SentryApp.objects.get(id=self.target_id)
        else:
            integration = DocIntegration.objects.get(id=self.target_id)
        return Feature.description(self.feature, integration.name)
