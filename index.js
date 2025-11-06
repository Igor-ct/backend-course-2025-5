const fs = require('fs').promises;
const http = require('http');
const { program } = require('commander');

program
    .requiredOption('-h, --host <host>', 'Адреса сервера')
    .requiredOption('-p, --port <port>', 'Порт сервера')
    .requiredOption('-c, --cache <cache>', 'Шлях до директорії кешу');
    
program.parse(process.argv);
const options = program.opts();

async function setupCacheDirectory(cachePath) {
    try {
        await fs.mkdir(cachePath, { recursive: true });
        console.log(`Директорія кешу успішно перевірена/створена: ${cachePath}`);
    } catch (err) {
        console.error(`Помилка при створенні директорії кешу: ${err.message}`);
        process.exit(1); 
    }
}

async function startServer() {

    await setupCacheDirectory(options.cache);


    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Сервер працює!\n');
    });

    server.listen(options.port, options.host, () => {

        console.log(`Сервер успішно запущено та слухає на http://${options.host}:${options.port}/`);
    });
}


startServer();