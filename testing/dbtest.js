const mysql = require("mysql2");

const connection = mysql.createConnection({
host: "34.133.49.19",
  user: "loop_food",
  password: "food",
  database: "loop_food",
  port: 3306
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Connection failed:", err.message);
    return;
  }
  console.log("✅ Connected to MySQL!");
  connection.end();
});