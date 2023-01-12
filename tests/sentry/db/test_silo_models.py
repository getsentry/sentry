from sentry.api.serializers.base import registry
from sentry.data_export.models import ExportedData
from sentry.discover.models import DiscoverSavedQuery
from sentry.incidents.models import (
    AlertRuleActivity,
    AlertRuleTriggerAction,
    IncidentActivity,
    IncidentSeen,
    IncidentSnapshot,
    IncidentSubscription,
    TimeSeriesSnapshot,
)
from sentry.models import (
    Activity,
    Actor,
    ApiApplication,
    ApiAuthorization,
    ApiGrant,
    ApiKey,
    ApiToken,
    AssistantActivity,
    AuditLogEntry,
    AuthProvider,
    AuthProviderDefaultTeams,
    Broadcast,
    BroadcastSeen,
    Dashboard,
    GroupAssignee,
    GroupBookmark,
    GroupOwner,
    GroupSeen,
    GroupShare,
    GroupSubscription,
    MonitorCheckIn,
    MonitorLocation,
    NotificationSetting,
    Organization,
    OrganizationAccessRequest,
    OrganizationMember,
    OrganizationOnboardingTask,
    Project,
    ProjectBookmark,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    PromptsActivity,
    RecentSearch,
    Release,
    RuleActivity,
    SavedSearch,
    SentryApp,
    SentryAppAvatar,
    SentryAppComponent,
    SentryAppInstallation,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
    ServiceHook,
    Team,
    User,
    UserOption,
)
from tests.sentry.hybrid_cloud import (
    validate_models_have_silos,
    validate_no_cross_silo_foreign_keys,
)


class any_model:
    def __eq__(self, other):
        return True

    def __le__(self, other):
        return False

    def __ge__(self, other):
        return False

    def __hash__(self):
        return 1


decorator_exemptions = set()
fk_emeptions = {
    (Activity, User),
    (ApiAuthorization, ApiApplication),
    (ApiAuthorization, User),
    (ApiGrant, User),
    (ApiGrant, ApiApplication),
    (ApiGrant, Organization),
    (ApiKey, Organization),
    (AssistantActivity, User),
    (AuditLogEntry, Organization),
    (OrganizationMember, User),
    (AuthProviderDefaultTeams, Team),
    (AuthProvider, Organization),
    (SentryAppAvatar, SentryApp),
    (BroadcastSeen, Broadcast),
    (BroadcastSeen, User),
    (User, Dashboard),
    (GroupAssignee, User),
    (GroupBookmark, User),
    (Release, User),
    (GroupOwner, User),
    (GroupSeen, User),
    (GroupShare, User),
    (GroupSubscription, User),
    (SentryApp, Organization),
    (SentryAppComponent, SentryApp),
    (SentryAppInstallation, Organization),
    (SentryAppInstallation, ApiGrant),
    (SentryAppInstallationForProvider, SentryAppInstallation),
    (SentryAppInstallationToken, ApiToken),
    (SentryAppInstallationToken, SentryAppInstallation),
    (MonitorCheckIn, MonitorLocation),
    (NotificationSetting, Actor),
    (UserOption, Project),
    (UserOption, Organization),
    (OrganizationAccessRequest, User),
    (OrganizationOnboardingTask, User),
    (ProjectBookmark, User),
    (PromptsActivity, User),
    (RecentSearch, User),
    (RuleActivity, User),
    (SavedSearch, User),
    (ServiceHook, ApiApplication),
    (ProjectTransactionThresholdOverride, User),
    (ProjectTransactionThreshold, User),
    (User, Actor),
    (IncidentSeen, User),
    (IncidentSnapshot, TimeSeriesSnapshot),
    (IncidentActivity, User),
    (IncidentSubscription, User),
    (AlertRuleTriggerAction, SentryApp),
    (AlertRuleActivity, User),
    (DiscoverSavedQuery, User),
    (ExportedData, User),
}


def test_models_have_silos():
    validate_models_have_silos(decorator_exemptions)


def test_silo_foreign_keys():
    validate_no_cross_silo_foreign_keys(fk_emeptions)


# We really should not be using api serializers with the hybrid cloud data classes.
# For instance, if you need to serialize one of these objects, better to do so manually inside of some other serializer
# in general.  A big reason for this is that the hybrid cloud data classes are internal objects that are going to be
# used in an internal API -- they are designed specifically not to be rendered back in our public apis.
# Secondly, there should never be any custom serialization logic -- all of our hybrid cloud objects will be
# serialized and deserialized using narrow, very thin protocol logic, which will not be adhoc written per type.
# If you're unsure how to proceed, ping the project-hybrid-cloud channel to get some assistance.
def test_no_serializers_for_hybrid_cloud_dataclasses():
    for type in registry.keys():
        if "hybrid_cloud" in type.__module__:
            raise ValueError(
                f"{type!r} has a registered serializer, but we should not create serializers for hybrid cloud dataclasses."
            )
