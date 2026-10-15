import { useEffect, useRef, useState } from "react";
import "./ChatBot.css";

export default function ChatBot({ apiUrl, password }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const bottomRef = useRef(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending, open]);

    async function send(event) {
        event.preventDefault();
        const mensaje = draft.trim();
        if (!mensaje || sending) return;
        const historial = messages.slice(-8).map(({ role, content }) => ({ role, content }));
        setMessages((current) => [...current, { role: "user", content: mensaje }]);
        setDraft("");
        setError("");
        setSending(true);
        try {
            const response = await fetch(`${apiUrl}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Admin-Token": password },
                body: JSON.stringify({ mensaje, historial })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No fue posible consultar el asistente.");
            setMessages((current) => [...current, { role: "assistant", content: result.respuesta }]);
        } catch (requestError) {
            setError(requestError.message || "No fue posible conectar con el asistente.");
        } finally {
            setSending(false);
        }
    }

    return <div className="chatbot">
        {open && <section className="chatbot-panel" aria-label="Asistente de accesorios">
            <div className="chatbot-header"><div><strong>Asistente de inventario</strong><span>Respuestas basadas en tu catálogo</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat">×</button></div>
            <div className="chatbot-messages" aria-live="polite">
                <p className="chatbot-bubble assistant">Hola. Pregúntame por accesorios compatibles con tu celular, precios o existencias.</p>
                {messages.map((item, index) => <p className={`chatbot-bubble ${item.role}`} key={index}>{item.content}</p>)}
                {sending && <p className="chatbot-bubble assistant">Revisando el inventario...</p>}
                {error && <p className="chatbot-error" role="alert">{error}</p>}
                <div ref={bottomRef} />
            </div>
            <form className="chatbot-form" onSubmit={send}><input aria-label="Mensaje para el asistente" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="¿Hay fundas para Galaxy A55?" /><button type="submit" disabled={sending || !draft.trim()} aria-label="Enviar mensaje">➤</button></form>
            <p className="chatbot-note">El chat consulta datos; usa la tabla para guardar cambios.</p>
        </section>}
        <button className="chatbot-toggle" type="button" aria-label={open ? "Cerrar asistente" : "Abrir asistente"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "×" : "✦"}<span>{open ? "Cerrar" : "Asistente"}</span></button>
    </div>;
}
