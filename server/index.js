require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// CONFIGURACIÓN DE MIDDLEWARES
// ==========================================
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json());

// ==========================================
// CONEXIÓN A BASE DE DATOS
// ==========================================
const URI = process.env.MONGO_URI;

mongoose.connect(URI)
    .then(() => console.log('--> Conectado a la Base de Datos con éxito'))
    .catch((err) => console.error('Error de conexión:', err));

// ==========================================
// MODELO DE DATOS (SCHEMA)
// ==========================================
const TareaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    completada: { type: Boolean, default: false },
    usuarioId: { type: String, required: true },
    fechaLimite: { type: Date },
    prioridad: { type: String, default: 'Media' },
    categoria: { type: String, default: 'General' },
    orden: { type: Number, default: 0 },
    // TTL: Las tareas se eliminan automáticamente tras 24h (86400s)
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

const Tarea = mongoose.model('Tarea', TareaSchema);

// ==========================================
// RUTAS DE LA API (CONTROLLERS)
// ==========================================

/**
 * @desc    Obtiene todas las tareas de un usuario específico
 * @route   GET /tareas
 * @access  Privado (Requiere usuarioId)
 */
app.get('/tareas', async (req, res) => {
    const { usuarioId } = req.query;
    if (!usuarioId) return res.status(400).json({ error: "Falta usuarioId" });
    const tareas = await Tarea.find({ usuarioId }).sort({ orden: 1 });
    res.json(tareas);
});

/**
 * @desc    Crea una nueva tarea y la coloca al final de la lista
 * @route   POST /tareas
 * @access  Privado
 */
app.post('/tareas', async (req, res) => {
    const totalTareas = await Tarea.countDocuments({ usuarioId: req.body.usuarioId });

    const nuevaTarea = new Tarea({
        titulo: req.body.titulo,
        usuarioId: req.body.usuarioId,
        fechaLimite: req.body.fechaLimite,
        prioridad: req.body.prioridad,
        categoria: req.body.categoria,
        orden: totalTareas
    });
    await nuevaTarea.save();
    res.json(nuevaTarea);
});

/**
 * @desc    Actualiza una tarea existente por su ID
 * @route   PUT /tareas/:id
 * @access  Privado
 */
app.put('/tareas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tareaActualizada = await Tarea.findByIdAndUpdate(id, req.body, { new: true });
        res.json(tareaActualizada);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});

/**
 * @desc    Actualiza el orden de múltiples tareas (Drag & Drop)
 * @route   PUT /tareas/reordenar/lista
 * @access  Privado
 */
app.put('/tareas/reordenar/lista', async (req, res) => {
    try {
        const { tareas } = req.body;
        const promesas = tareas.map(t => Tarea.findByIdAndUpdate(t._id, { orden: t.orden }));
        await Promise.all(promesas);
        res.json({ message: "Orden actualizado" });
    } catch (error) {
        res.status(500).json({ error: "Error al reordenar" });
    }
});

/**
 * @desc    Elimina una tarea por su ID
 * @route   DELETE /tareas/:id
 * @access  Privado
 */
app.delete('/tareas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Tarea.findByIdAndDelete(id);
        res.json({ mensaje: "Tarea eliminada" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar" });
    }
});

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});