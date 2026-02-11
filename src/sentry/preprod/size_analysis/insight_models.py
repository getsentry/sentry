from pydantic import BaseModel

###
# Keep in sync with https://github.com/getsentry/launchpad/blob/main/src/launchpad/size/models/insights.py
###


class BaseInsightResult(BaseModel):
    """Base class for all insight results."""

    total_savings: int


class FileSavingsResult(BaseModel):
    """File savings information."""

    file_path: str
    total_savings: int


class FileSavingsResultGroup(BaseModel):
    """Group of files with savings information."""

    name: str
    files: list[FileSavingsResult]
    total_savings: int


class FilesInsightResult(BaseInsightResult):
    """Base class for insights that return a list of files with savings."""

    files: list[FileSavingsResult]


class GroupsInsightResult(BaseInsightResult):
    """Base class for insights that return grouped file results."""

    groups: list[FileSavingsResultGroup]


class DuplicateFilesInsightResult(GroupsInsightResult):
    """Results from duplicate files analysis.

    Groups contain duplicate files organized by filename.
    """

    pass


class LargeImageFileInsightResult(FilesInsightResult):
    """Results from large image files analysis.

    Files contain image files larger than 10MB with their sizes.
    """

    pass


class LargeVideoFileInsightResult(FilesInsightResult):
    """Results from large video files analysis.

    Files contain video files larger than 10MB with their sizes.
    """

    pass


class LargeAudioFileInsightResult(FilesInsightResult):
    """Results from large audio files analysis.

    Files contain audio files larger than 5MB with their sizes.
    """

    pass


class HermesDebugInfoInsightResult(FilesInsightResult):
    """Results from Hermes debug info analysis.

    Files contain Hermes bytecode files with potential debug info savings.
    """

    pass


class UnnecessaryFilesInsightResult(FilesInsightResult):
    """Results from unnecessary files analysis.

    Files contain unnecessary files with their sizes that could be removed.
    """

    pass


class WebPOptimizationInsightResult(FilesInsightResult):
    """Results from WebP optimization analysis.

    Files contain optimizeable image files.
    """

    pass


class LocalizedStringInsightResult(BaseInsightResult):
    """Results from localized string analysis.

    Reports the total estimated savings that could be achieved by optimizing localized strings.

    """

    pass


class LocalizedStringCommentsInsightResult(FilesInsightResult):
    """Results from localized string comments analysis.

    Files contain localized strings files with comment stripping opportunities.
    """

    pass


class SmallFilesInsightResult(FilesInsightResult):
    """Results from small files analysis.

    Files contain files smaller than filesystem block size with their sizes.
    """

    pass


class LooseImagesInsightResult(GroupsInsightResult):
    """Results from loose images analysis.

    Groups contain loose images that could be moved to asset catalogs.
    """

    pass


class MainBinaryExportMetadataResult(FilesInsightResult):
    """Results from main binary exported symbols metadata analysis.

    Files contain main binaries with export metadata that could be reduced.
    """

    pass


class OptimizableImageFile(BaseModel):
    """Information about an image file that can be optimized."""

    file_path: str
    current_size: int

    # Minification savings (optimizing current format)
    minify_savings: int
    minified_size: int | None = None

    # HEIC conversion savings (converting to HEIC format)
    conversion_savings: int
    heic_size: int | None = None

    # Asset catalog specific fields
    idiom: str | None = None
    colorspace: str | None = None

    @property
    def potential_savings(self) -> int:
        """Calculate total potential savings from the best optimization."""
        return max(self.minify_savings, self.conversion_savings)

    @property
    def best_optimization_type(self) -> str:
        """Return the optimization type that provides the most savings."""
        if self.conversion_savings > self.minify_savings:
            return "convert_to_heic"
        elif self.minify_savings > 0:
            return "minify"
        else:
            return "none"


class ImageOptimizationInsightResult(BaseInsightResult):
    """Results from image optimization analysis."""

    optimizable_files: list[OptimizableImageFile]


class StripBinaryFileInfo(BaseModel):
    """Savings information from stripping a Mach-O binary."""

    file_path: str
    debug_sections_savings: int
    symbol_table_savings: int
    total_savings: int


class StripBinaryInsightResult(BaseInsightResult):
    """Results from strip binary analysis."""

    files: list[StripBinaryFileInfo]
    total_debug_sections_savings: int
    total_symbol_table_savings: int


class AudioCompressionInsightResult(FilesInsightResult):
    """Results from audio compression analysis.

    Files contain audio files that can be compressed with their potential savings.
    """

    pass


class VideoCompressionFileSavingsResult(FileSavingsResult):
    """Information about a video file that can be compressed."""

    recommended_codec: str


class VideoCompressionInsightResult(BaseInsightResult):
    """Results from video compression analysis.

    Files contain video files that can be compressed with their potential savings.
    """

    files: list[VideoCompressionFileSavingsResult]


class MultipleNativeLibraryArchInsightResult(FilesInsightResult):
    """Results from multiple native library architectures analysis.

    Files contain native library files for non-arm64-v8a architectures that could be removed.
    """

    pass
