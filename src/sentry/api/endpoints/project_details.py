from __future__ import absolute_import

import six
import logging
from uuid import uuid4

from datetime import timedelta
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import features
from sentry.utils.data_filters import FilterTypes
from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import DetailedProjectSerializer
from sentry.api.serializers.rest_framework import ListField, OriginField
from sentry.models import (
    AuditLogEntryEvent, Group, GroupStatus, Project, ProjectBookmark, ProjectStatus,
    ProjectTeam, UserOption, Team,
)
from sentry.tasks.deletion import delete_project
from sentry.utils.apidocs import scenario, attach_scenarios

delete_logger = logging.getLogger('sentry.deletions.api')


@scenario('GetProject')
def get_project_scenario(runner):
    runner.request(
        method='GET', path='/projects/%s/%s/' % (runner.org.slug, runner.default_project.slug)
    )


@scenario('DeleteProject')
def delete_project_scenario(runner):
    with runner.isolated_project('Plain Proxy') as project:
        runner.request(method='DELETE', path='/projects/%s/%s/' %
                       (runner.org.slug, project.slug))


@scenario('UpdateProject')
def update_project_scenario(runner):
    with runner.isolated_project('Plain Proxy') as project:
        runner.request(
            method='PUT',
            path='/projects/%s/%s/' % (runner.org.slug, project.slug),
            data={
                'name': 'Plane Proxy',
                'slug': 'plane-proxy',
                'platform': 'javascript',
                'options': {
                    'sentry:origins': 'http://example.com\nhttp://example.invalid',
                }
            }
        )


def clean_newline_inputs(value, case_insensitive=True):
    result = []
    for v in value.split('\n'):
        if case_insensitive:
            v = v.lower()
        v = v.strip()
        if v:
            result.append(v)
    return result


class ProjectMemberSerializer(serializers.Serializer):
    isBookmarked = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()


class ProjectAdminSerializer(ProjectMemberSerializer):
    name = serializers.CharField(max_length=200)
    slug = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50)
    team = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50)
    digestsMinDelay = serializers.IntegerField(min_value=60, max_value=3600)
    digestsMaxDelay = serializers.IntegerField(min_value=60, max_value=3600)
    subjectPrefix = serializers.CharField(max_length=200)
    subjectTemplate = serializers.CharField(max_length=200)
    securityToken = serializers.RegexField(r'^[-a-zA-Z0-9+/=\s]+$', max_length=255)
    securityTokenHeader = serializers.RegexField(r'^[a-zA-Z0-9_\-]+$', max_length=20)
    verifySSL = serializers.BooleanField(required=False)
    defaultEnvironment = serializers.CharField(required=False)
    dataScrubber = serializers.BooleanField(required=False)
    dataScrubberDefaults = serializers.BooleanField(required=False)
    sensitiveFields = ListField(child=serializers.CharField(), required=False)
    safeFields = ListField(child=serializers.CharField(), required=False)
    scrubIPAddresses = serializers.BooleanField(required=False)
    scrapeJavaScript = serializers.BooleanField(required=False)
    allowedDomains = ListField(child=OriginField(), required=False)
    resolveAge = serializers.IntegerField(required=False)
    platform = serializers.CharField(required=False)

    def validate_digestsMaxDelay(self, attrs, source):
        if attrs[source] < attrs['digestsMinDelay']:
            raise serializers.ValidationError(
                'The maximum delay on digests must be higher than the minimum.'
            )
        return attrs

    def validate_allowedDomains(self, attrs, source):
        attrs[source] = filter(bool, attrs[source])
        if len(attrs[source]) == 0:
            raise serializers.ValidationError(
                'Empty value will block all requests, use * to accept from all domains'
            )
        return attrs

    def validate_slug(self, attrs, source):
        slug = attrs[source]
        project = self.context['project']
        other = Project.objects.filter(
            slug=slug,
            organization=project.organization,
        ).exclude(id=project.id).first()
        if other is not None:
            raise serializers.ValidationError(
                'Another project (%s) is already using that slug' % other.name
            )
        return attrs


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin'],
        'POST': ['project:write', 'project:admin'],
        # PUT checks for permissions based on fields
        'PUT': ['project:read', 'project:write', 'project:admin'],
        'DELETE': ['project:admin'],
    }


class ProjectDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = [RelaxedProjectPermission]

    def _get_unresolved_count(self, project):
        queryset = Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            project=project,
        )

        resolve_age = project.get_option('sentry:resolve_age', None)
        if resolve_age:
            queryset = queryset.filter(
                last_seen__gte=timezone.now() - timedelta(hours=int(resolve_age)),
            )

        return queryset.count()

    @attach_scenarios([get_project_scenario])
    def get(self, request, project):
        """
        Retrieve a Project
        ``````````````````

        Return details on an individual project.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :auth: required
        """
        data = serialize(project, request.user, DetailedProjectSerializer())

        include = set(filter(bool, request.GET.get('include', '').split(',')))
        if 'stats' in include:
            data['stats'] = {
                'unresolved': self._get_unresolved_count(project),
            }

        return Response(data)

    @attach_scenarios([update_project_scenario])
    def put(self, request, project):
        """
        Update a Project
        ````````````````

        Update various attributes and configurable settings for the given
        project.  Only supplied values are updated.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :param string name: the new name for the project.
        :param string slug: the new slug for the project.
        :param string team: the slug of new team for the project.
        :param string platform: the new platform for the project.
        :param boolean isBookmarked: in case this API call is invoked with a
                                     user context this allows changing of
                                     the bookmark flag.
        :param int digestsMinDelay:
        :param int digestsMaxDelay:
        :auth: required
        """
        has_project_write = (
            (request.auth and request.auth.has_scope('project:write'))
            or (request.access and request.access.has_scope('project:write'))
        )

        if has_project_write:
            serializer_cls = ProjectAdminSerializer
        else:
            serializer_cls = ProjectMemberSerializer

        serializer = serializer_cls(
            data=request.DATA,
            partial=True,
            context={
                'project': project,
                'request': request,
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        if not has_project_write:
            for key in six.iterkeys(ProjectAdminSerializer.base_fields):
                if request.DATA.get(key) and not result.get(key):
                    return Response(
                        {
                            'detail': ['You do not have permission to perform this action.']
                        },
                        status=403
                    )

        changed = False
        if result.get('slug'):
            project.slug = result['slug']
            changed = True

        if result.get('name'):
            project.name = result['name']
            changed = True

        old_team_id = None
        if result.get('team'):
            team_list = [
                t for t in Team.objects.get_for_user(
                    organization=project.organization,
                    user=request.user,
                )
                if request.access.has_team_scope(t, 'project:write')
                if t.slug == result['team']
            ]
            if not team_list:
                return Response(
                    {
                        'detail': ['The new team is not found.']
                    }, status=400
                )
            old_team_id = project.team_id
            project.team = team_list[0]
            changed = True

        if result.get('platform'):
            project.platform = result['platform']
            changed = True

        if changed:
            project.save()
            if old_team_id is not None:
                ProjectTeam.objects.filter(
                    project=project,
                    team_id=old_team_id,
                ).update(team=project.team)

        if result.get('isBookmarked'):
            try:
                with transaction.atomic():
                    ProjectBookmark.objects.create(
                        project_id=project.id,
                        user=request.user,
                    )
            except IntegrityError:
                pass
        elif result.get('isBookmarked') is False:
            ProjectBookmark.objects.filter(
                project_id=project.id,
                user=request.user,
            ).delete()

        if result.get('digestsMinDelay'):
            project.update_option(
                'digests:mail:minimum_delay', result['digestsMinDelay'])
        if result.get('digestsMaxDelay'):
            project.update_option(
                'digests:mail:maximum_delay', result['digestsMaxDelay'])
        if result.get('subjectPrefix') is not None:
            project.update_option('mail:subject_prefix',
                                  result['subjectPrefix'])
        if result.get('subjectTemplate'):
            project.update_option('mail:subject_template',
                                  result['subjectTemplate'])
        if result.get('defaultEnvironment') is not None:
            project.update_option('sentry:default_environment', result['defaultEnvironment'])
        if result.get('scrubIPAddresses') is not None:
            project.update_option('sentry:scrub_ip_address', result['scrubIPAddresses'])
        if result.get('securityToken') is not None:
            project.update_option('sentry:token', result['securityToken'])
        if result.get('securityTokenHeader') is not None:
            project.update_option('sentry:token_header', result['securityTokenHeader'])
        if result.get('verifySSL') is not None:
            project.update_option('sentry:verify_ssl', result['verifySSL'])
        if result.get('dataScrubber') is not None:
            project.update_option('sentry:scrub_data', result['dataScrubber'])
        if result.get('dataScrubberDefaults') is not None:
            project.update_option('sentry:scrub_defaults', result['dataScrubberDefaults'])
        if result.get('sensitiveFields') is not None:
            project.update_option('sentry:sensitive_fields', result['sensitiveFields'])
        if result.get('safeFields') is not None:
            project.update_option('sentry:safe_fields', result['safeFields'])
        # resolveAge can be None
        if 'resolveAge' in result:
            project.update_option(
                'sentry:resolve_age',
                0 if result.get('resolveAge') is None else int(
                    result['resolveAge']))
        if result.get('scrapeJavaScript') is not None:
            project.update_option('sentry:scrape_javascript', result['scrapeJavaScript'])
        if result.get('allowedDomains'):
            project.update_option('sentry:origins', result['allowedDomains'])

        if result.get('isSubscribed'):
            UserOption.objects.set_value(
                user=request.user, key='mail:alert', value=1, project=project
            )
        elif result.get('isSubscribed') is False:
            UserOption.objects.set_value(
                user=request.user, key='mail:alert', value=0, project=project
            )

        # TODO(dcramer): rewrite options to use standard API config
        if has_project_write:
            options = request.DATA.get('options', {})
            if 'sentry:origins' in options:
                project.update_option(
                    'sentry:origins', clean_newline_inputs(
                        options['sentry:origins'])
                )
            if 'sentry:resolve_age' in options:
                project.update_option('sentry:resolve_age', int(
                    options['sentry:resolve_age']))
            if 'sentry:scrub_data' in options:
                project.update_option('sentry:scrub_data', bool(
                    options['sentry:scrub_data']))
            if 'sentry:scrub_defaults' in options:
                project.update_option(
                    'sentry:scrub_defaults', bool(
                        options['sentry:scrub_defaults'])
                )
            if 'sentry:safe_fields' in options:
                project.update_option(
                    'sentry:safe_fields',
                    [s.strip().lower() for s in options['sentry:safe_fields']]
                )
            if 'sentry:sensitive_fields' in options:
                project.update_option(
                    'sentry:sensitive_fields',
                    [s.strip().lower()
                     for s in options['sentry:sensitive_fields']]
                )
            if 'sentry:scrub_ip_address' in options:
                project.update_option(
                    'sentry:scrub_ip_address',
                    bool(options['sentry:scrub_ip_address']),
                )
            if 'mail:subject_prefix' in options:
                project.update_option(
                    'mail:subject_prefix',
                    options['mail:subject_prefix'],
                )
            if 'sentry:default_environment' in options:
                project.update_option(
                    'sentry:default_environment',
                    options['sentry:default_environment'],
                )
            if 'sentry:csp_ignored_sources_defaults' in options:
                project.update_option(
                    'sentry:csp_ignored_sources_defaults',
                    bool(options['sentry:csp_ignored_sources_defaults'])
                )
            if 'sentry:csp_ignored_sources' in options:
                project.update_option(
                    'sentry:csp_ignored_sources',
                    clean_newline_inputs(options['sentry:csp_ignored_sources'])
                )
            if 'sentry:blacklisted_ips' in options:
                project.update_option(
                    'sentry:blacklisted_ips',
                    clean_newline_inputs(options['sentry:blacklisted_ips']),
                )
            if 'feedback:branding' in options:
                project.update_option(
                    'feedback:branding', '1' if options['feedback:branding'] else '0'
                )
            if 'sentry:reprocessing_active' in options:
                project.update_option(
                    'sentry:reprocessing_active', bool(
                        options['sentry:reprocessing_active'])
                )
            if 'filters:blacklisted_ips' in options:
                project.update_option(
                    'sentry:blacklisted_ips',
                    clean_newline_inputs(options['filters:blacklisted_ips'])
                )
            if 'filters:{}'.format(FilterTypes.RELEASES) in options:
                if features.has('projects:custom-inbound-filters', project, actor=request.user):
                    project.update_option(
                        'sentry:{}'.format(FilterTypes.RELEASES),
                        clean_newline_inputs(
                            options['filters:{}'.format(FilterTypes.RELEASES)])
                    )
                else:
                    return Response(
                        {
                            'detail': ['You do not have that feature enabled']
                        }, status=400
                    )
            if 'filters:{}'.format(FilterTypes.ERROR_MESSAGES) in options:
                if features.has('projects:custom-inbound-filters', project, actor=request.user):
                    project.update_option(
                        'sentry:{}'.format(FilterTypes.ERROR_MESSAGES),
                        clean_newline_inputs(
                            options['filters:{}'.format(
                                FilterTypes.ERROR_MESSAGES)],
                            case_insensitive=False
                        )
                    )
                else:
                    return Response(
                        {
                            'detail': ['You do not have that feature enabled']
                        }, status=400
                    )

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_EDIT,
                data=project.get_audit_log_data(),
            )

        data = serialize(project, request.user, DetailedProjectSerializer())
        return Response(data)

    @attach_scenarios([delete_project_scenario])
    @sudo_required
    def delete(self, request, project):
        """
        Delete a Project
        ````````````````

        Schedules a project for deletion.

        Deletion happens asynchronously and therefor is not immediate.
        However once deletion has begun the state of a project changes and
        will be hidden from most public views.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :auth: required
        """
        if project.is_internal_project():
            return Response(
                '{"error": "Cannot remove projects internally used by Sentry."}',
                status=status.HTTP_403_FORBIDDEN
            )

        updated = Project.objects.filter(
            id=project.id,
            status=ProjectStatus.VISIBLE,
        ).update(status=ProjectStatus.PENDING_DELETION)
        if updated:
            transaction_id = uuid4().hex

            delete_project.apply_async(
                kwargs={
                    'object_id': project.id,
                    'transaction_id': transaction_id,
                },
                countdown=3600,
            )

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_REMOVE,
                data=project.get_audit_log_data(),
                transaction_id=transaction_id,
            )

            delete_logger.info(
                'object.delete.queued',
                extra={
                    'object_id': project.id,
                    'transaction_id': transaction_id,
                    'model': type(project).__name__,
                }
            )

        return Response(status=204)
