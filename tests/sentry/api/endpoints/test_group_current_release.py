from __future__ import absolute_import

from sentry.models import GroupRelease, ReleaseEnvironment
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import MockClock


class GroupCurrentReleaseTest(APITestCase):
    def _set_up_current_release(self, group_seen_on_latest_release):
        clock = MockClock()

        # Create several of everything, to exercise all filtering clauses.

        def set_up_organization():
            organization = self.create_organization()

            team = self.create_team(organization=organization)
            self.create_team_membership(team=team, user=self.user)

            environments = [
                self.create_environment(name=env_name, organization=organization)
                for env_name in ("production", "development")
            ]

            def set_up_project():
                project = self.create_project(organization=organization, teams=[team])
                for environment in environments:
                    environment.add_project(project)

                def set_up_release():
                    release = self.create_release(project=project)
                    for environment in environments:
                        ReleaseEnvironment.get_or_create(project, release, environment, clock())
                    return release

                groups = [self.create_group(project=project) for i in range(3)]
                target_group = groups[1]

                early_release = set_up_release()
                later_release = set_up_release()

                def seen_on(group, release, environment):
                    return GroupRelease.get_or_create(group, release, environment, clock())

                def set_up_group_releases(environment):
                    for release in (early_release, later_release):
                        for group in groups:
                            if group != target_group:
                                seen_on(group, release, environment)

                    latest_seen = seen_on(target_group, early_release, environment)
                    if group_seen_on_latest_release:
                        latest_seen = seen_on(target_group, later_release, environment)
                    return latest_seen

                target_releases = {env.name: set_up_group_releases(env) for env in environments}
                return target_group, target_releases

            set_up_project()
            target_group, target_releases = set_up_project()
            set_up_project()

            return target_group, target_releases

        set_up_organization()
        target_group, target_releases = set_up_organization()
        set_up_organization()

        return target_group, target_releases

    def _test_current_release(self, group_seen_on_latest_release, environments_to_query):
        target_group, target_releases = self._set_up_current_release(group_seen_on_latest_release)

        self.login_as(user=self.user)
        url = u"/api/0/issues/{}/current-release/".format(target_group.id)
        response = self.client.get(url, {"environment": environments_to_query}, format="json")
        assert response.status_code == 200
        return response.data["currentRelease"], target_releases

    def test_current_release_has_group_on_one_env(self):
        current_release, target_releases = self._test_current_release(True, ["production"])
        prod_release = target_releases["production"]

        assert current_release is not None
        assert current_release["firstSeen"] == prod_release.first_seen
        assert current_release["lastSeen"] == prod_release.last_seen

    def test_current_release_has_group_on_all_envs(self):
        current_release, target_releases = self._test_current_release(True, [])
        latest_release = target_releases["development"]

        assert current_release is not None
        assert current_release["firstSeen"] == latest_release.first_seen
        assert current_release["lastSeen"] == latest_release.last_seen

    def test_current_release_is_later(self):
        for envs in [[], ["production"], ["development"], ["production", "development"]]:
            current_release, target_releases = self._test_current_release(False, envs)
            assert current_release is None
