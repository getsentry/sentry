from __future__ import absolute_import

import six

from sentry import roles
from sentry.app import quotas
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth import access
from sentry.models import (
    ApiKey, Organization, OrganizationAccessRequest, OrganizationAvatar, OrganizationOnboardingTask,
    OrganizationOption, OrganizationStatus, Project, ProjectStatus, Team, TeamStatus
)


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
        from sentry import features
        from sentry.app import env
        from sentry.api.serializers.models.project import ProjectSummarySerializer
        from sentry.api.serializers.models.team import TeamSerializer

        team_list = list(Team.objects.filter(
            organization=obj,
            status=TeamStatus.VISIBLE,
        ))

        for team in team_list:
            team._organization_cache = obj

        project_list = list(Project.objects.filter(
            organization=obj,
            status=ProjectStatus.VISIBLE,
        ))

        for project in project_list:
            project._organization_cache = obj

        onboarding_tasks = list(
            OrganizationOnboardingTask.objects.filter(
                organization=obj,
            ).select_related('user')
        )

        feature_list = []
        if features.has('organizations:sso', obj, actor=user):
            feature_list.append('sso')
        if features.has('organizations:onboarding', obj, actor=user) and \
                not OrganizationOption.objects.filter(organization=obj).exists():
            feature_list.append('onboarding')
        if features.has('organizations:api-keys', obj, actor=user) or \
                ApiKey.objects.filter(organization=obj).exists():
            feature_list.append('api-keys')
        if features.has('organizations:group-unmerge', obj, actor=user):
            feature_list.append('group-unmerge')
        if features.has('organizations:integrations-v3', obj, actor=user):
            feature_list.append('integrations-v3')
        if features.has('organizations:new-settings', obj, actor=user):
            feature_list.append('new-settings')
        if features.has('organizations:require-2fa', obj, actor=user):
            feature_list.append('require-2fa')
        if features.has('organizations:environments', obj, actor=user):
            feature_list.append('environments')
        if features.has('organizations:repos', obj, actor=user):
            feature_list.append('repos')
        if features.has('organizations:internal-catchall', obj, actor=user):
            feature_list.append('internal-catchall')
        if features.has('organizations:suggested-commits', obj, actor=user):
            feature_list.append('suggested-commits')
        if features.has('organizations:new-teams', obj, actor=user):
            feature_list.append('new-teams')
        if features.has('organizations:code-owners', obj, actor=user):
            feature_list.append('code-owners')
        if features.has('organizations:unreleased-changes', obj, actor=user):
            feature_list.append('unreleased-changes')
        if features.has('organizations:dashboard', obj, actor=user):
            feature_list.append('dashboard')
        if features.has('organizations:relay', obj, actor=user):
            feature_list.append('relay')

        if getattr(obj.flags, 'allow_joinleave'):
            feature_list.append('open-membership')
        if not getattr(obj.flags, 'disable_shared_issues'):
            feature_list.append('shared-issues')
        if getattr(obj.flags, 'require_2fa'):
            feature_list.append('require-2fa')

        context = super(DetailedOrganizationSerializer, self).serialize(obj, attrs, user)
        max_rate = quotas.get_maximum_quota(obj)
        context['quota'] = {
            'maxRate': max_rate[0],
            'maxRateInterval': max_rate[1],
            'accountLimit': int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key='sentry:account-rate-limit',
                    default=0,
                )
            ),
            'projectLimit': int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key='sentry:project-rate-limit',
                    default=100,
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
            'dataScrubber': bool(obj.get_option('sentry:require_scrub_data', False)),
            'dataScrubberDefaults': bool(obj.get_option('sentry:require_scrub_defaults', False)),
            'sensitiveFields': obj.get_option('sentry:sensitive_fields', None) or [],
            'safeFields': obj.get_option('sentry:safe_fields', None) or [],
            'scrubIPAddresses': bool(obj.get_option('sentry:require_scrub_ip_address', False)),
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
