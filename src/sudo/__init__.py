"""
sudo
~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""

try:
    VERSION = __import__("pkg_resources").get_distribution("sudo").version
except Exception:  # pragma: no cover
    VERSION = "unknown"
