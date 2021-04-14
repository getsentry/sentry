import colorsys
import hashlib


def get_hashed_color(string, l=0.5, s=0.5):  # noqa: E741
    val = int(hashlib.md5(string.encode("utf-8")).hexdigest()[:3], 16)
    tup = colorsys.hls_to_rgb(val / 4096.0, l, s)
    return f"#{int(tup[0] * 255):02x}{int(tup[1] * 255):02x}{int(tup[2] * 255):02x}"
