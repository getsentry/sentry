def build_discover_attachment(title: str, chart_url: str):
    return {
        "blocks": [
            {
                "type": "image",
                "title": {
                    "type": "plain_text",
                    "text": title,
                    "emoji": True,
                },
                "image_url": chart_url,
                "alt_text": "Discover Chart",
            }
        ]
    }
