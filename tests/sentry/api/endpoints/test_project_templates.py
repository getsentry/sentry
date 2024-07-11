from sentry.testutils.cases import APITestCase


class ProjectTemplateIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-project-templates"

    def test_permission_constraints(self):
        pass


class ProjectTemplateDetailTest(APITestCase):
    endpoint = "sentry-api-0-organization-project-template-details"

    def test_permission_constraints(self):
        pass
