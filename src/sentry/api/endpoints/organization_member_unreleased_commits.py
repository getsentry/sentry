from django.db import connections

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.serializers import serialize
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.user.service import user_service

# TODO(dcramer): once LatestRepoReleaseEnvironment is backfilled, change this query to use the new
# schema [performance]
query = """
select c1.*
from sentry_commit c1
join (
    select max(c2.date_added) as date_added, c2.repository_id
    from sentry_commit as c2
    join (
        select distinct commit_id from sentry_releasecommit
        where organization_id = %%s
    ) as rc2
    on c2.id = rc2.commit_id
    group by c2.repository_id
) as cmax
on c1.repository_id = cmax.repository_id
where c1.date_added > cmax.date_added
and c1.author_id IN (
    select id
    from sentry_commitauthor
    where organization_id = %%s
    and upper(email) IN (%s)
)
order by c1.date_added desc
"""

quote_name = connections["default"].ops.quote_name


from rest_framework.request import Request
from rest_framework.response import Response


@region_silo_endpoint
class OrganizationMemberUnreleasedCommitsEndpoint(OrganizationMemberEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization, member) -> Response:
        email_list = [
            e.email
            for e in filter(
                lambda x: x.is_verified, user_service.get_user(member.user_id).useremails
            )
        ]
        if not email_list:
            return self.respond(
                {"commits": [], "repositories": {}, "errors": {"missing_emails": True}}
            )

        params = [organization.id, organization.id]
        for e in email_list:
            params.append(e.upper())

        queryset = Commit.objects.raw(query % (", ".join("%s" for _ in email_list),), params)

        results = list(queryset)

        if results:
            repos = list(Repository.objects.filter(id__in={r.repository_id for r in results}))
        else:
            repos = []

        return self.respond(
            {
                "commits": [
                    {
                        "id": c.key,
                        "message": c.message,
                        "dateCreated": c.date_added,
                        "repositoryID": str(c.repository_id),
                    }
                    for c in results
                ],
                "repositories": {
                    str(r.id): d for r, d in zip(repos, serialize(repos, request.user))
                },
            }
        )
