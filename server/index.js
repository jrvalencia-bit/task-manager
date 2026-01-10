require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const URI = process.env.MONGO_URI;

mongoose.connect(URI)
    .then(() => console.log('--> Conectado a la Base de Datos con éxito'))
    .catch((err) => console.error('Error de conexión:', err));

// 1. SCHEMA ACTUALIZADO (Con TTL para limpieza automática)
const TareaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    completada: { type: Boolean, default: false },
    usuarioId: { type: String, required: true },
    fechaLimite: { type: Date },
    prioridad: { type: String, default: 'Media' },
    categoria: { type: String, default: 'General' },
    orden: { type: Number, default: 0 },
    // Autolimpieza: Las tareas se borran solas después de 24 horas (86400 seg)
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

const Tarea = mongoose.model('Tarea', TareaSchema);

// RUTAS

app.get('/tareas', async (req, res) => {
    const { usuarioId } = req.query;
    if (!usuarioId) return res.status(400).json({ error: "Falta usuarioId" });
    const tareas = await Tarea.find({ usuarioId }).sort({ orden: 1 });
    res.json(tareas);
});

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

app.put('/tareas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tareaActualizada = await Tarea.findByIdAndUpdate(id, req.body, { new: true });
        res.json(tareaActualizada);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar" });
    }
});

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

app.delete('/tareas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Tarea.findByIdAndDelete(id);
        res.json({ mensaje: "Tarea eliminada" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar" });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});