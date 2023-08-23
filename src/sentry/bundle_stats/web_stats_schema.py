# see https://webpack.js.org/api/stats/

from dataclasses import asdict, dataclass
from typing import List, Mapping, Optional


@dataclass
class AssetInfo:
    immutable: Optional[bool] = None
    size: Optional[int] = None
    development: Optional[bool] = None
    hotModuleReplacement: Optional[bool] = None
    sourceFilename: Optional[str] = None
    javascriptModule: Optional[bool] = None


@dataclass
class Asset:
    chunkNames: Optional[List[str]] = None
    chunks: Optional[List[int]] = None
    comparedForEmit: Optional[bool] = None
    emitted: Optional[bool] = None
    name: Optional[str] = None
    size: Optional[int] = None
    info: Optional[AssetInfo] = None

    @classmethod
    def parse(cls, obj: Mapping) -> "Asset":
        asset = cls(**obj)
        info = obj.get("info", None)
        if info:
            asset.info = AssetInfo(**info)
        return asset


@dataclass
class Reason:
    loc: Optional[str] = None
    module: Optional[str] = None
    moduleId: Optional[int] = None
    moduleIdentifier: Optional[str] = None
    moduleName: Optional[str] = None
    type: Optional[str] = None
    userRequest: Optional[str] = None


@dataclass
class Origin:
    loc: Optional[str] = None
    module: Optional[str] = None
    moduleId: Optional[int] = None
    moduleIdentifier: Optional[str] = None
    moduleName: Optional[str] = None
    name: Optional[str] = None
    reasons: Optional[List[Reason]] = None

    @classmethod
    def parse(cls, obj: Mapping) -> "Origin":
        origin = cls(**obj)
        reasons = obj.get("reasons", None)
        if reasons:
            origin.reasons = [Reason(**r) for r in reasons]
        return origin


@dataclass
class Chunk:
    entry: Optional[bool] = None
    files: Optional[List[str]] = None
    filteredModules: Optional[int] = None
    id: Optional[int] = None
    initial: Optional[bool] = None
    modules: Optional[List[str]] = None
    names: Optional[List[str]] = None
    origins: Optional[List[Origin]] = None
    parents: Optional[int] = None
    rendered: Optional[bool] = None
    size: Optional[int] = None

    @classmethod
    def parse(cls, obj: Mapping) -> "Chunk":
        chunk = cls(**obj)
        origins = obj.get("origins", None)
        if origins:
            chunk.origins = [Origin.parse(o) for o in origins]
        return chunk


@dataclass
class Profile:
    building: Optional[int] = None
    dependencies: Optional[int] = None
    factory: Optional[int] = None


@dataclass
class Module:
    assets: Optional[List[Asset]] = None
    built: Optional[bool] = None
    cacheable: Optional[bool] = None
    chunks: Optional[List[int]] = None
    errors: Optional[int] = None
    failed: Optional[bool] = None
    id: Optional[int] = None
    identifier: Optional[str] = None
    name: Optional[str] = None
    moduleType: Optional[str] = None
    optional: Optional[bool] = None
    prefetched: Optional[bool] = None
    profile: Optional[Profile] = None
    reasons: Optional[List[Reason]] = None
    size: Optional[int] = None
    source: Optional[str] = None
    warnings: Optional[int] = None

    @classmethod
    def parse(cls, obj: Mapping) -> "Module":
        module = cls(**obj)
        assets = obj.get("assets", None)
        if assets:
            module.assets = [Asset.parse(a) for a in assets]

        reasons = obj.get("reasons", None)
        if reasons:
            module.reasons = [Reason(**r) for r in reasons]

        return module


@dataclass
class ModuleTraceDependency:
    loc: Optional[str] = None


@dataclass
class ModuleTrace:
    originIdentifier: Optional[str] = None
    originName: Optional[str] = None
    moduleIdentifier: Optional[str] = None
    moduleName: Optional[str] = None
    dependencies: Optional[List[ModuleTraceDependency]] = None
    originId: Optional[int] = None
    moduleId: Optional[int] = None

    @classmethod
    def parse(cls, obj: Mapping) -> "ModuleTrace":
        module_trace = cls(**obj)
        dependencies = obj.get("dependencies", None)
        if dependencies:
            module_trace.dependencies = [ModuleTraceDependency(**d) for d in dependencies]
        return module_trace


@dataclass
class ErrorOrWarning:
    moduleIdentifier: Optional[str]
    moduleName: Optional[str]
    loc: Optional[str]
    message: Optional[str]
    moduleId: Optional[int]
    moduleTrace: Optional[List[ModuleTrace]]
    details: Optional[str]
    stack: Optional[str]

    @classmethod
    def parse(cls, obj: Mapping) -> "ErrorOrWarning":
        error_or_warning = cls(**obj)
        module_trace = obj.get("moduleTrace", None)
        if module_trace:
            error_or_warning.moduleTrace = [ModuleTrace.parse(m) for m in module_trace]
        return error_or_warning


@dataclass
class WebStats:
    version: Optional[str] = None
    hash: Optional[str] = None
    time: Optional[int] = None
    publicPath: Optional[str] = None
    outputPath: Optional[str] = None
    assetsByChunkName: Optional[Mapping] = None
    assets: Optional[List[Asset]] = None
    chunks: Optional[List[Chunk]] = None
    modules: Optional[List[Module]] = None
    entryPoints: Optional[List[Mapping]] = None
    errors: Optional[List[ErrorOrWarning]] = None
    errorsCount: Optional[int] = None
    warnings: Optional[List[ErrorOrWarning]] = None
    warningsCount: Optional[int] = None

    @classmethod
    def parse(cls, obj: Mapping) -> "WebStats":
        web_stats = cls(**obj)

        assets = obj.get("assets", None)
        if assets:
            web_stats.assets = [Asset.parse(a) for a in assets]

        chunks = obj.get("chunks", None)
        if chunks:
            web_stats.chunks = [Chunk.parse(c) for c in chunks]

        modules = obj.get("modules", None)
        if modules:
            web_stats.modules = [Module.parse(m) for m in modules]

        errors = obj.get("errors", None)
        if errors:
            web_stats.errors = [ErrorOrWarning.parse(e) for e in errors]

        warnings = obj.get("warnings", None)
        if warnings:
            web_stats.warnings = [ErrorOrWarning.parse(w) for w in warnings]

        return web_stats

    def as_dict(self) -> Mapping:
        return asdict(self)
