from sentry.apidocs.pagination_linter import find_method_and_check_paginate

"""
Tests if linting works when `self.paginate` is called inside of the `get` method
"""


class TestPaginationLinterBase:
    def paginate(self, request=None, paginator=None, on_results=None):
        (request, paginator, on_results)
        pass


class PaginateInGetMethod(TestPaginationLinterBase):
    def update(self):
        pass

    def get(self, request):
        for i in range(100):
            pass

        def data_fn():
            try:
                pass
            except Exception as e:
                raise e.__class__(str(e))

            return None

        return self.paginate(
            request=request,
            paginator=None,
            on_results=lambda results: {"data": None},
        )

    def delete(self):
        pass


class PaginateOutsideGetMethod(TestPaginationLinterBase):
    def update(self):
        pass

    def data_fn(self):
        try:
            pass
        except Exception as e:
            raise e.__class__(str(e))

        return self.paginate(
            paginator=None,
            on_results=lambda results: {"data": None},
        )

    def get(self):
        for i in range(100):
            pass

        return self.data_fn

    def delete(self):
        pass


class PaginateMissing(TestPaginationLinterBase):
    def update(self):
        pass

    def get(self):
        for i in range(100):
            pass

        return None

    def delete(self):
        pass


class TestPaginationLinter:
    def test_paginate_in_get_method(self):
        assert find_method_and_check_paginate(__file__, "PaginateInGetMethod") is True

    def test_paginate_outside_get_method(self):
        assert find_method_and_check_paginate(__file__, "PaginateOutsideGetMethod") is True

    def test_paginate_missing(self):
        assert find_method_and_check_paginate(__file__, "PaginateMissing") is False
