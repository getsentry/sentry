from sentry.web.forms import ReplayForm
from sentry.testutils import TestCase


class ReplayFormTest(TestCase):
    def test_it_works(self):
        form = ReplayForm(dict(
            url='http://example.com',
            method='GET',
            data='',
            headers='Foo: bar\nContent-Type: text/plain',
        ))
        assert form.is_valid()
        assert form.cleaned_data['headers'] == {'Foo': 'bar', 'Content-Type': 'text/plain'}

    def test_duplicate_headers(self):
        form = ReplayForm(dict(
            url='http://example.com',
            method='GET',
            data='',
            headers='Foo: bar\nContent-Type: text/plain\nFoo: baz',
        ))
        assert form.is_valid()
        assert form.cleaned_data['headers'] == {'Foo': 'bar, baz', 'Content-Type': 'text/plain'}
