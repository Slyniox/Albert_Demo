#!/usr/bin/env python3

from backend.manager.proxy import app, config, manager


@app.get("/status")
def status():

    return {

        "running": manager.running()

    }


@app.get("/models")
def models():

    return {

        "available":

            [config["model"]["name"]]

    }
