"""
Errors that are user configuration errors and should be recorded as a halt for SLOs.
"""

# https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
DISCORD_HALT_ERROR_CODES = [
    50001,  # Missing access
]
