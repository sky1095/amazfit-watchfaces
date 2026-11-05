# Watchface delivery

After every completed watchface update, build the current version, generate a fresh
Zeus preview install QR, and show that QR in the final delivery so the user can
install it. Do not reuse a QR pointing to an older uploaded build. Include the
version and expiration date. If QR generation fails, report the failure clearly.
