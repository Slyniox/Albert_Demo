"""Connection checks for the externally managed OpenAI-compatible model API."""

import requests


class ModelConnection:
    def __init__(self, model_config):
        self.base_url = model_config["base_url"].rstrip("/")
        self.model_name = model_config["name"]
        self._available = False

    def ensure(self):
        """Fail startup with a useful message if the configured API is unavailable."""
        try:
            response = requests.get(f"{self.base_url}/v1/models", timeout=3)
            response.raise_for_status()
        except requests.RequestException as exc:
            self._available = False
            raise RuntimeError(
                "The configured OpenAI-compatible model API is unavailable at "
                f"{self.base_url}. Start a model server on port 8081 before Albert."
            ) from exc

        self._available = True

    def running(self):
        return self.model_name if self._available else None
