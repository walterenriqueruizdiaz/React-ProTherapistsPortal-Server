const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// TEST SCRIPT: Run this with 'node test_db.js'
// It will try to connect using the DATABASE_URL in your .env
const connectionString = process.env.DATABASE_URL;

console.log('--- DB CONNECTION TEST ---');
console.log('Using URL:', connectionString ? connectionString.split('@')[1] : 'NOT FOUND');

if (!connectionString || connectionString.includes('localhost')) {
    console.error('ERROR: Your DATABASE_URL is still pointing to localhost or is missing.');
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function test() {
    try {
        const client = await pool.connect();
        console.log('SUCCESS: Connected to the database!');
        const res = await client.query('SELECT NOW()');
        console.log('Database time:', res.rows[0].now);
        client.release();
    } catch (err) {
        console.error('FAILURE: Could not connect to the database.');
        console.error('Error details:', err.message);
    } finally {
        await pool.end();
    }
}

test();
