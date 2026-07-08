"""Shared issue/event formatter: converts issue/event data into text (markdown/xml) for LLMs.

One implementation used by every surface (REST API, RPC, direct import) so formatting
stays consistent and a new issue type renders without per-consumer changes.
"""
