from __future__ import absolute_import

import six

from django.conf import settings

from sentry import roles
from sentry.app import quotas
from sentry.api.serializers import Serializer, register, serialize
from sentry.constants import LEGACY_RATE_LIMIT_OPTIONS
from sentry.lang.native.utils import convert_crashreport_count
from sentry.models import (
    ApiKey,
    Organization,
    OrganizationAccessRequest,
    OrganizationAvatar,
    OrganizationOnboardingTask,
    OrganizationOption,
    OrganizationStatus,
    Project,
    ProjectStatus,
    Team,
    TeamStatus,
)

# org option default values
PROJECT_RATE_LIMIT_DEFAULT = 100
ACCOUNT_RATE_LIMIT_DEFAULT = 0
REQUIRE_SCRUB_DATA_DEFAULT = False
REQUIRE_SCRUB_DEFAULTS_DEFAULT = False
SENSITIVE_FIELDS_DEFAULT = None
SAFE_FIELDS_DEFAULT = None
ATTACHMENTS_ROLE_DEFAULT = settings.SENTRY_DEFAULT_ROLE
REQUIRE_SCRUB_IP_ADDRESS_DEFAULT = False
SCRAPE_JAVASCRIPT_DEFAULT = True
TRUSTED_RELAYS_DEFAULT = None
JOIN_REQUESTS_DEFAULT = True


@register(Organization)
class OrganizationSerializer(Serializer):
    def get_attrs(self, item_list, user):
        avatars = {
            a.organization_id: a
            for a in OrganizationAvatar.objects.filter(organization__in=item_list)
        }
        data = {}
        for item in item_list:
            data[item] = {"avatar": avatars.get(item.id)}
        return data

    def serialize(self, obj, attrs, user):
        from sentry import features
        from sentry.features.base import OrganizationFeature

        if attrs.get("avatar"):
            avatar = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": attrs["avatar"].ident if attrs["avatar"].file_id else None,
            }
        else:
            avatar = {"avatarType": "letter_avatar", "avatarUuid": None}

        status = OrganizationStatus(obj.status)

        # Retrieve all registered organization features
        org_features = features.all(feature_type=OrganizationFeature).keys()
        feature_list = set()

        for feature_name in org_features:
            if not feature_name.startswith("organizations:"):
                continue
            if features.has(feature_name, obj, actor=user):
                # Remove the organization scope prefix
                feature_list.add(feature_name[len("organizations:") :])

        # Do not include the onboarding feature if OrganizationOptions exist
        if (
            "onboarding" in feature_list
            and OrganizationOption.objects.filter(organization=obj).exists()
        ):
            feature_list.remove("onboarding")

        # Include api-keys feature if they previously had any api-keys
        if "api-keys" not in feature_list and ApiKey.objects.filter(organization=obj).exists():
            feature_list.add("api-keys")

        # Organization flag features (not provided through the features module)
        if OrganizationOption.objects.filter(
            organization=obj, key__in=LEGACY_RATE_LIMIT_OPTIONS
        ).exists():
            feature_list.add("legacy-rate-limits")
        if getattr(obj.flags, "allow_joinleave"):
            feature_list.add("open-membership")
        if not getattr(obj.flags, "disable_shared_issues"):
            feature_list.add("shared-issues")

        return {
            "id": six.text_type(obj.id),
            "slug": obj.slug,
            "status": {"id": status.name.lower(), "name": status.label},
            "name": obj.name or obj.slug,
            "dateCreated": obj.date_added,
            "isEarlyAdopter": bool(obj.flags.early_adopter),
            "require2FA": bool(obj.flags.require_2fa),
            "avatar": avatar,
            "features": feature_list,
        }


class OnboardingTasksSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "task": obj.task,
            "status": dict(OrganizationOnboardingTask.STATUS_CHOICES).get(obj.status).lower(),
            "user": obj.user.name if obj.user else None,
            "dateCompleted": obj.date_completed,
            "data": obj.data,
        }


