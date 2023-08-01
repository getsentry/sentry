from django.urls import reverse

from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.projectownership import ProjectOwnership
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format

ENDPOINT = "sentry-api-0-organization-force-auto-assignment"


class OrganizationForceAutoAssignmentEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        # Create codeowner rule
        self.code_mapping = self.create_code_mapping(project=self.project)
        self.rule = Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)])
        self.create_codeowners(
            self.project, self.code_mapping, raw="*.py @foo", schema=dump_schema([self.rule])
        )

        # Turn auto-assignment on
        self.ownership = ProjectOwnership.objects.create(
            project_id=self.project.id,
            fallthrough=True,
            auto_assignment=True,
            suspect_committer_auto_assignment=True,
            schema=dump_schema([self.rule]),
        )

    def python_event_data(self, message: str, path: str, filename: str):
        return {
            "message": message,
            "platform": "python",
            "fingerprint": [f"group-{message}"],
            "timestamp": iso_format(before_now(seconds=10)),
            "stacktrace": {
                "frames": [
                    {
                        "function": "handle_set_commits",
                        "abs_path": path,
                        "module": "sentry.api",
                        "in_app": True,
                        "lineno": 30,
                        "filename": filename,
                    }
                ]
            },
            "tags": {"sentry:release": self.release.version},
        }

    def test_put_single_group_success(self):
        # Auto assign group using codeowner
        event = self.store_event(
            data=self.python_event_data(
                message="Message!",
                path="/usr/src/sentry/src/sentry/api/foo.py",
                filename="sentry/api/foo.py",
            ),
            project_id=self.project.id,
        )
        GroupOwner.objects.create(
            group=event.group,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=None,
            team_id=self.team.id,
            project=self.project,
            organization=self.project.organization,
            context={"rule": str(self.rule)},
        )
        ProjectOwnership.handle_auto_assignment(self.project.id, event)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=event.group)
        assert assignee.team_id == self.team.id

        # Manually assign to someone else
        assert event.group
        GroupAssignee.objects.assign(event.group, self.user)
        assert len(GroupAssignee.objects.all()) == 1
        assignee = GroupAssignee.objects.get(group=event.group)
        assert assignee.user_id == self.user.id

        # Force autoassignment of the group
        url = reverse(ENDPOINT, args=[self.organization.name])
        response = self.client.put(url, {"group_ids": [event.group.id]})
        assert response.status_code == 200
        assert response.data == [event.group_id]
        assignee = GroupAssignee.objects.get(group=event.group)
        assert assignee.team_id == self.team.id

    def test_put_multiple_groups_success(self):
        # Auto assign groups using codeowner
        groups = []
        group_ids = []
        event_data = [
            {"message": "One!", "path": "/path/to/one.py", "filename": "one.py"},
            {"message": "Two!", "path": "/path/to/two.py", "filename": "two.py"},
            {"message": "Three!", "path": "/path/to/three.py", "filename": "three.py"},
        ]
        for data in event_data:
            event = self.store_event(
                data=self.python_event_data(
                    message=data["message"], path=data["path"], filename=data["filename"]
                ),
                project_id=self.project.id,
            )
            GroupOwner.objects.create(
                group=event.group,
                type=GroupOwnerType.CODEOWNERS.value,
                user_id=None,
                team_id=self.team.id,
                project=self.project,
                organization=self.project.organization,
                context={"rule": str(self.rule)},
            )
            if event.group:
                groups.append(event.group)
                group_ids.append(event.group.id)

            ProjectOwnership.handle_auto_assignment(self.project.id, event)
            assignee = GroupAssignee.objects.get(group=event.group)
            assert assignee.team_id == self.team.id

            # Manually assign to someone else
            assert event.group
            GroupAssignee.objects.assign(event.group, self.user)
            assignee = GroupAssignee.objects.get(group=event.group)
            assert assignee.user_id == self.user.id

        # Force autoassignment of the group
        url = reverse(ENDPOINT, args=[self.organization.name])
        response = self.client.put(url, {"group_ids": group_ids})
        assert response.status_code == 200
        assert response.data == group_ids
        assignees = GroupAssignee.objects.filter(group__in=groups)
        for assignee in assignees:
            assert assignee.team_id == self.team.id

    def test_put_too_many_groups(self):
        # Force autoassignment of over 100 group ids
        group_ids = [i for i in range(101)]
        url = reverse(ENDPOINT, args=[self.organization.name])
        response = self.client.put(url, {"group_ids": group_ids})
        assert response.status_code == 431
        assert response.data == {
            "detail": "Too many group ids. Number of group ids should be <= 100."
        }

    def test_put_too_many_requests(self):
        # Call force autoassignment
        group_ids = [1]
        url = reverse(ENDPOINT, args=[self.organization.name])
        self.client.put(url, {"group_ids": group_ids})

        # Call another force autoassignment for the same org within the minute
        group_ids = [1]
        url = reverse(ENDPOINT, args=[self.organization.name])
        response = self.client.put(url, {"group_ids": group_ids})
        assert response.status_code == 429
        assert response.data == {"detail": "Rate limit of 1 request per org per minute exceeded."}

        # Call force assignment for another organization
        new_org = self.create_organization(name="new", owner=self.user)
        group_ids = [1]
        url = reverse(ENDPOINT, args=[new_org.name])
        response = self.client.put(url, {"group_ids": group_ids})
        assert response.status_code != 429
        assert response.data != {"detail": "Rate limit of 1 request per org per minute exceeded."}
