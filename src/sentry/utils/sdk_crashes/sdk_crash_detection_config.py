from typing_extensions import TypedDict


class SDKCrashDetectionConfig(TypedDict):
    """The SDK crash detection configuration per SDK."""

    """The name of the SDK to detect crashes for."""
    sdk_name: str
    """The project to save the detected SDK crashes to"""
    project_id: int
    """The percentage of events to sample. 0.0 = 0%, 0.5 = 50% 1.0 = 100%."""
    sample_rate: float
