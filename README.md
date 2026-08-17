# erespondentN

![Python](https://img.shields.io/badge/python-3.10-blue)
[![Built by shlneo](https://img.shields.io/badge/Built%20by-Shlneo%20-blue)](https://github.com/shlneo)

### Info

The web application automates the processes of respondents forming reports in the form of departmental quarterly reports — "Information on consumption rates and (or) marginal levels of consumption of fuel and energy resources."

### Version

5.7.14

### Requirements

- python `3.12.0`
- add `.env` with settings
- PostgreSql `17`

### Database Settings

Create database `erespondentdb` with superuser `admin` for an example.

### Installation app

1. Clone the `erespondentN` repository.

2. Enter the commands:
```bash 
python -m venv .venv                    # Create a virtual environment
.venv\Scripts\activate                  # Activate the virtual environment
pip install -r requirements.txt         # Install the libraries
```

### Launch

```bash 
python main.py
```

### Migrations

```bash 
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


# Rollback one migration
flask db downgrade -1

# Rollback to specific version
flask db downgrade <revision_id>

# Show current database version
flask db current

# Show migration history
flask db history
```

### Link

[erespondentn.energoeffect.gov.by](https://erespondentn.energoeffect.gov.by/)