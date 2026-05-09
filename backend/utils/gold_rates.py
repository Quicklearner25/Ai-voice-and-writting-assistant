import requests
from flask import current_app


def fetch_gold_rate():
    api_url = current_app.config.get("GOLD_RATE_API_URL")
    api_key = current_app.config.get("GOLD_RATE_API_KEY")
    fallback = current_app.config.get("FALLBACK_GOLD_RATE_24K", 6450)

    if not api_url:
        return {
            "rate_24k": fallback,
            "rate_22k": round(fallback * 0.916, 2),
            "source": "fallback",
            "currency": "INR",
            "unit": "gram",
        }

    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = requests.get(api_url, headers=headers, timeout=8)
        response.raise_for_status()
        payload = response.json()
        rate_24k = payload.get("rate_24k") or payload.get("price_gram_24k") or payload.get("rate")
        rate_24k = float(rate_24k)
        return {
            "rate_24k": round(rate_24k, 2),
            "rate_22k": round(rate_24k * 0.916, 2),
            "source": "live",
            "currency": payload.get("currency", "INR"),
            "unit": payload.get("unit", "gram"),
        }
    except Exception:
        return {
            "rate_24k": fallback,
            "rate_22k": round(fallback * 0.916, 2),
            "source": "fallback",
            "currency": "INR",
            "unit": "gram",
        }
