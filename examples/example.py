"""
Quick start: resolve a few domains through the hosted Apify Actor.

Requires APIFY_TOKEN in the environment. `pip install apify-client`
"""

import os

from apify_client import ApifyClient


def main() -> None:
    client = ApifyClient(os.environ["APIFY_TOKEN"])

    run = client.actor("george.the.developer/linkedin-company-by-domain").call(
        run_input={
            "domains": ["stripe.com", "vercel.com", "gitlab.com"],
            "includeUnresolved": True,
            "mode": "resolve",
        }
    )

    for item in client.dataset(run["defaultDatasetId"]).iterate_items():
        domain = item.get("domain", "-")
        company = item.get("companyName") or "-"
        confidence = item.get("confidence", "?")
        charged = "$0.0075" if item.get("charged") else "$0"
        print(f"{domain:<20} {company:<24} {confidence:<8} {charged}")


if __name__ == "__main__":
    main()