class DetailedOrganizationSerializer(OrganizationSerializer):
    def get_attrs(self, item_list, user, **kwargs):
        return super(DetailedOrganizationSerializer, self).get_attrs(item_list, user)

    def serialize(self, obj, attrs, user, access):
        from sentry import experiments

        onboarding_tasks = list(
            OrganizationOnboardingTask.objects.filter(organization=obj).select_related("user")
        )

        experiment_assignments = experiments.all(org=obj, actor=user)

        context = super(DetailedOrganizationSerializer, self).serialize(obj, attrs, user)
        max_rate = quotas.get_maximum_quota(obj)
        context["experiments"] = experiment_assignments
        context["quota"] = {
            "maxRate": max_rate[0],
            "maxRateInterval": max_rate[1],
            "accountLimit": int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key="sentry:account-rate-limit",
                    default=ACCOUNT_RATE_LIMIT_DEFAULT,
                )
            ),
            "projectLimit": int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key="sentry:project-rate-limit",
                    default=PROJECT_RATE_LIMIT_DEFAULT,
                )
            ),
        }

        context.update(
            {
                "isDefault": obj.is_default,
                "defaultRole": obj.default_role,
                "availableRoles": [{"id": r.id, "name": r.name} for r in roles.get_all()],
                "openMembership": bool(obj.flags.allow_joinleave),
                "require2FA": bool(obj.flags.require_2fa),
                "allowSharedIssues": not obj.flags.disable_shared_issues,
                "enhancedPrivacy": bool(obj.flags.enhanced_privacy),
                "dataScrubber": bool(
                    obj.get_option("sentry:require_scrub_data", REQUIRE_SCRUB_DATA_DEFAULT)
                ),
                "dataScrubberDefaults": bool(
                    obj.get_option("sentry:require_scrub_defaults", REQUIRE_SCRUB_DEFAULTS_DEFAULT)
                ),
                "sensitiveFields": obj.get_option(
                    "sentry:sensitive_fields", SENSITIVE_FIELDS_DEFAULT
                )
                or [],
                "safeFields": obj.get_option("sentry:safe_fields", SAFE_FIELDS_DEFAULT) or [],
                "storeCrashReports": convert_crashreport_count(
                    obj.get_option("sentry:store_crash_reports")
                ),
                "attachmentsRole": six.text_type(
                    obj.get_option("sentry:attachments_role", ATTACHMENTS_ROLE_DEFAULT)
                ),
                "scrubIPAddresses": bool(
                    obj.get_option(
                        "sentry:require_scrub_ip_address", REQUIRE_SCRUB_IP_ADDRESS_DEFAULT
                    )
                ),
                "scrapeJavaScript": bool(
                    obj.get_option("sentry:scrape_javascript", SCRAPE_JAVASCRIPT_DEFAULT)
                ),
                "trustedRelays": obj.get_option("sentry:trusted-relays", TRUSTED_RELAYS_DEFAULT)
                or [],
                "allowJoinRequests": bool(
                    obj.get_option("sentry:join_requests", JOIN_REQUESTS_DEFAULT)
                ),
            }
        )
        context["access"] = access.scopes
        if access.role is not None:
            context["role"] = access.role
        context["pendingAccessRequests"] = OrganizationAccessRequest.objects.filter(
            team__organization=obj
        ).count()
        context["onboardingTasks"] = serialize(onboarding_tasks, user, OnboardingTasksSerializer())
        return context


class DetailedOrganizationSerializerWithProjectsAndTeams(DetailedOrganizationSerializer):
    def get_attrs(self, item_list, user, **kwargs):
        return super(DetailedOrganizationSerializerWithProjectsAndTeams, self).get_attrs(
            item_list, user
        )

    def _project_list(self, organization, access):
        member_projects = list(access.projects)
        member_project_ids = [p.id for p in member_projects]
        other_projects = list(
            Project.objects.filter(organization=organization, status=ProjectStatus.VISIBLE).exclude(
                id__in=member_project_ids
            )
        )
        project_list = sorted(other_projects + member_projects, key=lambda x: x.slug)

        for project in project_list:
            project._organization_cache = organization
        return project_list

    def _team_list(self, organization, access):
        member_teams = list(access.teams)
        member_team_ids = [p.id for p in member_teams]
        other_teams = list(
            Team.objects.filter(organization=organization, status=TeamStatus.VISIBLE).exclude(
                id__in=member_team_ids
            )
        )
        team_list = sorted(other_teams + member_teams, key=lambda x: x.slug)

        for team in team_list:
            team._organization_cache = organization
        return team_list

    def serialize(self, obj, attrs, user, access):
        from sentry.api.serializers.models.project import ProjectSummarySerializer
        from sentry.api.serializers.models.team import TeamSerializer

        context = super(DetailedOrganizationSerializerWithProjectsAndTeams, self).serialize(
            obj, attrs, user, access
        )

        team_list = self._team_list(obj, access)
        project_list = self._project_list(obj, access)

        context["teams"] = serialize(team_list, user, TeamSerializer())
        context["projects"] = serialize(project_list, user, ProjectSummarySerializer())

        return context
