from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models import Integration, OrganizationIntegration, Repository
from sentry.plugins import bindings


class OrganizationRepositoriesEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def has_feature(self, request, organization):
        return features.has(
            'organizations:repos',
            organization=organization,
            actor=request.user,
        )

    def get(self, request, organization):
        """
        List an Organization's Repositories
        ```````````````````````````````````

        Return a list of version control repositories for a given organization.

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        if not self.has_feature(request, organization):
            return self.respond({
                'error_type': 'unavailable_feature',
                'detail': ['You do not have that feature enabled']
            }, status=403)

        queryset = Repository.objects.filter(
            organization_id=organization.id,
        )

        status = request.GET.get('status', 'active')
        if status == 'active':
            queryset = queryset.filter(
                status=ObjectStatus.VISIBLE,
            )
        elif status == 'deleted':
            queryset = queryset.exclude(
                status=ObjectStatus.VISIBLE,
            )
        # TODO(mn): Remove once old Plugins are removed or everyone migrates to
        # the new Integrations. Hopefully someday?
        elif status == 'unmigratable':
            repos = []

            org_integrations = OrganizationIntegration.objects.filter(
                organization_id=organization.id,
            )

            integrations = Integration.objects.filter(
                id__in=org_integrations.values('integration_id'),
                provider__in=('bitbucket', 'github', 'vsts'),
            )

            repos = [
                repo
                for i in integrations
                for repo in i.get_installation(organization.id)
                             .get_unmigratable_repositories()
            ]

            return Response(serialize(repos, request.user))

        elif status:
            queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, organization):
        if not request.user.is_authenticated():
            return Response(status=401)

        if not self.has_feature(request, organization):
            return self.respond({
                'error_type': 'unavailable_feature',
                'detail': ['You do not have that feature enabled']
            }, status=403)

        provider_id = request.DATA.get('provider')
        has_ghe = provider_id == 'integrations:github_enterprise' and features.has(
            'organizations:github-enterprise', organization, actor=request.user)
        has_bb = provider_id == 'integrations:bitbucket' and features.has(
            'organizations:bitbucket-integration', organization, actor=request.user)
        has_vsts = provider_id == 'integrations:vsts' and features.has(
            'organizations:vsts-integration', organization, actor=request.user)

        if features.has('organizations:internal-catchall', organization,
                        actor=request.user) or has_ghe or has_bb or has_vsts:
            if provider_id is not None and provider_id.startswith('integrations:'):
                try:
                    provider_cls = bindings.get('integration-repository.provider').get(provider_id)
                except KeyError:
                    return Response(
                        {
                            'error_type': 'validation',
                        }, status=400
                    )
                provider = provider_cls(id=provider_id)
                return provider.dispatch(request, organization)

        try:
            provider_cls = bindings.get('repository.provider').get(provider_id)
        except KeyError:
            return Response(
                {
                    'error_type': 'validation',
                }, status=400
            )

        provider = provider_cls(id=provider_id)
        return provider.dispatch(request, organization)
