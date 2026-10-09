// Usage: node server/hash-password.js <password>
// Prints a bcrypt hash to paste into ADMIN_PASSWORD_HASH in your .env
const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
    console.error('Usage: node server/hash-password.js <password>');
    process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
    console.log(hash);
});
