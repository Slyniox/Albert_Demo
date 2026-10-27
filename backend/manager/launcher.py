#!/usr/bin/env python3

import json
from pathlib import Path

from backend.manager.model_connection import ModelConnection

CONFIG_FILE = Path(__file__).parent / "config.json"


def load_config():

    with open(CONFIG_FILE, "r") as f:
        return json.load(f)


config = load_config()

manager = ModelConnection(config["model"])
