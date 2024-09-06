from sentry.testutils.cases import APITestCase


class BaseProjectMonitorTest(APITestCase):
    __test__ = False

    def get_response(self, *args, **params):
        list_args = list(args)
        list_args.insert(1, self.project.slug)
        return super().get_response(*list_args, **params)
