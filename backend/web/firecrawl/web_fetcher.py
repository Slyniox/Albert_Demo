import httpx
import os
import httpx

FASTCRW_URL = os.getenv(
    "FASTCRW_URL",
    "http://127.0.0.1:3001",
).rstrip("/")

_TIMEOUT = httpx.Timeout(
    5.0,
    connect=3.0,
)

_LIMITS = httpx.Limits(
    max_connections=24,
    max_keepalive_connections=24,
)

# A shared client supports connection reuse across your ThreadPoolExecutor
# workers. httpx.Client supports concurrent requests from multiple threads.
_CLIENT = httpx.Client(
    timeout=_TIMEOUT,
    limits=_LIMITS,
)

def fetch_readable(url):
    """
    Fetch a webpage through the local fastCRW server.

    Returns the page structure expected by web_context.py:
        {
            "title": str,
            "url": str,
            "markdown": str,
        }

    Raises an exception on failure, allowing the existing caller
    to log the error and continue processing other URLs.
    """

    response = _CLIENT.post(
        f"{FASTCRW_URL}/v1/scrape",
        json={
            "url": url,
            "formats": ["markdown"],
            "onlyMainContent": True,
        },
    )

    response.raise_for_status()
    payload = response.json()

    if not payload.get("success"):
        raise RuntimeError(
            f"fastCRW scrape failed for {url}: "
            f"{payload.get('error', 'Unknown error')}"
        )

    data = payload.get("data") or {}
    metadata = data.get("metadata") or {}
    markdown = data.get("markdown") or ""

    if not markdown.strip():
        raise RuntimeError(
            f"fastCRW returned empty Markdown for {url}"
        )

    return {
        "title": metadata.get("title") or url,
        "url": metadata.get("sourceURL") or url,
        "markdown": markdown,
    }


def fetch_readable_many(
    urls: list[str],
    timeout = _TIMEOUT,
):
    results = []

    for url in urls:

        try:
            print(f"[WEB FETCH] {url}")

            result = fetch_readable(
                url,
                timeout=timeout,
            )

            print(
                f"[WEB FETCH] OK "
                f"({len(result['markdown'])} chars)"
            )

            results.append(result)

        except Exception as e:

            print(
                f"[WEB FETCH] FAILED "
                f"{url}: {e}"
            )

    return results


if __name__ == "__main__":

    import sys

    if len(sys.argv) != 2:
        print(
            f"Usage: python {sys.argv[0]} <url>"
        )
        raise SystemExit(1)

    result = fetch_readable(sys.argv[1])

    print("=" * 80)
    print("URL:", result["url"])
    print("TITLE:", result["title"])
    print("=" * 80)
    print(result["markdown"])