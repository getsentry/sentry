from __future__ import absolute_import

import six

from sentry import roles
from sentry.app import quotas
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth import access
from sentry.constants import LEGACY_RATE_LIMIT_OPTIONS
from sentry.models import (
    ApiKey, Organization, OrganizationAccessRequest, OrganizationAvatar, OrganizationOnboardingTask,
    OrganizationOption, OrganizationStatus, Project, ProjectStatus, Team, TeamStatus
)

# org option default values
PROJECT_RATE_LIMIT_DEFAULT = 100
ACCOUNT_RATE_LIMIT_DEFAULT = 0
REQUIRE_SCRUB_DATA_DEFAULT = False
REQUIRE_SCRUB_DEFAULTS_DEFAULT = False
SENSITIVE_FIELDS_DEFAULT = None
SAFE_FIELDS_DEFAULT = None
STORE_CRASH_REPORTS_DEFAULT = False
REQUIRE_SCRUB_IP_ADDRESS_DEFAULT = False
SCRAPE_JAVASCRIPT_DEFAULT = True
TRUSTED_RELAYS_DEFAULT = None


@register(Organization)
class OrganizationSerializer(Serializer):
    def get_attrs(self, item_list, user):
        avatars = {
            a.organization_id: a
            for a in OrganizationAvatar.objects.filter(organization__in=item_list)
        }
        data = {}
        for item in item_list:
            data[item] = {
                'avatar': avatars.get(item.id),
            }
        return data

    def serialize(self, obj, attrs, user):
        if attrs.get('avatar'):
            avatar = {
                'avatarType': attrs['avatar'].get_avatar_type_display(),
                'avatarUuid': attrs['avatar'].ident if attrs['avatar'].file_id else None
            }
        else:
            avatar = {
                'avatarType': 'letter_avatar',
                'avatarUuid': None,
            }

        status = OrganizationStatus(obj.status)

        return {
            'id': six.text_type(obj.id),
            'slug': obj.slug,
            'status': {
                'id': status.name.lower(),
                'name': status.label,
            },
            'name': obj.name or obj.slug,
            'dateCreated': obj.date_added,
            'isEarlyAdopter': bool(obj.flags.early_adopter),
            'require2FA': bool(obj.flags.require_2fa),
            'avatar': avatar,
        }


class OnboardingTasksSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'task': obj.task,
            'status': dict(OrganizationOnboardingTask.STATUS_CHOICES).get(obj.status).lower(),
            'user': obj.user.name if obj.user else None,
            'dateCompleted': obj.date_completed,
            'data': obj.data,
        }


class DetailedOrganizationSerializer(OrganizationSerializer):
    def serialize(self, obj, attrs, user):
        from sentry import features, experiments
        from sentry.features.base import OrganizationFeature
        from sentry.app import env
        from sentry.api.serializers.models.project import ProjectSummarySerializer
        from sentry.api.serializers.models.team import TeamSerializer

        team_list = sorted(Team.objects.filter(
            organization=obj,
            status=TeamStatus.VISIBLE,
        ), key=lambda x: x.slug)

        for team in team_list:
            team._organization_cache = obj

        project_list = sorted(Project.objects.filter(
            organization=obj,
            status=ProjectStatus.VISIBLE,
        ), key=lambda x: x.slug)

        for project in project_list:
            project._organization_cache = obj

        onboarding_tasks = list(
            OrganizationOnboardingTask.objects.filter(
                organization=obj,
            ).select_related('user')
        )

        # Retrieve all registered organization features
        org_features = features.all(feature_type=OrganizationFeature).keys()
        feature_list = set()

        for feature_name in org_features:
            if features.has(feature_name, obj, actor=user):
                # Remove the organization scope prefix
                feature_list.add(feature_name[len('organizations:'):])

        # Do not include the onboarding feature if OrganizationOptions exist
        if 'onboarding' in feature_list and \
                OrganizationOption.objects.filter(organization=obj).exists():
            feature_list.remove('onboarding')

        # Include api-keys feature if they previously had any api-keys
        if 'api-keys' not in feature_list and ApiKey.objects.filter(organization=obj).exists():
            feature_list.add('api-keys')

        # These are new
        # default_manager.add('organizations:invite-members', OrganizationFeature)  # NOQA
        # default_manager.add('organizations:release-commits', OrganizationFeature)  # NOQA

        # Organization flag features (not provided through the features module)
        if OrganizationOption.objects.filter(
                organization=obj, key__in=LEGACY_RATE_LIMIT_OPTIONS).exists():
            feature_list.add('legacy-rate-limits')
        if getattr(obj.flags, 'allow_joinleave'):
            feature_list.add('open-membership')
        if not getattr(obj.flags, 'disable_shared_issues'):
            feature_list.add('shared-issues')
        if getattr(obj.flags, 'require_2fa'):
            feature_list.add('require-2fa')

        experiment_assignments = experiments.all(org=obj)

        context = super(DetailedOrganizationSerializer, self).serialize(obj, attrs, user)
        max_rate = quotas.get_maximum_quota(obj)
        context['experiments'] = experiment_assignments
        context['quota'] = {
            'maxRate': max_rate[0],
            'maxRateInterval': max_rate[1],
            'accountLimit': int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key='sentry:account-rate-limit',
                    default=ACCOUNT_RATE_LIMIT_DEFAULT,
                )
            ),
            'projectLimit': int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key='sentry:project-rate-limit',
                    default=PROJECT_RATE_LIMIT_DEFAULT,
                )
            ),
        }

        context.update({
            'isDefault': obj.is_default,
            'defaultRole': obj.default_role,
            'availableRoles': [{
                'id': r.id,
                'name': r.name,
            } for r in roles.get_all()],
            'openMembership': bool(obj.flags.allow_joinleave),
            'require2FA': bool(obj.flags.require_2fa),
            'allowSharedIssues': not obj.flags.disable_shared_issues,
            'enhancedPrivacy': bool(obj.flags.enhanced_privacy),
            'dataScrubber': bool(obj.get_option('sentry:require_scrub_data', REQUIRE_SCRUB_DATA_DEFAULT)),
            'dataScrubberDefaults': bool(obj.get_option('sentry:require_scrub_defaults', REQUIRE_SCRUB_DEFAULTS_DEFAULT)),
            'sensitiveFields': obj.get_option('sentry:sensitive_fields', SENSITIVE_FIELDS_DEFAULT) or [],
            'safeFields': obj.get_option('sentry:safe_fields', SAFE_FIELDS_DEFAULT) or [],
            'storeCrashReports': bool(obj.get_option('sentry:store_crash_reports', STORE_CRASH_REPORTS_DEFAULT)),
            'scrubIPAddresses': bool(obj.get_option('sentry:require_scrub_ip_address', REQUIRE_SCRUB_IP_ADDRESS_DEFAULT)),
            'scrapeJavaScript': bool(obj.get_option('sentry:scrape_javascript', SCRAPE_JAVASCRIPT_DEFAULT)),
            'trustedRelays': obj.get_option('sentry:trusted-relays', TRUSTED_RELAYS_DEFAULT) or [],
        })
        context['teams'] = serialize(team_list, user, TeamSerializer())
        context['projects'] = serialize(project_list, user, ProjectSummarySerializer())
        if env.request:
            context['access'] = access.from_request(env.request, obj).scopes
        else:
            context['access'] = access.from_user(user, obj).scopes
        context['features'] = feature_list
        context['pendingAccessRequests'] = OrganizationAccessRequest.objects.filter(
            team__organization=obj,
        ).count()
        context['onboardingTasks'] = serialize(onboarding_tasks, user, OnboardingTasksSerializer())
        return context
