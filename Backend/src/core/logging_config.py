"""
Centralised logging configuration.

Call setup_logging() once at application startup (in main.py).
All modules then use logging.getLogger(__name__) and inherit this config.
"""

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    log_level = getattr(logging, level.upper(), logging.INFO)

    fmt = "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt=fmt, datefmt=datefmt))

    root = logging.getLogger()
    root.setLevel(log_level)

    # Avoid duplicate handlers when reload=True (uvicorn dev mode)
    if not root.handlers:
        root.addHandler(handler)
    else:
        root.handlers = [handler]

    # Quiet noisy third-party loggers
    for noisy in ("httpx", "httpcore", "openai._base_client", "groq._base_client"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
