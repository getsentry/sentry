from __future__ import absolute_import

import hashlib
import colorsys


def get_hashed_color(string, l=0.5, s=0.5):  # noqa: E741
    val = int(hashlib.md5(string.encode("utf-8")).hexdigest()[:3], 16)
    tup = colorsys.hls_to_rgb(val / 4096.0, l, s)
    return "#%02x%02x%02x" % (int(tup[0] * 255), int(tup[1] * 255), int(tup[2] * 255))
