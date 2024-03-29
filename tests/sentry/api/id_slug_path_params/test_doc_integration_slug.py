from unittest.mock import patch

from django.test import TestCase

from sentry.testutils.cases import BaseTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test

from .id_or_slug_path_params_utils import APIIdOrSlugTestUtils


@no_silo_test
class DocIntegrationSlugTests(BaseTestCase, TestCase, APIIdOrSlugTestUtils):
    databases: set[str] | str = "__all__"

    @patch("sentry.api.bases.doc_integrations.DocIntegrationBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def doc_integration_test(self, endpoint_class, slug_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)
