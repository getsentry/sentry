from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProcessingIssue, ReprocessingReport
from sentry.reprocessing import trigger_reprocessing
from sentry.utils.linksign import generate_signed_link
from sentry.web.helpers import render_to_response
from sentry.models import ApiToken
from sentry.utils.http import absolute_uri


class ProjectProcessingIssuesFixEndpoint(ProjectEndpoint):
    def get(self, request, project):
        token = None

        if request.user_from_signed_request and request.user.is_authenticated():
            tokens = [x for x in ApiToken.objects.filter(
                user=request.user
            ).all() if 'project:releases' in x.get_scopes()]
            if not tokens:
                token = ApiToken.objects.create(
                    user=request.user,
                    scope_list=['project:releases'],
                    refresh_token=None,
                    expires_at=None,
                )
            else:
                token = tokens[0]

        resp = render_to_response('sentry/reprocessing-script.sh', {
            'issues': [{
                'uuid': issue.data.get('image_uuid'),
                'arch': issue.data.get('image_arch'),
                'name': (issue.data.get('image_path') or '').split('/')[-1]
            } for issue in ProcessingIssue.objects.filter(
                project=project
            )],
            'project': project,
            'token': token,
            'server_url': absolute_uri('/'),
        })
        resp['Content-Type'] = 'text/plain'
        return resp

    def permission_denied(self, request):
        resp = render_to_response('sentry/reprocessing-script.sh', {
            'token': None
        })
        resp['Content-Type'] = 'text/plain'
        return resp


class ProjectProcessingIssuesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's processing issues.
        """
        num_issues = ProcessingIssue.objects.filter(
            project=project
        ).count()

        last_seen = ProcessingIssue.objects.filter(
            project=project
        ).order_by('-datetime').first()

        resolveable_issues, has_more = ProcessingIssue.objects \
            .find_resolved(project_id=project.id)

        reprocessing_issues = ReprocessingReport.objects \
            .filter(project_id=project.id).count()

        signed_link = None
        if num_issues > 0:
            signed_link = generate_signed_link(
                request.user,
                'sentry-api-0-project-fix-processing-issues',
                kwargs={
                    'project_slug': project.slug,
                    'organization_slug': project.organization.slug,
                }
            )

        data = {
            'hasIssues': num_issues > 0,
            'numIssues': num_issues,
            'lastSeen': last_seen and serialize(last_seen.datetime) or None,
            'resolveableIssues': len(resolveable_issues),
            'hasMoreResolveableIssues': has_more,
            'issuesProcessing': reprocessing_issues,
            'signedLink': signed_link
        }

        if request.GET.get('detailed') == '1':
            q = ProcessingIssue.objects.with_num_events().filter(
                project=project
            ).order_by('type', 'datetime')
            data['issues'] = [serialize(x, request.user) for x in q]

        return Response(serialize(data, request.user))

    def delete(self, request, project):
        """
        This deletes all open processing issues and triggers reprocessing if
        the user disabled the checkbox
        """
        reprocessing_active = bool(
            project.get_option('sentry:reprocessing_active', True)
        )
        if not reprocessing_active:
            ProcessingIssue.objects. \
                resolve_all_processing_issue(project=project)
            trigger_reprocessing(project)
            return Response(status=200)
        return Response(status=304)
