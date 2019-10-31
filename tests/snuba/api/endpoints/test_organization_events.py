from __future__ import absolute_import

import six
from six.moves.urllib.parse import urlencode

from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsEndpointTest, self).setUp()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)

    def assert_events_in_response(self, response, event_ids):
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(event_ids)

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event(event_id="a" * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event(event_id="b" * 32, group=group2, datetime=self.min_ago)

        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

    def test_simple_superuser(self):
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event(event_id="a" * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event(event_id="b" * 32, group=group2, datetime=self.min_ago)

        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

    def test_message_search_raw_text(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event(
            event_id="x" * 32, group=group, message="how to make fast", datetime=self.min_ago
        )
        event_2 = self.create_event(
            event_id="y" * 32, group=group, message="Delet the Data", datetime=self.min_ago
        )

        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, {"query": "delet"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_2.event_id
        assert response.data[0]["message"] == "Delet the Data"

    def test_message_search_tags(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        event_1 = self.create_event(
            event_id="x" * 32, group=group, message="how to make fast", datetime=self.min_ago
        )
        event_2 = self.create_event(
            event_id="y" * 32,
            group=group,
            message="Delet the Data",
            datetime=self.min_ago,
            user={"email": "foo@example.com"},
        )

        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, {"query": "user.email:foo@example.com"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_2.event_id
        assert response.data[0]["message"] == "Delet the Data"

        response = self.client.get(url, {"query": "!user.email:foo@example.com"}, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_1.event_id
        assert response.data[0]["message"] == "how to make fast"

    def test_invalid_search_terms(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        self.create_event(
            event_id="x" * 32, group=group, message="how to make fast", datetime=self.min_ago
        )

        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )

        response = self.client.get(url, {"query": "hi \n there"}, format="json")

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Parse error: 'search' (column 4). This is commonly caused by unmatched-parentheses. Enclose any text in double quotes."
        )

    def test_invalid_search_referencing_transactions(self):
        self.login_as(user=self.user)
        project = self.create_project()
        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, {"query": "transaction.duration:>200"}, format="json")

        assert response.status_code == 400, response.content
        assert "cannot reference non-events data" in response.data["detail"]

    def test_project_filtering(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        project2 = self.create_project(organization=org, teams=[team])
        project3 = self.create_project(organization=org)
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        group3 = self.create_group(project=project3)
        event_1 = self.create_event(event_id="a" * 32, group=group, datetime=self.min_ago)
        event_2 = self.create_event(event_id="b" * 32, group=group2, datetime=self.min_ago)
        self.create_event(event_id="c" * 32, group=group3, datetime=self.min_ago)

        base_url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )

        # test bad project id
        url = "%s?project=abc" % (base_url,)
        response = self.client.get(url, format="json")
        assert response.status_code == 400

        # test including project user doesn't have access to
        url = "%s?project=%s&project=%s" % (base_url, project.id, project3.id)
        response = self.client.get(url, format="json")

        assert response.status_code == 403

        # test filtering by project
        url = "%s?project=%s" % (base_url, project.id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

        # test only returns events from project user has access to
        response = self.client.get(base_url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

    def test_stats_period(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event(event_id="a" * 32, group=group, datetime=self.min_ago)
        self.create_event(event_id="b" * 32, group=group2, datetime=self.day_ago)

        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )
        url = "%s?statsPeriod=2h" % (url,)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

    def test_time_range(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        event_1 = self.create_event(event_id="a" * 32, group=group, datetime=self.min_ago)
        self.create_event(event_id="b" * 32, group=group2, datetime=self.day_ago)

        now = timezone.now()

        base_url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_slug": project.organization.slug},
        )

        # test swapped order of start/end
        url = "%s?%s" % (
            base_url,
            urlencode({"end": iso_format(before_now(hours=2)), "start": iso_format(now)}),
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 400

        url = "%s?%s" % (
            base_url,
            urlencode({"start": iso_format(before_now(hours=2)), "end": iso_format(now)}),
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

    def test_environment_filtering(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        environment = self.create_environment(project=project, name="production")
        environment2 = self.create_environment(project=project)
        null_env = self.create_environment(project=project, name="")

        events = []
        for event_id, env in [
            ("a" * 32, environment),
            ("b" * 32, environment),
            ("c" * 32, environment2),
            ("d" * 32, null_env),
        ]:
            events.append(
                self.store_event(
                    data={
                        "event_id": event_id,
                        "timestamp": iso_format(self.min_ago),
                        "fingerprint": ["put-me-in-group1"],
                        "environment": env.name or None,
                    },
                    project_id=project.id,
                )
            )

        event_1, event_2, event_3, event_4 = events

        base_url = reverse(
            "sentry-api-0-organization-events", kwargs={"organization_slug": org.slug}
        )

        # test as part of query param
        url = "%s?environment=%s" % (base_url, environment.name)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

        # test multiple as part of query param
        url = "%s?%s" % (
            base_url,
            urlencode((("environment", environment.name), ("environment", environment2.name))),
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response, [event_1.event_id, event_2.event_id, event_3.event_id]
        )

        # test multiple as part of query param with no env
        url = "%s?%s" % (
            base_url,
            urlencode((("environment", environment.name), ("environment", null_env.name))),
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response, [event_1.event_id, event_2.event_id, event_4.event_id]
        )

        # test as part of search
        url = "%s?query=environment:%s" % (base_url, environment.name)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

        # test as part of search - no environment
        url = '%s?query=environment:""' % (base_url,)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_4.event_id])

        # test nonexistent environment
        url = "%s?environment=notanenvironment" % (base_url,)
        response = self.client.get(url, format="json")
        assert response.status_code == 404

    def test_custom_tags(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        event_1 = self.create_event(
            event_id="a" * 32, group=group, datetime=self.min_ago, tags={"fruit": "apple"}
        )
        event_2 = self.create_event(
            event_id="b" * 32, group=group, datetime=self.min_ago, tags={"fruit": "orange"}
        )

        base_url = reverse(
            "sentry-api-0-organization-events", kwargs={"organization_slug": org.slug}
        )

        response = self.client.get("%s?query=fruit:apple" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])
        response = self.client.get("%s?query=!fruit:apple" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_2.event_id])

    def test_wildcard_search(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        event_1 = self.create_event(
            event_id="a" * 32, group=group, datetime=self.min_ago, tags={"sentry:release": "3.1.2"}
        )
        event_2 = self.create_event(
            event_id="b" * 32, group=group, datetime=self.min_ago, tags={"sentry:release": "4.1.2"}
        )
        event_3 = self.create_event(
            event_id="c" * 32, group=group, datetime=self.min_ago, user={"email": "foo@example.com"}
        )

        event_4 = self.create_event(
            event_id="d" * 32,
            group=group,
            datetime=self.min_ago,
            user={"email": "foo@example.commmmmmmm"},
        )

        base_url = reverse(
            "sentry-api-0-organization-events", kwargs={"organization_slug": org.slug}
        )

        response = self.client.get("%s?query=release:3.1.*" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

        response = self.client.get("%s?query=!release:3.1.*" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response, [event_2.event_id, event_3.event_id, event_4.event_id]
        )

        response = self.client.get("%s?query=user.email:*@example.com" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_3.event_id])

        response = self.client.get(
            "%s?query=!user.email:*@example.com" % (base_url,), format="json"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response, [event_1.event_id, event_2.event_id, event_4.event_id]
        )

    def test_has_tag(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)

        event_1 = self.create_event(
            event_id="a" * 32, group=group, datetime=self.min_ago, user={"email": "foo@example.com"}
        )
        event_2 = self.create_event(
            event_id="b" * 32,
            group=group,
            datetime=self.min_ago,
            tags={"example_tag": "example_value"},
        )

        base_url = reverse(
            "sentry-api-0-organization-events", kwargs={"organization_slug": org.slug}
        )

        response = self.client.get("%s?query=has:user.email" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

        # test custom tag
        response = self.client.get("%s?query=has:example_tag" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_2.event_id])

        response = self.client.get("%s?query=!has:user.email" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_2.event_id])

        # test custom tag
        response = self.client.get("%s?query=!has:example_tag" % (base_url,), format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_1.event_id])

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-organization-events", kwargs={"organization_slug": org.slug})
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_event_id_direct_hit(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        group = self.create_group(project=project)
        self.create_event(
            event_id="a" * 32, group=group, message="best event", datetime=self.min_ago
        )

        url = reverse("sentry-api-0-organization-events", kwargs={"organization_slug": org.slug})

        response = self.client.get(url, {"query": "a" * 32}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response["X-Sentry-Direct-Hit"] == "1"

    def test_event_id_direct_hit_miss(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        self.create_project(organization=org, teams=[team])

        url = reverse("sentry-api-0-organization-events", kwargs={"organization_slug": org.slug})

        response = self.client.get(url, {"query": "a" * 32}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_group_filtering(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        team = self.create_team(organization=org, members=[user])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        events = []
        for event_id, fingerprint in [
            ("a" * 32, "put-me-in-group1"),
            ("b" * 32, "put-me-in-group1"),
            ("c" * 32, "put-me-in-group2"),
            ("d" * 32, "put-me-in-group3"),
        ]:
            events.append(
                self.store_event(
                    data={
                        "event_id": event_id,
                        "timestamp": iso_format(self.min_ago),
                        "fingerprint": [fingerprint],
                    },
                    project_id=project.id,
                )
            )

        event_1, event_2, event_3, event_4 = events
        group_1, group_2, group_3 = event_1.group, event_3.group, event_4.group

        base_url = reverse(
            "sentry-api-0-organization-events", kwargs={"organization_slug": org.slug}
        )

        response = self.client.get(base_url, format="json", data={"group": [group_1.id]})
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_events_in_response(response, [event_1.event_id, event_2.event_id])

        response = self.client.get(base_url, format="json", data={"group": [group_3.id]})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        self.assert_events_in_response(response, [event_4.event_id])

        response = self.client.get(
            base_url, format="json", data={"group": [group_1.id, group_3.id]}
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        self.assert_events_in_response(
            response, [event_1.event_id, event_2.event_id, event_4.event_id]
        )

        response = self.client.get(
            base_url, format="json", data={"group": [group_1.id, group_2.id, group_3.id]}
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 4
        self.assert_events_in_response(
            response, [event_1.event_id, event_2.event_id, event_3.event_id, event_4.event_id]
        )

    def test_project_id_filter(self):
        team = self.create_team(organization=self.organization, members=[self.user])
        project = self.create_project(organization=self.organization, teams=[team])
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "best event",
                "timestamp": iso_format(self.min_ago),
            },
            project_id=project.id,
        )
        url = reverse(
            "sentry-api-0-organization-events", kwargs={"organization_slug": self.organization.slug}
        )

        self.login_as(user=self.user)
        response = self.client.get(
            url, {"query": "project_id:{}".format(project.id)}, format="json"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["projectID"] == six.text_type(project.id)

        response = self.client.get(url, {"query": "project_id:9"}, format="json")
        # project_id filter should apply
        assert response.status_code == 200, response.content
        assert len(response.data) == 0
