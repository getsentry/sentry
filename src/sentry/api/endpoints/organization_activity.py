from sentry import features
from sentry.api.base import EnvironmentMixin
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import OrganizationActivitySerializer, serialize
from sentry.models import Activity, OrganizationMemberTeam, Project


class OrganizationActivityEndpoint(OrganizationMemberEndpoint, EnvironmentMixin):
    def get(self, request, organization, member):
        has_inbox = features.has("organizations:inbox", organization, actor=request.user)
        # There is an activity record created for both sides of the unmerge
        # operation, so we only need to include one of them here to avoid
        # showing the same entry twice.
        exclude = [Activity.UNMERGE_SOURCE]
        if not has_inbox:
            exclude.append(Activity.MARK_REVIEWED)
        queryset = (
            Activity.objects.filter(
                project__in=Project.objects.filter(
                    organization=organization,
                    teams__in=OrganizationMemberTeam.objects.filter(
                        organizationmember=member
                    ).values("team"),
                )
            )
            .exclude(type__in=exclude)
            .select_related("project", "group", "user")
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by="-datetime",
            on_results=lambda x: serialize(
                x,
                request.user,
                OrganizationActivitySerializer(
                    environment_func=self._get_environment_func(request, organization.id)
                ),
            ),
        )
