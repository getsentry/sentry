from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from enum import Enum, IntEnum
from typing import ClassVar

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    Model,
    control_silo_model,
)
from sentry.db.models.manager.base import BaseManager
from sentry.integrations.models.doc_integration import DocIntegration
from sentry.sentry_apps.models.sentry_app import SentryApp


class Feature(IntEnum):
    API = 0, "integrations-api"
    ISSUE_LINK = 1, "integrations-issue-link"
    STACKTRACE_LINK = 2, "integrations-stacktrace-link"
    EVENT_HOOKS = (
        3,
        "integrations-event-hooks",
    )
    PROJECT_MANAGEMENT = 4, "integrations-project-management"
    INCIDENT_MANAGEMENT = 5, "integrations-incident-management"
    FEATURE_FLAG = 6, "integrations-feature-flag"
    ALERTS = 7, "integrations-alert-rule"
    RELEASE_MANAGEMENT = 8, "integrations-release-management"
    VISUALIZATION = 9, "integrations-visualization"
    CHAT = 11, "integrations-chat"
    SESSION_REPLAY = 12, "integrations-session-replay"

    feature_name: str

    def __new__(cls, value: int, feature_name: str) -> Feature:
        obj = int.__new__(cls, value)
        obj._value_ = value
        obj.feature_name = feature_name

        return obj

    @classmethod
    def from_str(cls, feature_name: str) -> Feature:
        for value in cls:
            if value.feature_name == feature_name:
                return value
        raise ValueError(f"Invalid feature name provided: {feature_name}")

    @classmethod
    def from_int(cls, value: int) -> Feature:
        for enum_obj in cls:
            if enum_obj.value == value:
                return enum_obj
        raise ValueError(f"Invalid feature value provided: {value}")

    @classmethod
    def as_str_choices(cls) -> list[str]:
        return [obj.feature_name for obj in cls]

    @classmethod
    def as_int_choices(cls) -> list[int]:
        return [obj.value for obj in cls]

    @classmethod
    def as_choices(cls) -> list[tuple[int, str]]:
        return [(obj.value, obj.feature_name) for obj in cls]

    def __str__(self) -> str:
        return self.feature_name

    @classmethod
    def description(cls, feature: int, name: str) -> str:
        """
        This is copied from the previous Feature class implementation.
        TODO(Gabe): Make each of these descriptions either take a name, or not,
            then inline the descriptions with other enum values.
        """
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


INTEGRATION_MODELS_BY_TYPE: dict[int, type[SentryApp] | type[DocIntegration]] = {
    IntegrationTypes.SENTRY_APP.value: SentryApp,
    IntegrationTypes.DOC_INTEGRATION.value: DocIntegration,
}


class IntegrationFeatureManager(BaseManager["IntegrationFeature"]):
    def get_by_targets_as_dict(
        self, targets: Sequence[SentryApp | DocIntegration], target_type: IntegrationTypes
    ) -> dict[int, set[IntegrationFeature]]:
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

    def get_descriptions_as_dict(self, features: list[IntegrationFeature]) -> dict[int, str]:
        """
        Returns a dict mapping IntegrationFeature id (key) to description (value)
        This will do bulk requests for each type of Integration, rather than individual transactions for
        requested description.
        """
        # Create a mapping of {int_type: {int_id: description}}
        # e.g. {0 : {1 : "ExampleApp1", "2": "ExampleApp2"}}
        #      (where 0 == IntegrationTypes.SENTRY_APP.value)
        #      (where 1,2 == SentryApp.id)
        names_by_id_by_type: dict[int, dict[int, str]] = defaultdict(dict)
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
        incoming_features: list[int],
        target: SentryApp | DocIntegration,
        target_type: IntegrationTypes,
    ) -> None:
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


@control_silo_model
class IntegrationFeature(Model):
    __relocation_scope__ = RelocationScope.Excluded

    objects: ClassVar[IntegrationFeatureManager] = IntegrationFeatureManager()

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
    feature = BoundedPositiveIntegerField(default=Feature.API.value, choices=Feature.as_choices())
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integrationfeature"
        unique_together = (("target_id", "target_type", "feature"),)

    def feature_str(self) -> str:
        return str(Feature.from_int(self.feature))

    @property
    def description(self) -> str:
        from sentry.integrations.models.doc_integration import DocIntegration
        from sentry.sentry_apps.models.sentry_app import SentryApp

        if self.user_description:
            return self.user_description

        integration: SentryApp | DocIntegration
        if self.target_type == IntegrationTypes.SENTRY_APP.value:
            integration = SentryApp.objects.get(id=self.target_id)
        else:
            integration = DocIntegration.objects.get(id=self.target_id)
        return Feature.description(self.feature, integration.name)
