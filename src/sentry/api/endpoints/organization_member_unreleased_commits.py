from django.db import connections

from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.serializers import serialize
from sentry.models import Commit, Repository, UserEmail
from sentry.utils.compat import zip

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


class OrganizationMemberUnreleasedCommitsEndpoint(OrganizationMemberEndpoint):
    def get(self, request, organization, member):
        email_list = list(
            UserEmail.objects.filter(user=member.user_id, is_verified=True).values_list(
                "email", flat=True
            )
        )
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
