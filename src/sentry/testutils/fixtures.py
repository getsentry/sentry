from django.utils.functional import cached_property

from sentry.models import Activity, OrganizationMember, OrganizationMemberTeam
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now, iso_format


# XXX(dcramer): this is a compatibility layer to transition to pytest-based fixtures
# all of the memoized fixtures are copypasta due to our inability to use pytest fixtures
# on a per-class method basis
class Fixtures(Factories):
    @cached_property
    def session(self):
        return Factories.create_session()

    @cached_property
    def projectkey(self):
        return self.create_project_key(project=self.project)

    @cached_property
    def user(self):
        return self.create_user("admin@localhost", is_superuser=True)

    @cached_property
    def organization(self):
        # XXX(dcramer): ensure that your org slug doesnt match your team slug
        # and the same for your project slug
        return self.create_organization(name="baz", slug="baz", owner=self.user)

    @cached_property
    def team(self):
        team = self.create_team(organization=self.organization, name="foo", slug="foo")
        # XXX: handle legacy team fixture
        queryset = OrganizationMember.objects.filter(organization=self.organization)
        for om in queryset:
            OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)
        return team

    @cached_property
    def project(self):
        return self.create_project(
            name="Bar", slug="bar", teams=[self.team], fire_project_created=True
        )

    @cached_property
    def release(self):
        return self.create_release(project=self.project, version="foo-1.0")

    @cached_property
    def environment(self):
        return self.create_environment(name="development", project=self.project)

    @cached_property
    def group(self):
        # こんにちは konichiwa
        return self.create_group(message="\u3053\u3093\u306b\u3061\u306f")

    @cached_property
    def event(self):
        return self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "\u3053\u3093\u306b\u3061\u306f",
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )

    @cached_property
    def activity(self):
        return Activity.objects.create(
            group=self.group, project=self.project, type=Activity.NOTE, user=self.user, data={}
        )
