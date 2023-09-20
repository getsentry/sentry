import tempfile
from io import StringIO

from django.core.management import call_command

from sentry.testutils.cases import TestCase


class TestGenerateControlsiloUrls(TestCase):
    def call_command(self, *args, **kwargs):
        out = StringIO()
        call_command("generate_controlsilo_urls", *args, stdout=out, stderr=StringIO, **kwargs)
        return out.getvalue()

    def test_skip_includes(self):
        result = self.call_command(format="js")
        # Shouldn't contain patterns for urls
        # that include more urls.
        assert "new RegExp('^api/0/$')" not in result

    def test_render_text(self):
        result = self.call_command(format="text")
        assert "^api/0/users/$" in result

    def test_render_code(self):
        result = self.call_command(format="js")
        assert "new RegExp('^api/0/users/$')," in result
        assert "new RegExp('^api/0/internal/integration-proxy/\\\\S*$')," in result
        assert "const patterns" in result
        assert "export default patterns;" in result

    def test_write_file(self):
        with tempfile.NamedTemporaryFile() as tf:
            self.call_command(format="js", output=tf.name)
            tf.seek(0)
            result = tf.read().decode("utf8")
        assert "This is generated code" in result
        assert "new RegExp('^api/0/users/$')," in result
        assert "const patterns" in result
        assert "export default patterns;" in result
