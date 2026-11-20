from sentry.testutils.cases import TestCase


class NotebookTest(TestCase):
    def test_get_absolute_url(self) -> None:
        organization = self.create_organization(slug="org1")
        notebook = self.create_notebook(organization=organization)

        assert (
            notebook.get_absolute_url()
            == f"http://testserver/organizations/org1/seer/investigations/{notebook.id}/"
        )
