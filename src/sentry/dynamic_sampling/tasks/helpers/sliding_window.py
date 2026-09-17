def generate_sliding_window_org_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:sliding_window_org_sample_rate"
