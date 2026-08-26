from flask import current_app

def create_database(app, db):
    with app.app_context():

        db.create_all()
        filling_database(db)

def filling_database(db):
    current_app.logger.debug('The database already contains the data!')