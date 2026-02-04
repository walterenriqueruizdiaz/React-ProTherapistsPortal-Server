const prisma = require('./db');

async function test() {
    try {
        console.log("Testing patient creation...");
        const res = await prisma.patient.create({
            data: {
                dni: "test-" + Date.now(),
                firstName: "Test",
                lastName: "Patient",
                birthDate: new Date("1990-01-01"),
                mobilePhone: "123456789"
            }
        });
        console.log("Success:", res);
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

test();
