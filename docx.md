# Database Migrations Guide

## Overview

This project uses **Flask-Migrate** (based on Alembic) to manage database schema changes. Migrations allow you to add, modify, or remove columns in tables without writing raw SQL queries manually.

---

## Environment Setup

Before running any commands, ensure that:

- Virtual environment (`.venv`) is active
- Dependencies are installed: `Flask-Migrate`, `alembic`
- `FLASK_APP` environment variable is set

```powershell
# Activate virtual environment (PowerShell)
.\.venv\Scripts\Activate.ps1

# Set FLASK_APP variable
$env:FLASK_APP = "main.py"

# Verify the application is found
flask routes

# Initialize Migrations (Run Once)
flask db init



# Create a Migration
flask db migrate -m "Description of changes"

# Apply Migrations
flask db upgrade

# Verify the Changes
flask shell



# Rollback one migration
flask db downgrade -1

# Rollback to specific version
flask db downgrade <revision_id>

# Show current database version
flask db current

# Show migration history
flask db history

# Preview SQL without applying
flask db upgrade --sql