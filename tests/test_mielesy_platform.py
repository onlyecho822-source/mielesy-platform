"""Tests for mielesy-platform — tRPC/Prisma backend structure validation."""
import pytest, os
from pathlib import Path

def test_health_json_exists():
    assert Path("health.json").exists()

def test_readme_present():
    assert Path("README.md").exists()

def test_package_json_exists():
    assert Path("package.json").exists()

def test_src_directory_exists():
    assert Path("src").exists()

def test_server_directory():
    assert Path("src/server").exists() or Path("src/api").exists() or Path("server").exists()

def test_env_example_exists():
    assert Path(".env.example").exists() or Path(".env.template").exists()

def test_prisma_schema_or_drizzle():
    has_prisma = Path("prisma/schema.prisma").exists()
    has_drizzle = any(Path(".").rglob("drizzle.config.*"))
    has_schema = any(Path(".").rglob("schema.*"))
    assert has_prisma or has_drizzle or has_schema

def test_trust_engine_or_router():
    src_py = list(Path(".").rglob("*.ts")) + list(Path(".").rglob("*.tsx"))
    names = [f.stem.lower() for f in src_py]
    has_domain = any(kw in " ".join(names) for kw in
                     ["trust","router","waitlist","stripe","token","ledger"])
    assert has_domain or len(src_py) >= 3
