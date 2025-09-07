// Importa los módulos necesarios
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const app = express();
const PORT = process.env.PORT || 3000;
const multer = require('multer');

// Define la ruta base del explorador (importante para la seguridad)
const BASE_PATH = path.resolve('./server');

// Middleware para servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Configuración de Multer para la subida de archivos
// NOTA: No necesitamos una lógica de destino aquí, lo manejaremos en la ruta POST
const storage = multer.memoryStorage(); // Usamos almacenamiento en memoria temporal
const upload = multer({ storage: storage });

// Middleware de seguridad para validar rutas
const validatePath = (req, res, next) => {
    const userPath = req.query.path || '';
    const resolvedPath = path.resolve(BASE_PATH, userPath);
    
    if (!resolvedPath.startsWith(BASE_PATH)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    req.resolvedPath = resolvedPath;
    next();
};

// Función recursiva para calcular el tamaño de un directorio
async function getDirectorySize(dirPath) {
    let totalSize = 0;
    try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                totalSize += await getDirectorySize(itemPath);
            } else {
                const stats = await fs.stat(itemPath);
                totalSize += stats.size;
            }
        }
    } catch (err) {
        console.error(`Error al calcular el tamaño de ${dirPath}:`, err);
    }
    return totalSize;
}

// --- Rutas de la API ---

// 1. Obtener archivos y directorios con tamaño
app.get('/api/files', validatePath, async (req, res) => {
    try {
        const items = await fs.readdir(req.resolvedPath, { withFileTypes: true });
        
        const fileList = await Promise.all(items.map(async (item) => {
            const itemPath = path.join(req.resolvedPath, item.name);
            let size = 0;
            
            if (item.isDirectory()) {
                size = await getDirectorySize(itemPath);
            } else {
                const stats = await fs.stat(itemPath);
                size = stats.size;
            }
            
            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                size: size,
            };
        }));
        
        res.json(fileList);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Directorio no encontrado' });
        }
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// 2. Descargar un archivo
app.get('/api/download', validatePath, (req, res) => {
    res.download(req.resolvedPath, (err) => {
        if (err) {
            console.error('Error al descargar:', err);
            res.status(500).json({ error: 'No se pudo descargar el archivo' });
        }
    });
});

// 3. Vista previa de un archivo
app.get('/api/preview', validatePath, (req, res) => {
    res.sendFile(req.resolvedPath, (err) => {
        if (err) {
            console.error('Error al enviar el archivo para vista previa:', err);
            res.status(500).send('No se pudo previsualizar el archivo.');
        }
    });
});

// 4. Eliminar un archivo o directorio
app.delete('/api/delete', validatePath, async (req, res) => {
    try {
        const stats = await fs.stat(req.resolvedPath);
        if (stats.isDirectory()) {
            await fs.rm(req.resolvedPath, { recursive: true, force: true });
        } else {
            await fs.unlink(req.resolvedPath);
        }
        res.json({ message: 'Eliminado con éxito' });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Elemento no encontrado' });
        }
        res.status(500).json({ error: 'No se pudo eliminar el elemento' });
    }
});

// 5. Renombrar un archivo o directorio
app.put('/api/rename', async (req, res) => {
    const { oldPath, newName } = req.body;
    const oldResolvedPath = path.resolve(BASE_PATH, oldPath);
    const newResolvedPath = path.resolve(path.dirname(oldResolvedPath), newName);
    
    if (!newResolvedPath.startsWith(BASE_PATH)) {
        return res.status(403).json({ error: 'Operación no permitida' });
    }

    try {
        await fs.rename(oldResolvedPath, newResolvedPath);
        res.json({ message: 'Renombrado con éxito' });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Elemento no encontrado' });
        }
        res.status(500).json({ error: 'No se pudo renombrar' });
    }
});

// 6. Ruta para subir un archivo
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se seleccionó ningún archivo.' });
    }

    try {
        const userPath = req.body.path || '';
        const resolvedPath = path.resolve(BASE_PATH, userPath);
        const filePath = path.join(resolvedPath, req.file.originalname);
        
        // Se asegura de que la ruta de destino exista
        await fs.mkdir(resolvedPath, { recursive: true });
        
        // Se escribe el archivo en la ubicación correcta
        await fs.writeFile(filePath, req.file.buffer);

        res.json({ message: `Archivo "${req.file.originalname}" subido con éxito.` });
    } catch (err) {
        console.error('Error al subir el archivo:', err);
        res.status(500).json({ error: 'No se pudo subir el archivo.' });
    }
});

// 7. Ruta para crear una nueva carpeta
app.post('/api/create-folder', async (req, res) => {
    const { name, path: folderPath } = req.body;
    
    if (!name || name.trim() === '' || name.includes('/') || name.includes('\\')) {
        return res.status(400).json({ error: 'Nombre de carpeta no válido.' });
    }

    const resolvedPath = path.resolve(BASE_PATH, folderPath, name);
    
    if (!resolvedPath.startsWith(BASE_PATH)) {
        return res.status(403).json({ error: 'Operación no permitida.' });
    }

    try {
        await fs.mkdir(resolvedPath);
        res.json({ message: `Carpeta "${name}" creada con éxito.` });
    } catch (err) {
        if (err.code === 'EEXIST') {
            return res.status(409).json({ error: 'La carpeta ya existe.' });
        }
        res.status(500).json({ error: 'No se pudo crear la carpeta.' });
    }
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});