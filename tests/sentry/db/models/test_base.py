from unittest import TestCase

from sentry.db.models import DefaultFieldsModelExisting
from sentry.integrations.models import Integration, RepositoryProjectPathConfig
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.importchunk import (
    BaseImportChunk,
    ControlImportChunk,
    ControlImportChunkReplica,
    RegionImportChunk,
)
from sentry.models.projecttemplate import ProjectTemplate
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.notifications.models.notificationsettingbase import NotificationSettingBase
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.relocation.models.relocation import (
    Relocation,
    RelocationFile,
    RelocationValidation,
    RelocationValidationAttempt,
)
from sentry.sentry_apps.models import SentryAppInstallationForProvider
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription


class PreventDefaultFieldsModelExistingUseTest(TestCase):
    def all_subclasses(self, cls):
        return set(cls.__subclasses__()).union(
            [s for c in cls.__subclasses__() for s in self.all_subclasses(c)]
        )

    def test(self) -> None:
        assert self.all_subclasses(DefaultFieldsModelExisting) == {
            BaseImportChunk,
            ControlImportChunk,
            ControlImportChunkReplica,
            GroupSearchView,
            Integration,
            NotificationSettingBase,
            NotificationSettingOption,
            NotificationSettingProvider,
            ProjectTemplate,
            ProjectTransactionThreshold,
            ProjectTransactionThresholdOverride,
            ProjectUptimeSubscription,
            RegionImportChunk,
            Relocation,
            RelocationFile,
            RelocationValidation,
            RelocationValidationAttempt,
            RepositoryProjectPathConfig,
            SentryAppInstallationForProvider,
            UptimeSubscription,
        }, (
            "Don't use `DefaultFieldsModelExisting` for new models - Use `DefaultFieldsModel` "
            "instead. If you're retrofitting an existing model, add it to the list in this test."
        )
