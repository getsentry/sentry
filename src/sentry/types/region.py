from dataclasses import dataclass


@dataclass
class Region:
    name: str
    subdomain: str
    is_private: bool = False
