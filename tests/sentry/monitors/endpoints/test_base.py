from sentry.testutils.cases import APITestCase


class BaseProjectMonitorTest(APITestCase):
    __test__ = False

    def get_response(self, *args, **params):
        list_args = list(args)
        list_args.insert(1, self.project.slug)
        return super().get_response(*list_args, **params)


# TEMPORARY: intentional failure to test CI reporting (remove after verifying)
def test_intentional_failure_for_ci_reporting():
    assert False, "Intentional failure to test backend CI failure reporting"
