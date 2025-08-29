// netlify/functions/auth.js

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid request format." }),
        };
    }

    const { email, password } = requestBody;

    if (!email || !password) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Email or password not provided." }),
        };
    }

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        const query = 'SELECT * FROM users WHERE email = $1';
        const values = [email];
        const res = await client.query(query, values);

        if (res.rows.length === 0) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Invalid email or password." }),
            };
        }

        const user = res.rows[0];
        const passwordIsValid = await bcrypt.compare(password, user.password);

        if (!passwordIsValid) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Invalid email or password." }),
            };
        }

        // If the password is valid, create a JWT token.
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, message: "Login successful." }),
        };

    } catch (err) {
        console.error('Database or authorization error:', err.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Server error: " + err.message }),
        };
    } finally {
        await client.end();
    }
};
