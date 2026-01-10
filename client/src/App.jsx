import { useState, useEffect, useCallback} from 'react';
import { auth, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './Login';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Si estamos en Vercel usa la nube, si no, usa mi compu
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(true);
  const [modoInvitado, setModoInvitado] = useState(false);

  const [modoOscuro, setModoOscuro] = useState(() => {
    if (window.localStorage.getItem('theme') === 'dark') return true;
    return false;
  });

  const [tareas, setTareas] = useState([]);
  const [recargar, setRecargar] = useState(false);
  
  // FORMULARIO CREAR
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState(""); 
  const [nuevaPrioridad, setNuevaPrioridad] = useState("Media");
  const [nuevaCategoria, setNuevaCategoria] = useState("General");
  
  // ERRORES Y FILTROS
  const [mensajeError, setMensajeError] = useState(""); 
  const [busqueda, setBusqueda] = useState(""); 
  const [filtroPrioridad, setFiltroPrioridad] = useState("Todas");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");

  // ESTADOS NUEVOS PARA UI MEJORADA
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [modoSeleccion, setModoSeleccion] = useState(false); // ¿Está activo el modo borrar?
  const [menuAbiertoId, setMenuAbiertoId] = useState(null); // ¿Qué tuerca está abierta?

  // MODAL
  const [modal, setModal] = useState({
    abierto: false,
    tipo: null, 
    idTarea: null,
    textoInput: "",
    fechaInput: "",
    prioridadInput: "Media",
    categoriaInput: "General"
  });

  useEffect(() => {
    if (modoOscuro) {
      document.documentElement.classList.add('dark');
      window.localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      window.localStorage.setItem('theme', 'light');
    }
  }, [modoOscuro]);

  const toggleModoOscuro = () => setModoOscuro(!modoOscuro);

  // Cierra el menú de tuerca si haces clic fuera
  useEffect(() => {
      const handleClickFuera = () => setMenuAbiertoId(null);
      if (menuAbiertoId) document.addEventListener('click', handleClickFuera);
      return () => document.removeEventListener('click', handleClickFuera);
  }, [menuAbiertoId]);

  const obtenerIdUsuario = useCallback(() => {
    if (usuario) return usuario.uid;
    if (modoInvitado) return "invitado_demo";
    return null;
  }, [usuario, modoInvitado]);

  useEffect(() => {
    const suscripcion = onAuthStateChanged(auth, (u) => {
      setUsuario(u ? u : null);
      setModoInvitado(false);
      setCargandoUsuario(false);
    });
    return () => suscripcion();
  }, []);

  useEffect(() => {
    const userId = obtenerIdUsuario();
    if (userId) {
      const obtenerTareas = async () => {
        try {
            const res = await fetch(`${API_URL}/tareas?usuarioId=${userId}`);
            const datos = await res.json();
            setTareas(datos);
        } catch (error) { console.error(error); }
      };
      obtenerTareas();
    }
  }, [recargar, obtenerIdUsuario]);

  const handleOnDragEnd = async (result) => {
    if (!result.destination || modoSeleccion) return; // No mover si estamos borrando
    const items = Array.from(tareas);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setTareas(items);
    const tareasParaActualizar = items.map((tarea, index) => ({ _id: tarea._id, orden: index }));
    try {
        await fetch(`${API_URL}/tareas/reordenar/lista`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tareas: tareasParaActualizar })
        });
    } catch (error) { console.error("Error al guardar orden:", error); }
  };

  const totalTareas = tareas.length;
  const tareasCompletadas = tareas.filter(t => t.completada).length;
  const porcentaje = totalTareas === 0 ? 0 : Math.round((tareasCompletadas / totalTareas) * 100);

  const obtenerMensajeProgreso = () => {
      if (totalTareas === 0) return "Agrega tu primera tarea 📝";
      if (porcentaje === 100) return "¡Todo listo! Eres una máquina 🏆";
      if (porcentaje >= 50) return "¡Ya pasaste la mitad! 🚀";
      return "Vamos a empezar 💪";
  };

  const tareasFiltradas = tareas.filter((tarea) => {
      const coincideTexto = tarea.titulo.toLowerCase().includes(busqueda.toLowerCase());
      const coincidePrioridad = filtroPrioridad === "Todas" || tarea.prioridad === filtroPrioridad;
      const coincideCategoria = filtroCategoria === "Todas" || (tarea.categoria || "General") === filtroCategoria;
      return coincideTexto && coincidePrioridad && coincideCategoria;
  });

  const filtrosActivos = busqueda !== "" || filtroPrioridad !== "Todas" || filtroCategoria !== "Todas";

  const apiEliminar = async (id) => {
    await fetch(`${API_URL}/tareas/${id}`, { method: 'DELETE' });
    setRecargar(!recargar);
  };

  // --- LÓGICA DE BORRADO MÚLTIPLE ---
  const activarModoSeleccion = () => {
      setModoSeleccion(true);
      setSeleccionadas([]);
  };

  const cancelarModoSeleccion = () => {
      setModoSeleccion(false);
      setSeleccionadas([]);
  };

  const eliminarMultiples = async () => {
      if(!seleccionadas.length) return;
      if(!confirm(`¿Eliminar ${seleccionadas.length} tareas permanentemente?`)) return;

      await Promise.all(seleccionadas.map(id => 
          fetch(`${API_URL}/tareas/${id}`, { method: 'DELETE' })
      ));
      
      cancelarModoSeleccion();
      setRecargar(!recargar);
  };

  const toggleSeleccion = (id) => {
      if(seleccionadas.includes(id)) {
          setSeleccionadas(seleccionadas.filter(item => item !== id));
      } else {
          setSeleccionadas([...seleccionadas, id]);
      }
  };

  const apiEditar = async (id, nuevoTexto, nuevaFechaEditada, nuevaPrioridadEditada, nuevaCategoriaEditada) => {
    const fechaConHora = nuevaFechaEditada ? nuevaFechaEditada + "T12:00:00" : "";
    await fetch(`${API_URL}/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          titulo: nuevoTexto, 
          fechaLimite: fechaConHora, 
          prioridad: nuevaPrioridadEditada,
          categoria: nuevaCategoriaEditada
      })
    });
    setRecargar(!recargar);
  };

  const agregarTarea = async (e) => {
    e.preventDefault();
    setMensajeError("");
    if (!nuevoTitulo.trim()) return;
    
    const existeDuplicada = tareas.some((t) => {
        const tituloIgual = t.titulo.trim().toLowerCase() === nuevoTitulo.trim().toLowerCase();
        return tituloIgual && t.prioridad === nuevaPrioridad && t.categoria === nuevaCategoria;
    });

    if (existeDuplicada) {
        setMensajeError("⚠️ Ya existe una tarea similar.");
        return;
    }

    const userId = obtenerIdUsuario();
    const fechaConHora = nuevaFecha ? nuevaFecha + "T12:00:00" : "";

    await fetch(`${API_URL}/tareas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          titulo: nuevoTitulo, 
          usuarioId: userId, 
          fechaLimite: fechaConHora, 
          prioridad: nuevaPrioridad,
          categoria: nuevaCategoria
      })
    });
    setNuevoTitulo("");
    setNuevaFecha(""); 
    setNuevaPrioridad("Media");
    setNuevaCategoria("General");
    setRecargar(!recargar);
  };

  const toggleCompletada = async (id, estadoActual) => {
    if (modoSeleccion) return; // No completar si estamos seleccionando
    await fetch(`${API_URL}/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completada: !estadoActual })
    });
    setRecargar(!recargar);
  };

  const confirmarBorrado = (id) => setModal({ abierto: true, tipo: 'borrar', idTarea: id, textoInput: "", fechaInput: "", prioridadInput: "", categoriaInput: "" });
  
  const iniciarEdicion = (id, textoActual, fechaActual, prioridadActual, categoriaActual) => {
    let fechaFormateada = "";
    if (fechaActual) fechaFormateada = new Date(fechaActual).toISOString().split('T')[0];
    setModal({ 
        abierto: true, 
        tipo: 'editar', 
        idTarea: id, 
        textoInput: textoActual, 
        fechaInput: fechaFormateada, 
        prioridadInput: prioridadActual || "Media",
        categoriaInput: categoriaActual || "General"
    });
  };
  
  const cerrarModal = () => setModal({ ...modal, abierto: false });
  const ejecutarAccionModal = () => {
    if (modal.tipo === 'borrar') apiEliminar(modal.idTarea);
    else if (modal.tipo === 'editar' && modal.textoInput.trim() !== "") {
        apiEditar(modal.idTarea, modal.textoInput, modal.fechaInput, modal.prioridadInput, modal.categoriaInput);
    }
    cerrarModal();
  };

  const manejarSalir = () => { if (modoInvitado) setModoInvitado(false); else logout(); };
  const esVencida = (fecha) => {
      if (!fecha) return false;
      const hoy = new Date(); hoy.setHours(0,0,0,0); const fechaTarea = new Date(fecha); return fechaTarea < hoy;
  };
  const obtenerColorBorde = (prioridad) => {
      if (prioridad === 'Alta') return 'border-l-4 border-l-red-500 dark:border-l-red-600';
      if (prioridad === 'Baja') return 'border-l-4 border-l-blue-400 dark:border-l-blue-500';
      return 'border-l-4 border-l-yellow-400 dark:border-l-yellow-500';
  };

  const obtenerEstiloCategoria = (cat) => {
      switch(cat) {
          case 'Trabajo': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
          case 'Personal': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
          case 'Estudio': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
          case 'Hogar': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
          default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      }
  };

  const toggleMenu = (e, id) => {
      e.stopPropagation(); // Evita que se cierre inmediatamente
      if (menuAbiertoId === id) setMenuAbiertoId(null);
      else setMenuAbiertoId(id);
  };

  if (cargandoUsuario) return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 text-gray-800 dark:text-white">Cargando...</div>;
  if (!usuario && !modoInvitado) return <Login activarInvitado={() => setModoInvitado(true)} />;

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      {modal.abierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">{modal.tipo === 'borrar' ? 'Eliminar Tarea' : 'Editar Tarea'}</h3>
                {modal.tipo === 'borrar' ? (
                    <p className="text-gray-600 dark:text-gray-300 mb-6">¿Estás seguro de que deseas eliminar esta tarea?</p>
                ) : (
                    <div className="flex flex-col gap-4 mb-6">
                        <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Título</label><input autoFocus type="text" value={modal.textoInput} onChange={(e) => setModal({...modal, textoInput: e.target.value})} className="w-full border dark:border-gray-600 p-2 rounded focus:ring-2 focus:ring-indigo-200 dark:bg-gray-700 dark:text-white focus:outline-none" /></div>
                        
                        <div className="flex gap-2">
                             <div className="w-1/2"><label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Categoría</label>
                                <select value={modal.categoriaInput} onChange={(e) => setModal({...modal, categoriaInput: e.target.value})} className="w-full border dark:border-gray-600 p-2 rounded text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-200 focus:outline-none">
                                    <option value="General">⚙️ General</option><option value="Trabajo">💼 Trabajo</option><option value="Personal">👤 Personal</option><option value="Estudio">📚 Estudio</option><option value="Hogar">🏠 Hogar</option>
                                </select>
                            </div>
                            <div className="w-1/2"><label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Prioridad</label>
                                <select value={modal.prioridadInput} onChange={(e) => setModal({...modal, prioridadInput: e.target.value})} className="w-full border dark:border-gray-600 p-2 rounded text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-200 focus:outline-none">
                                    <option value="Alta">🔥 Alta</option><option value="Media">⚡ Media</option><option value="Baja">☕ Baja</option>
                                </select>
                            </div>
                        </div>
                         <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-1">Fecha</label><input type="date" value={modal.fechaInput} onChange={(e) => setModal({...modal, fechaInput: e.target.value})} className="w-full border dark:border-gray-600 p-2 rounded text-sm focus:ring-2 focus:ring-indigo-200 dark:bg-gray-700 dark:text-white focus:outline-none" /></div>
                    </div>
                )}
                <div className="flex gap-3 justify-end"><button onClick={cerrarModal} className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium">Cancelar</button><button onClick={ejecutarAccionModal} className={`px-4 py-2 text-white rounded-lg font-bold shadow-md ${modal.tipo === 'borrar' ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{modal.tipo === 'borrar' ? 'Eliminar' : 'Guardar'}</button></div>
            </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg relative transition-colors duration-300 min-h-[500px]">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">{usuario?.photoURL ? <img src={usuario.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-blue-500" /> : <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">Inv</div>}<div><h2 className="text-sm font-bold text-gray-800 dark:text-white">{usuario ? usuario.displayName : "Invitado"}</h2></div></div>
            <div className="flex items-center gap-3"><button onClick={toggleModoOscuro} className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 hover:scale-110">{modoOscuro ? "☀️" : "🌙"}</button><button onClick={manejarSalir} className="text-xs text-red-500 hover:underline font-semibold">Salir</button></div>
        </div>

        <h1 className="text-3xl font-extrabold mb-2 text-center text-gray-800 dark:text-white tracking-tight">Mis Objetivos 🚀</h1>

        <div className="mb-6"><div className="flex justify-between items-end mb-1"><span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{obtenerMensajeProgreso()}</span><span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{tareasCompletadas} de {totalTareas}</span></div><div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden"><div className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${porcentaje}%` }}></div></div></div>

        {/* --- BARRA DE BÚSQUEDA Y FILTROS --- */}
        <div className="mb-6 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" placeholder="🔍 Buscar tarea..." className="w-full bg-gray-100 dark:bg-gray-700 border-none p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 dark:text-white transition placeholder-gray-400 dark:placeholder-gray-500" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                    <select className="bg-gray-100 dark:bg-gray-700 border-none p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-200 transition text-gray-600 dark:text-gray-200 font-semibold cursor-pointer w-full" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                        <option value="Todas">Todas</option>
                        <option value="General">⚙️ General</option>
                        <option value="Trabajo">💼 Trabajo</option>
                        <option value="Personal">👤 Personal</option>
                        <option value="Estudio">📚 Estudio</option>
                        <option value="Hogar">🏠 Hogar</option>
                    </select>
                    <select className="bg-gray-100 dark:bg-gray-700 border-none p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-200 transition text-gray-600 dark:text-gray-200 font-semibold cursor-pointer w-full" value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
                        <option value="Todas">Prioridad</option>
                        <option value="Alta">🔥 Alta</option>
                        <option value="Media">⚡ Media</option>
                        <option value="Baja">☕ Baja</option>
                    </select>
                </div>
            </div>
        </div>

        <form onSubmit={agregarTarea} className="flex flex-col gap-4 mb-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-inner">
          <div className="w-full">
            <input type="text" className="bg-transparent w-full focus:outline-none text-gray-700 dark:text-white font-semibold text-lg placeholder-gray-400 dark:placeholder-gray-500" placeholder="¿Qué quieres lograr hoy?" value={nuevoTitulo} onChange={(e) => { setNuevoTitulo(e.target.value); setMensajeError(""); }} />
          </div>

          <div className="w-full h-px bg-gray-200 dark:bg-gray-600"></div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full">
            <div className="flex items-center flex-1 min-w-[140px] gap-1">
                <select value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} className="bg-transparent text-xs font-bold text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer hover:text-indigo-600 h-10 flex-1" title="Categoría"><option value="General">⚙️ General</option><option value="Trabajo">💼 Trabajo</option><option value="Personal">👤 Personal</option><option value="Estudio">📚 Estudio</option><option value="Hogar">🏠 Hogar</option></select>
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <select value={nuevaPrioridad} onChange={(e) => setNuevaPrioridad(e.target.value)} className="bg-transparent text-xs font-bold text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer hover:text-indigo-600 h-10 flex-1" title="Prioridad"><option value="Alta">🔥 Alta</option><option value="Media">⚡ Media</option><option value="Baja">☕ Baja</option></select>
            </div>
            <div className="relative flex items-center bg-white dark:bg-gray-600 hover:bg-indigo-50 dark:hover:bg-gray-500 border border-gray-200 dark:border-gray-500 rounded-lg px-2 transition-colors cursor-pointer group shadow-sm h-10 w-full sm:w-auto mt-2 sm:mt-0">
                <span className="text-lg mr-1 group-hover:scale-110 transition-transform">📅</span>
                <input type="date" className={`bg-transparent text-xs focus:outline-none cursor-pointer font-medium w-full sm:w-auto ${nuevaFecha ? 'text-gray-700 dark:text-white' : 'text-gray-400 dark:text-gray-400'}`} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />
            </div>
          </div>

          <button type="submit" className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition shadow-lg shadow-indigo-200 dark:shadow-none font-bold text-sm">
            Agregar Tarea +
          </button>
        </form>

        {/* --- BOTÓN DE BORRADO MASIVO (SOLO SI HAY TAREAS) --- */}
        {tareas.length > 0 && !mensajeError && (
             <div className="mb-4 flex justify-end">
                {!modoSeleccion ? (
                    <button onClick={activarModoSeleccion} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold underline decoration-dotted underline-offset-4 cursor-pointer">
                        Eliminar varias tareas
                    </button>
                ) : (
                    <div className="flex gap-2 items-center w-full bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-800 animate-in slide-in-from-top-2">
                        <span className="text-xs font-bold text-red-600 dark:text-red-300 flex-1">Selecciona las tareas a borrar</span>
                        <button onClick={cancelarModoSeleccion} className="text-xs text-gray-500 px-3 py-1 bg-white dark:bg-gray-700 rounded border hover:bg-gray-50">Cancelar</button>
                        {seleccionadas.length > 0 && (
                            <button onClick={eliminarMultiples} className="text-xs text-white px-3 py-1 bg-red-500 rounded font-bold shadow-sm hover:bg-red-600">
                                Borrar ({seleccionadas.length})
                            </button>
                        )}
                    </div>
                )}
             </div>
        )}

        {mensajeError && <div className="mb-6 text-center text-red-500 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800 animate-pulse">{mensajeError}</div>}

        {tareas.length === 0 && !mensajeError && <div className="text-center py-12 opacity-70"><p className="text-5xl mb-4 animate-bounce">🍃</p><p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Todo limpio</p></div>}
        {tareas.length > 0 && tareasFiltradas.length === 0 && !mensajeError && <div className="text-center py-12 opacity-70"><p className="text-4xl mb-2">🔍</p><p className="text-gray-400 dark:text-gray-500 text-sm">No encontramos tareas.</p></div>}

        <DragDropContext onDragEnd={handleOnDragEnd}>
            {filtrosActivos || modoSeleccion ? (
               <ul className="space-y-3 pb-4">
                  {tareasFiltradas.map((tarea) => (
                      <TareaItem key={tarea._id} tarea={tarea} toggleCompletada={toggleCompletada} iniciarEdicion={iniciarEdicion} confirmarBorrado={confirmarBorrado} esVencida={esVencida} obtenerColorBorde={obtenerColorBorde} obtenerEstiloCategoria={obtenerEstiloCategoria} seleccionadas={seleccionadas} toggleSeleccion={toggleSeleccion} modoSeleccion={modoSeleccion} menuAbiertoId={menuAbiertoId} toggleMenu={toggleMenu} />
                  ))}
               </ul>
            ) : (
               <Droppable droppableId="lista-tareas">
                   {(provided) => (
                       <ul className="space-y-3 pb-4" {...provided.droppableProps} ref={provided.innerRef}>
                           {tareasFiltradas.map((tarea, index) => (
                               <Draggable key={tarea._id} draggableId={tarea._id} index={index}>
                                   {(provided) => (
                                       <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                           <TareaItem tarea={tarea} toggleCompletada={toggleCompletada} iniciarEdicion={iniciarEdicion} confirmarBorrado={confirmarBorrado} esVencida={esVencida} obtenerColorBorde={obtenerColorBorde} obtenerEstiloCategoria={obtenerEstiloCategoria} isDraggable={true} seleccionadas={seleccionadas} toggleSeleccion={toggleSeleccion} modoSeleccion={modoSeleccion} menuAbiertoId={menuAbiertoId} toggleMenu={toggleMenu} />
                                       </div>
                                   )}
                               </Draggable>
                           ))}
                           {provided.placeholder}
                       </ul>
                   )}
               </Droppable>
            )}
        </DragDropContext>

      </div>
    </div>
  );
}

// COMPONENTE TAREA ACTUALIZADO (Con Menú de Tuerca y Modo Selección)
function TareaItem({ tarea, toggleCompletada, iniciarEdicion, confirmarBorrado, esVencida, obtenerColorBorde, obtenerEstiloCategoria, isDraggable, seleccionadas, toggleSeleccion, modoSeleccion, menuAbiertoId, toggleMenu }) {
    const estaVencida = esVencida(tarea.fechaLimite) && !tarea.completada;
    const claseBorde = obtenerColorBorde(tarea.prioridad);
    const estaSeleccionada = seleccionadas.includes(tarea._id);
    const menuAbierto = menuAbiertoId === tarea._id;

    return (
        <li className={`group relative flex justify-between items-center p-3 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-all ${claseBorde} ${tarea.completada && !modoSeleccion ? 'opacity-60 bg-gray-50 dark:bg-gray-800/50' : ''} ${estaSeleccionada ? 'ring-2 ring-red-300 dark:ring-red-600 bg-red-50 dark:bg-red-900/10' : ''}`}>
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                
                {/* 1. MODO SELECCIÓN: CHECKBOX */}
                {modoSeleccion && (
                     <div onClick={() => toggleSeleccion(tarea._id)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${estaSeleccionada ? 'bg-red-500 border-red-500' : 'border-gray-300 bg-white'}`}>
                        {estaSeleccionada && <span className="text-white text-xs font-bold">✓</span>}
                     </div>
                )}

                {/* 2. MODO NORMAL: DRAG HANDLE Y CHECKBOX COMPLETAR */}
                {!modoSeleccion && (
                    <>
                        {isDraggable && <span className="text-gray-300 dark:text-gray-600 cursor-grab text-xl">:::</span>}
                        <button onClick={() => toggleCompletada(tarea._id, tarea.completada)} className={`min-w-[24px] h-6 rounded-full border-2 flex items-center justify-center transition-colors ${tarea.completada ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500 hover:border-indigo-500'}`}>
                            {tarea.completada && <span className="text-white text-xs">✓</span>}
                        </button>
                    </>
                )}

                <div className="flex flex-col flex-1">
                    <span onClick={() => !modoSeleccion && toggleCompletada(tarea._id, tarea.completada)} className={`text-sm sm:text-lg truncate cursor-pointer select-none dark:text-gray-200 ${tarea.completada && !modoSeleccion ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700'}`}>{tarea.titulo}</span>
                    <div className="flex gap-2 items-center mt-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${obtenerEstiloCategoria(tarea.categoria || 'General')}`}>
                            {tarea.categoria || 'General'}
                        </span>
                        {tarea.prioridad === 'Alta' && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-bold">ALTA</span>}
                        {tarea.prioridad === 'Media' && <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded font-bold">MEDIA</span>}
                        {tarea.prioridad === 'Baja' && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">BAJA</span>}
                        {tarea.fechaLimite && <span className={`text-xs ${estaVencida ? 'text-red-500 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>{estaVencida && '⚠️ '} {new Date(tarea.fechaLimite).toLocaleDateString()}</span>}
                    </div>
                </div>
            </div>

            {/* 3. TUERCA DE CONFIGURACIÓN (SOLO VISIBLE SI NO ESTAMOS BORRANDO MASIVAMENTE) */}
            {!modoSeleccion && (
                <div className="relative ml-2">
                    <button onClick={(e) => toggleMenu(e, tarea._id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 text-xl rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                        ⚙️
                    </button>
                    
                    {/* MENÚ DESPLEGABLE FLOTANTE */}
                    {menuAbierto && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-100 dark:border-gray-600 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                            <button onClick={() => iniciarEdicion(tarea._id, tarea.titulo, tarea.fechaLimite, tarea.prioridad, tarea.categoria)} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                ✏️ Editar
                            </button>
                            <div className="h-px bg-gray-100 dark:bg-gray-700"></div>
                            <button onClick={() => confirmarBorrado(tarea._id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                                🗑 Borrar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

export default App;