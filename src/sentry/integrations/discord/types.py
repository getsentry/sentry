from enum import Enum


class DiscordPermissions(Enum):
    # https://discord.com/developers/docs/topics/permissions#permissions
    VIEW_CHANNEL = 1 << 10
    SEND_MESSAGES = 1 << 11
    SEND_TTS_MESSAGES = 1 << 12
    EMBED_LINKS = 1 << 14
    ATTACH_FILES = 1 << 15
    MANAGE_THREADS = 1 << 34
    CREATE_PUBLIC_THREADS = 1 << 35
    CREATE_PRIVATE_THREADS = 1 << 36
    SEND_MESSAGES_IN_THREADS = 1 << 38

    MANAGE_GUILD = 1 << 5
    ADMINISTRATOR = 1 << 3
