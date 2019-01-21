const bcrypt = require("bcrypt-nodejs");

async function hashPlain(plain, seed) {
    return new Promise((resolve, reject) => {
        bcrypt.hash(plain, null, null, function(err, hash) {
            if (err) reject(err);
            else resolve(hash);
        });
    });
};

async function compare (plain, hashed) {
    return new Promise((resolve, reject) => {
        bcrypt.compare(plain, hashed, function(err, result) {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

exports.hashPassword = hashPlain;
exports.checkPassword = compare;

if (require.main === module) {
    async function main() {
        try {
            const hashed = await hashPlain("secret", 10);
            const match = await compare("secret", hashed);
            console.log(match);
        }
        catch (e) {
            console.log("error", e);
        }
    }
    
    main().then(x => x === undefined ? "" : console.log(x));
}

// End
