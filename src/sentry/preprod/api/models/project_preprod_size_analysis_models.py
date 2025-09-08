from pydantic import BaseModel, Field


# Keep in sync with https://github.com/getsentry/launchpad/blob/ff2d2956d062b202206353747af3bdb5bf6062a5/src/launchpad/size/models/common.py#L92
class SizeAnalysisResults(BaseModel):
    download_size: int = Field(..., description="Estimated download size in bytes")
    install_size: int = Field(..., description="Estimated install size in bytes")
