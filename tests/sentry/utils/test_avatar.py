from __future__ import annotations

import io

from PIL import Image

from sentry.utils.avatar import is_black_alpha_only


def _make_image(pixels: list[tuple[int, int, int, int]], mode: str = "RGBA") -> io.BytesIO:
    img = Image.new(mode, (len(pixels), 1))
    img.putdata(pixels)  # type: ignore[arg-type]
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


class TestIsBlackAlphaOnly:
    def test_all_black_opaque(self):
        buf = _make_image([(0, 0, 0, 255), (0, 0, 0, 255)])
        assert is_black_alpha_only(buf) is True

    def test_all_black_transparent(self):
        buf = _make_image([(0, 0, 0, 0), (0, 0, 0, 128)])
        assert is_black_alpha_only(buf) is True

    def test_one_non_black_pixel(self):
        buf = _make_image([(0, 0, 0, 255), (1, 0, 0, 255)])
        assert is_black_alpha_only(buf) is False

    def test_colored_pixel(self):
        buf = _make_image([(255, 0, 0, 255)])
        assert is_black_alpha_only(buf) is False

    def test_non_rgba_mode_returns_false(self):
        img = Image.new("RGB", (2, 1))
        img.putdata([(0, 0, 0), (0, 0, 0)])
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        assert is_black_alpha_only(buf) is False

    def test_resets_file_position(self):
        buf = _make_image([(0, 0, 0, 255)])
        is_black_alpha_only(buf)
        assert buf.tell() == 0
