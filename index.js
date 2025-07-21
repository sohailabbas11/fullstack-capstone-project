const express = require('express');
const app = express();
const port = 3000;

const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');
const ExcelJS = require('exceljs');
const readline = require('readline');
const archiver = require('archiver');
const os = require('os');
const mongoose = require('mongoose');
const { Agenda } = require('agenda');

// === MongoDB Agenda Setup ===
const agenda = new Agenda({
  db: {
    address: 'mongodb://127.0.0.1:27017/agendaJobs',
    collection: 'usersJobs',
    options: { useNewUrlParser: true, useUnifiedTopology: true },
  },
});

// === Utility: Log System Stats ===
const logSystemStats = (label) => {
  const memory = process.memoryUsage();
  const usedMB = (memory.heapUsed / 1024 / 1024).toFixed(2);
  const rssMB = (memory.rss / 1024 / 1024).toFixed(2);
  const cpuLoad = os.loadavg()[0].toFixed(2); // 1-min load avg
  console.log(`🔍 [${label}] Memory Used: ${usedMB} MB | RSS: ${rssMB} MB | CPU Load: ${cpuLoad}`);
};

// === Paths ===
const dataDir = path.join(__dirname, 'data');
const ndjsonPath = path.join(dataDir, 'users_stream.ndjson');
const xlsxPath = path.join(dataDir, 'users_stream.xlsx');
const zipPath = path.join(dataDir, 'users_export.zip');

fs.mkdirSync(dataDir, { recursive: true });

// === User Generator ===
const generateUser = () => ({
  userId: faker.string.uuid(),
  username: faker.internet.username(),
  email: faker.internet.email(),
  avatar: faker.image.avatar(),
  password: faker.internet.password(),
  birthdate: faker.date.birthdate(),
  registeredAt: faker.date.past(),
});

// === Step 1: Write Users to .ndjson file in batches ===
const writeUsersToNDJSON = async () => {
  const totalUsers = 1000000;
  const batchSize = 100000;

  const stream = fs.createWriteStream(ndjsonPath);
  for (let i = 0; i < totalUsers; i++) {
    const user = generateUser();
    stream.write(JSON.stringify(user) + '\n');

    if ((i + 1) % 100000 === 0) {
      console.log(`✅ Wrote batch: ${(i + 1) / batchSize}`);
      logSystemStats(`After writing batch ${(i + 1) / batchSize}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // simulate delay
    }
  }
  stream.end();
  console.log('✅ Finished writing .ndjson file');
  logSystemStats('Completed NDJSON writing');
};

// === Step 2: Convert .ndjson to Excel .xlsx ===
const convertNDJSONToXLSX = async () => {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: xlsxPath });
  const worksheet = workbook.addWorksheet('Users');

  const rl = readline.createInterface({
    input: fs.createReadStream(ndjsonPath),
    crlfDelay: Infinity,
  });

  let isFirstRow = true;
  let rowCount = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const user = JSON.parse(line);

    if (isFirstRow) {
      worksheet.columns = Object.keys(user).map(key => ({
        header: key,
        key,
        width: 20,
      }));
      isFirstRow = false;
    }

    worksheet.addRow(user).commit();
    rowCount++;

    if (rowCount % 100000 === 0) {
      console.log(`📊 Written Excel rows: ${rowCount}`);
      logSystemStats(`Excel Rows: ${rowCount}`);
    }
  }

  await workbook.commit();
  console.log('✅ Finished converting to Excel');
  logSystemStats('Completed Excel writing');
};

// === Step 3: Zip the files ===
const zipFiles = async () => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ Zip created: ${zipPath} (${archive.pointer()} bytes)`);
      logSystemStats('Completed Zipping');
      resolve();
    });

    archive.on('error', err => reject(err));

    archive.pipe(output);
    archive.file(ndjsonPath, { name: 'users_stream.ndjson' });
    archive.file(xlsxPath, { name: 'users_stream.xlsx' });

    archive.finalize();
  });
};

// === Step 4: Agenda Job ===
agenda.define('generate-and-zip-users', async job => {
  console.log('🚀 Job Started: generate-and-zip-users');
  logSystemStats('Job Start');
  await writeUsersToNDJSON();
  await convertNDJSONToXLSX();
  await zipFiles();
  console.log('🎉 Job Completed!');
  logSystemStats('Job End');
});

(async function () {
  await agenda.start();
  await agenda.now('generate-and-zip-users');
})();

// === Express Server ===
app.get('/', (req, res) => {
  res.send('🚀 Server is running. Job is processing in background.');
});

app.listen(port, () => {
  console.log(`🚀 App listening at http://localhost:${port}`);
});

