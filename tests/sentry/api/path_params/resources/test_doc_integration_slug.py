from sentry.testutils.cases import TestCase

from .test_id_or_slug_path_params_mixin import APIIdOrSlugTestMixin


class DocIntegrationSlugTests(TestCase, APIIdOrSlugTestMixin):
    def doc_integration_test(self, endpoint_class, slug_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)
