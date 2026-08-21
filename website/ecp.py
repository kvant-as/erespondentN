from cryptography import x509
from cryptography.hazmat.backends import default_backend
from common_models.src.time import current_utc_time

def check_certificate_expiry(cert_file):
    try:
        cert_data = cert_file.read()
        try:
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())
        except ValueError:
            cert = x509.load_der_x509_certificate(cert_data, default_backend())

        return cert.not_valid_before <= current_utc_time() <= cert.not_valid_after
    except Exception:
        return False

# cer_path = 'certificatenon.cer' 
# print(check_certificate_expiry(cer_path))
    