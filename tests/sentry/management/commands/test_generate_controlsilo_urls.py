import os.path
import tempfile
from io import StringIO

from django.core.management import call_command

from sentry.constants import MODULE_ROOT
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
        assert "new RegExp('^api/0/internal/integration-proxy/$')," in result
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

    def test_no_missing_urls(self):
        pattern_file = "static/app/data/controlsiloUrlPatterns.ts"
        project_root = os.path.dirname(os.path.dirname(MODULE_ROOT))
        pattern_filepath = os.path.join(project_root, pattern_file)
        with open(pattern_filepath) as f:
            current_state = f.read()

        result = self.call_command(format="js")
        for line in result.splitlines():
            msg = f"""
            New control silo URL patterns detected!

            The pattern: {line}

            Does not exist in the current pattern inventory. You should regenerate
            the pattern inventory with:

            getsentry django generate_controlsilo_urls --format=js --output={pattern_file}

            This command needs to be run in a getsentry environment
            in order to not lose patterns that are important for sentry.io
            """
            assert line in current_state, msg
