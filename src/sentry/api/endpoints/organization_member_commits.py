from __future__ import absolute_import

from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize, CommitWithReleaseSerializer
from sentry.db.models.query import in_iexact
from sentry.models import Commit, CommitAuthor, UserEmail


class OrganizationMemberCommitsEndpoint(OrganizationMemberEndpoint):
    def get(self, request, organization, member):
        email_list = list(UserEmail.objects.filter(
            user=member.user_id,
            is_verified=True,
        ).values_list('email', flat=True))
        if email_list:
            queryset = Commit.objects.filter(
                organization_id=organization.id,
                author__in=CommitAuthor.objects.filter(
                    in_iexact('email', email_list),
                    organization_id=organization.id,
                )
            ).order_by('-date_added')
        else:
            queryset = Commit.objects.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            paginator_cls=OffsetPaginator,
            # TODO(dcramer): we dont want to return author here
            on_results=lambda x: serialize(x, request.user, CommitWithReleaseSerializer()),
        )
