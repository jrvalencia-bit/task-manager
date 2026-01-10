import { loginGoogle } from "./firebase";

// Aceptamos una "prop" (función) llamada activarInvitado
function Login({ activarInvitado }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      
      {/* --- NUEVO LOGO --- */}
      {/* Ajusté el tamaño y añadí sombra para que resalte en el fondo oscuro */}
      <img 
        src="/favicon.ico" 
        alt="Logo Task Manager" 
        className="w-24 h-24 mb-6 rounded-2xl shadow-2xl hover:scale-110 transition-transform duration-300" 
      />
      {/* ------------------ */}

      <h1 className="text-4xl font-bold mb-4 text-center">Task Manager Pro</h1>
      
      <p className="mb-8 text-gray-400 text-center max-w-md">
        Organiza tus tareas diarias. Puedes iniciar sesión para guardar tu progreso o probar la app como invitado.
      </p>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
        {/* BOTÓN 1: Google */}
        <button
          onClick={loginGoogle}
          className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
        >
          <span className="text-xl font-bold text-blue-600">G</span> Iniciar con Google
        </button>

        {/* BOTÓN 2: Invitado */}
        <button
          onClick={activarInvitado} // Ejecutamos la función que nos mandó App.jsx
          className="bg-gray-800 text-white px-6 py-3 rounded-full font-bold hover:bg-gray-700 transition border border-gray-700 shadow-md"
        >
          Entrar como Invitado
        </button>
      </div>
    </div>
  );
}

export default Login;