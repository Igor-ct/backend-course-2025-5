const fs = require('fs').promises;
const http = require('http');
const path = require('path');
const { program } = require('commander');
const superagent = require('superagent');

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


async function handleGet(req, res, filePath) {
    try {

        const data = await fs.readFile(filePath);
        
        console.log(`[Cache] HIT: Відправка ${filePath} з кешу.`);

        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);

    } catch (error) {

        if (error.code === 'ENOENT') {
            console.log(`[Cache] MISS: ${filePath} не знайдено. Запит до http.cat...`);

 
            const fileCode = path.basename(filePath, '.jpeg');
            const url = `https://http.cat/${fileCode}`;

            try {

                const response = await superagent.get(url)
                    .buffer(true); 

                await fs.writeFile(filePath, response.body);
                console.log(`[Cache] WRITE: Збережено ${url} у ${filePath}`);

                res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                res.end(response.body);

            } catch (proxyError) {
                console.error(`[Proxy] ERROR: http.cat повернув помилку ${proxyError.status} для ${url}`);
                

                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found (Image not found on http.cat)');
            }

        } else {
       
            console.error(`[Server] ERROR: Помилка читання файлу: ${error.message}`);
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`500 Internal Server Error: ${error.message}`);
        }
    }
}

async function handlePut(req, res, filePath) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    
    req.on('end', async () => {
        try {
            const body = Buffer.concat(chunks);
            await fs.writeFile(filePath, body);

            res.writeHead(201, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('201 Created');
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`500 Internal Server Error: ${error.message}`);
        }
    });

    req.on('error', (err) => {
        console.error(`Помилка запиту: ${err.message}`);
        res.writeHead(500).end('Server error during request');
    });
}


async function handleDelete(req, res, filePath) {
    try {
        await fs.unlink(filePath); 

        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('200 OK');
    } catch (error) {
        if (error.code === 'ENOENT') {

            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
        } else {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`500 Internal Server Error: ${error.message}`);
        }
    }
}





async function startServer() {
    await setupCacheDirectory(options.cache);

    const server = http.createServer((req, res) => {
        const fileCode = req.url.slice(1);

        if (!fileCode || !/^\d+$/.test(fileCode)) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('400 Bad Request: URL має бути HTTP кодом (напр., /200)');
            return;
        }
        
        const filePath = path.join(options.cache, `${fileCode}.jpeg`);

        switch (req.method) {
            case 'GET':
                handleGet(req, res, filePath);
                break;
            case 'PUT':
                handlePut(req, res, filePath);
                break;
            case 'DELETE':
                handleDelete(req, res, filePath);
                break;
            default:
                res.writeHead(405, { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Allow': 'GET, PUT, DELETE'
                });
                res.end('405 Method Not Allowed');
                break;
        }
    });

    server.listen(options.port, options.host, () => {
        console.log(`Сервер успішно запущено та слухає на http://${options.host}:${options.port}/`);
    });
}

startServer();