from __future__ import annotations

import io

from PIL import Image, ImageDraw

from sentry.preprod.snapshots.image_diff.compare import compare_images, compare_images_batch


def _make_solid_image(width: int, height: int, color: tuple[int, int, int, int]) -> Image.Image:
    return Image.new("RGBA", (width, height), color)


class TestCompareImages:
    def test_identical_images(self):
        img = _make_solid_image(100, 100, (128, 128, 128, 255))
        result = compare_images(img, img.copy())
        assert result is not None
        assert result.diff_score == 0.0
        assert result.changed_pixels == 0
        assert result.total_pixels == 100 * 100

    def test_different_sizes(self):
        small = _make_solid_image(30, 30, (100, 100, 100, 255))
        large = _make_solid_image(50, 50, (100, 100, 100, 255))
        result = compare_images(small, large)
        assert result is not None
        assert result.width == 50
        assert result.aligned_height == 50
        assert result.before_width == 30
        assert result.before_height == 30
        assert result.after_width == 50
        assert result.after_height == 50

    def test_modified_block(self):
        before = _make_solid_image(100, 100, (100, 100, 100, 255))
        after = _make_solid_image(100, 100, (100, 100, 100, 255))
        draw = ImageDraw.Draw(after)
        draw.rectangle((10, 10, 29, 29), fill=(255, 0, 0, 255))
        result = compare_images(before, after)
        assert result is not None
        assert result.changed_pixels > 0

    def test_bytes_input(self):
        img = _make_solid_image(30, 30, (128, 128, 128, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_bytes = buf.getvalue()

        result = compare_images(img_bytes, img_bytes)
        assert result is not None
        assert result.diff_score == 0.0


class TestCompareImagesBatch:
    def test_batch_returns_correct_count(self):
        img1 = _make_solid_image(50, 50, (100, 100, 100, 255))
        img2 = _make_solid_image(50, 50, (200, 200, 200, 255))

        results = compare_images_batch(
            [
                (img1, img1.copy()),
                (img1, img2),
            ]
        )

        assert len(results) == 2
        assert results[0] is not None
        assert results[1] is not None
        assert results[0].diff_score == 0.0
        assert results[1].diff_score > 0.0

    def test_batch_single_pair_matches_single(self):
        before = _make_solid_image(50, 50, (100, 100, 100, 255))
        after = _make_solid_image(50, 50, (200, 200, 200, 255))

        single = compare_images(before, after)
        batch = compare_images_batch([(before, after)])[0]

        assert single is not None
        assert batch is not None
        assert single.diff_score == batch.diff_score
        assert single.changed_pixels == batch.changed_pixels
