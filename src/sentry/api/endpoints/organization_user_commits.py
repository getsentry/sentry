from __future__ import absolute_import

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize

from sentry.models import Commit, CommitAuthor, Release, ReleaseCommit, UserEmail


class OrganizationUserCommitsEndpoint(OrganizationEndpoint):
    def get(self, request, organization, user_id, version):
        user_emails = UserEmail.objects.filter(
            user_id=user_id).values_list('email', flat=True)

        authors = CommitAuthor.objects.filter(email__in=user_emails)

        try:
            release = Release.objects.get(
                organization_id=organization.id,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = ReleaseCommit.objects.filter(
            release=release,
            commit__in=Commit.objects.filter(
                author__in=authors)
        ).select_related('commit', 'commit__author')

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='order',
            on_results=lambda x: serialize([rc.commit for rc in x], request.user),
        )


class OrganizationUserReleasesEndpoint(OrganizationEndpoint):

    def get(self, request, organization, user_id):
        user_emails = UserEmail.objects.filter(
            user_id=user_id).values_list('email', flat=True)

        authors = CommitAuthor.objects.filter(email__in=user_emails)

        queryset = Release.objects.filter(
            id__in=ReleaseCommit.objects.filter(
                commit__in=Commit.objects.filter(
                    author__in=authors)
            ).values_list('release_id', flat=True)
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            on_results=lambda x: serialize([item for item in x], request.user),
            paginator_cls=DateTimePaginator,
            default_per_page=5,
        )
