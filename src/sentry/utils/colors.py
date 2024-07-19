import colorsys
import hashlib


def get_hashed_color(string: str) -> str:
    val = int(hashlib.md5(string.encode()).hexdigest()[:3], 16)
    tup = colorsys.hls_to_rgb(val / 4096.0, 0.5, 0.5)
    return f"#{int(tup[0] * 255):02x}{int(tup[1] * 255):02x}{int(tup[2] * 255):02x}"
