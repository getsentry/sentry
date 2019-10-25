from __future__ import absolute_import

try:
    VERSION = __import__("pkg_resources").get_distribution("sentry-plugins").version
except Exception as e:
    VERSION = "unknown"

# Try to hook our webhook watcher into the rest of the watchers
# iff this module is installed in editable mode.
if "site-packages" not in __file__:
    import os

    root = os.path.normpath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
    node_modules = os.path.join(root, "node_modules")

    if os.path.isdir(node_modules):
        from django.conf import settings

        settings.SENTRY_WATCHERS += (
            (
                "webpack.plugins",
                [
                    os.path.join(node_modules, ".bin", "webpack"),
                    "--output-pathinfo",
                    "--watch",
                    "--config={}".format(os.path.join(root, "webpack.config.js")),
                ],
            ),
        )
