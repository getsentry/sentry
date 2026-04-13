from __future__ import annotations

import io

from PIL import Image, ImageDraw

from sentry.preprod.snapshots.image_diff.compare import compare_images, compare_images_batch


def _make_solid_image(width: int, height: int, color: tuple[int, int, int, int]) -> Image.Image:
    return Image.new("RGBA", (width, height), color)


class TestCompareImages:
    def test_identical_images(self) -> None:
        img = _make_solid_image(100, 100, (128, 128, 128, 255))
        result = compare_images(img, img.copy())
        assert result is not None
        assert result.changed_pixels == 0
        assert result.total_pixels == 100 * 100

    def test_different_sizes(self) -> None:
        small = _make_solid_image(30, 30, (100, 100, 100, 255))
        large = _make_solid_image(50, 50, (100, 100, 100, 255))
        result = compare_images(small, large)
        assert result is not None
        assert result.changed_pixels == 50 * 50 - 30 * 30
        assert result.total_pixels == 50 * 50
        assert result.aligned_height == 50
        assert result.before_width == 30
        assert result.before_height == 30
        assert result.after_width == 50
        assert result.after_height == 50

    def test_different_sizes_with_content_diff(self) -> None:
        before = _make_solid_image(50, 50, (100, 100, 100, 255))
        after = _make_solid_image(80, 80, (200, 200, 200, 255))
        result = compare_images(before, after)
        assert result is not None
        non_overlap = 80 * 80 - 50 * 50
        assert result.changed_pixels > non_overlap
        assert result.total_pixels == 80 * 80

    def test_different_height_same_width(self) -> None:
        before = _make_solid_image(100, 50, (100, 100, 100, 255))
        after = _make_solid_image(100, 80, (100, 100, 100, 255))
        result = compare_images(before, after)
        assert result is not None
        assert result.changed_pixels == 100 * 80 - 100 * 50
        assert result.total_pixels == 100 * 80
        assert result.before_width == 100
        assert result.after_width == 100
        assert result.before_height == 50
        assert result.after_height == 80

    def test_different_width_same_height(self) -> None:
        before = _make_solid_image(50, 100, (100, 100, 100, 255))
        after = _make_solid_image(80, 100, (100, 100, 100, 255))
        result = compare_images(before, after)
        assert result is not None
        assert result.changed_pixels == 80 * 100 - 50 * 100
        assert result.total_pixels == 80 * 100

    def test_smaller_after_image(self) -> None:
        before = _make_solid_image(50, 50, (100, 100, 100, 255))
        after = _make_solid_image(30, 30, (100, 100, 100, 255))
        result = compare_images(before, after)
        assert result is not None
        assert result.changed_pixels == 50 * 50 - 30 * 30
        assert result.total_pixels == 50 * 50
        assert result.before_width == 50
        assert result.after_width == 30

    def test_modified_block(self) -> None:
        before = _make_solid_image(100, 100, (100, 100, 100, 255))
        after = _make_solid_image(100, 100, (100, 100, 100, 255))
        draw = ImageDraw.Draw(after)
        draw.rectangle((10, 10, 29, 29), fill=(255, 0, 0, 255))
        result = compare_images(before, after)
        assert result is not None
        assert result.changed_pixels > 0
        assert result.total_pixels == 100 * 100

    def test_bytes_input(self) -> None:
        img = _make_solid_image(30, 30, (128, 128, 128, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_bytes = buf.getvalue()

        result = compare_images(img_bytes, img_bytes)
        assert result is not None
        assert result.changed_pixels == 0
        assert result.total_pixels == 30 * 30


class TestCompareImagesBatch:
    def test_batch_returns_correct_count(self) -> None:
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
        assert results[0].changed_pixels == 0
        assert results[1].changed_pixels == results[1].total_pixels

    def test_batch_single_pair_matches_single(self) -> None:
        before = _make_solid_image(50, 50, (100, 100, 100, 255))
        after = _make_solid_image(50, 50, (200, 200, 200, 255))

        single = compare_images(before, after)
        batch = compare_images_batch([(before, after)])[0]

        assert single is not None
        assert batch is not None
        assert single.changed_pixels == batch.changed_pixels
        assert single.total_pixels == batch.total_pixels
