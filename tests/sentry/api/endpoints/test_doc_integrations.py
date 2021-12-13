from sentry.testutils import APITestCase


class DocIntegrationsEndpoint(APITestCase):
    url = "sentry-api-0-doc-integrations"

    def setUp(self):
        pass

    def test_read_docs_for_superuser(self):
        pass

    def test_read_docs_public(self):
        pass

    def test_create_doc_for_superuser(self):
        pass

    def test_create_invalid_auth(self):
        pass

    def test_create_repeated_slug(self):
        pass

    def test_create_invalid_metadata(self):
        pass

    def test_create_ignore_draft(self):
        pass
