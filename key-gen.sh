CERT_DIR="cert"

mkdir -p "$CERT_DIR"

openssl genpkey -algorithm RSA -out "$CERT_DIR/private-key.pem" -pkeyopt rsa_keygen_bits:2048

openssl rsa -in "$CERT_DIR/private-key.pem" -pubout -out "$CERT_DIR/public-key.pem"

echo "Keys have been generated at: $CERT_DIR/ folder"