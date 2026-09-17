import logging
import os
import sys
import json
from pathlib import Path
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Log directory
LOGS_DIR = Path(__file__).resolve().parent / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

APP_LOG_FILE = LOGS_DIR / "beyond404.log"
AUDIT_LOG_FILE = LOGS_DIR / "audit.log"

# Standard formatter
DETAILED_FORMATTER = logging.Formatter(
    fmt="[%(asctime)s.%(msecs)03d] [%(levelname)-7s] [%(name)-18s] (%(filename)s:%(lineno)d) %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

CONSOLE_FORMATTER = logging.Formatter(
    fmt="[%(asctime)s] [%(levelname)-7s] [%(name)s] %(message)s",
    datefmt="%H:%M:%S"
)

_is_configured = False

def setup_logging(level=logging.INFO):
    global _is_configured
    if _is_configured:
        return

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # 1. Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(CONSOLE_FORMATTER)
    root_logger.addHandler(console_handler)

    # 2. Main Rotating App Log File (10 MB per file, max 5 backups)
    file_handler = RotatingFileHandler(
        APP_LOG_FILE,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(DETAILED_FORMATTER)
    root_logger.addHandler(file_handler)

    # Silence noisy external libraries
    logging.getLogger("aiortc").setLevel(logging.WARNING)
    logging.getLogger("aioice").setLevel(logging.WARNING)
    logging.getLogger("asyncpg").setLevel(logging.INFO)
    logging.getLogger("aiohttp.access").setLevel(logging.WARNING)

    _is_configured = True
    logging.getLogger("Beyond404.Init").info("Logging system initialized. File: %s", APP_LOG_FILE)

def get_logger(name: str) -> logging.Logger:
    if not _is_configured:
        setup_logging()
    return logging.getLogger(f"Beyond404.{name}")

# Audit Logger for Compliance and Security Logging
_audit_logger = None

def get_audit_logger():
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = logging.getLogger("Beyond404.Audit")
        _audit_logger.setLevel(logging.INFO)
        _audit_logger.propagate = False

        audit_handler = RotatingFileHandler(
            AUDIT_LOG_FILE,
            maxBytes=20 * 1024 * 1024,
            backupCount=10,
            encoding="utf-8"
        )
        audit_handler.setFormatter(logging.Formatter("%(message)s"))
        _audit_logger.addHandler(audit_handler)
    return _audit_logger

def log_audit_event(event_type: str, details: dict):
    """
    Records an immutable audit event in JSON-lines format for compliance,
    fraud tracking, and tamper verification.
    """
    logger = get_audit_logger()
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "details": details
    }
    logger.info(json.dumps(entry))
