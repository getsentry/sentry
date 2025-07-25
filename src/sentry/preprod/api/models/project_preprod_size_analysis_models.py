from pydantic import BaseModel


class TreemapResults(BaseModel):
    total_install_size: int
    total_download_size: int


class SizeAnalysisResults(BaseModel):
    treemap: TreemapResults | None
