"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Upload, Settings2, Shield, Search, Database, Fingerprint, Loader2, LogOut, Menu, X } from "lucide-react";
import { mindEngineApi } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // DB Config State
  const [collections, setCollections] = useState<Record<string, string>>({});
  const [selectedDb, setSelectedDb] = useState("knowledge_base");
  const [files, setFiles] = useState<FileList | null>(null);

  // Mobile layout state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch available collections on mount
    mindEngineApi.getCollections().then(setCollections).catch(console.error);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleUpload = async () => {
    if (!files || files.length === 0) return alert("Please select a file first.");
    if (!apiKey) return alert("API Key is required to initialize the engine.");

    setUploading(true);
    try {
      const fileArray = Array.from(files);
      await mindEngineApi.uploadDocuments(apiKey, selectedDb, fileArray);
      alert(`Successfully ingested into ${collections[selectedDb]}`);
      setFiles(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!apiKey) return alert("Please provide your Gemini API Key in the config panel.");

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await mindEngineApi.queryEngine(apiKey, userMsg);
      const { answer, routed_db, used_fallback } = res;

      let prefix = `🎯 **Routed context to:** ${collections[routed_db] || routed_db}\n\n`;
      if (used_fallback) {
        prefix += `⚠️ **Context Miss:** Triggered deep web synthesis.\n\n`;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: prefix + answer }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Error: ${err.response?.data?.detail || err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <main className="flex h-screen w-full bg-[#0D1117] text-[#C9D1D9] font-sans relative overflow-hidden">

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Configuration Area */}
      <aside className={`absolute md:relative w-80 h-full border-r border-white/5 bg-[#161B22]/95 backdrop-blur-xl flex flex-col p-6 z-50 shrink-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center justify-between gap-3 mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/20 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <Fingerprint className="text-[#00E5FF] w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide text-white">MND.NG</h1>
              <p className="text-xs text-[#00E5FF] font-medium uppercase tracking-widest">Mind Engine</p>
            </div>
          </div>
          <button
            className="md:hidden text-white/50 hover:text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8 flex-1">
          {/* Security Config */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Shield className="w-4 h-4 text-[#2EA043]" />
              <span className="font-medium">API Access</span>
            </div>
            <input
              type="password"
              placeholder="Enter Gemini API Key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50 focus:ring-1 focus:ring-[#00E5FF]/50 transition-all placeholder:text-white/30"
            />
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Data Ingestion */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Database className="w-4 h-4 text-[#D29922]" />
              <span className="font-medium">Targeted Ingestion</span>
            </div>

            <div className="space-y-3">
              <select
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50 appearance-none cursor-pointer"
              >
                {Object.entries(collections).map(([key, label]) => (
                  <option key={key} value={key} className="bg-[#161B22]">
                    {label}
                  </option>
                ))}
              </select>

              <div className="relative group">
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={(e) => setFiles(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-black/10 group-hover:border-[#00E5FF]/40 group-hover:bg-[#00E5FF]/5 transition-all">
                  <Upload className="w-6 h-6 text-white/40 group-hover:text-[#00E5FF] transition-colors" />
                  <span className="text-xs text-center text-white/50">
                    {files && files.length > 0
                      ? `Ready: ${files.length} file(s)`
                      : "Drop specific PDFs here"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading || !files}
                className="w-full py-2.5 rounded-lg bg-[#1F2428] border border-white/5 text-sm font-medium hover:bg-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                {uploading ? "Parsing & Embedding..." : "Process Documents"}
              </button>
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col relative w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-transparent">

        {/* Mobile Header Toggle */}
        <div className="md:hidden p-4 border-b border-white/5 bg-[#161B22]/50 flex items-center shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-white/70 hover:text-white rounded-lg bg-white/5 border border-white/10"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-4 font-bold text-white tracking-wide">MND.NG</span>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {messages.length === 0 && (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
                <Fingerprint className="w-20 h-20 mb-6 text-[#00E5FF] opacity-50" />
                <h2 className="text-2xl font-light tracking-wide text-white mb-2">Initialize Synthesis</h2>
                <p className="text-sm max-w-md">
                  Upload domain-specific documents to targeted vector spaces, then query the engine. The system will automatically construct the optimal routing pathway.
                </p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                      ? "bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-white rounded-tr-sm shadow-[0_4px_24px_rgba(0,229,255,0.05)]"
                      : "glass-card text-[#C9D1D9] rounded-tl-sm"
                      }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="glass-card p-5 rounded-2xl rounded-tl-sm flex items-center gap-3 text-sm text-[#00E5FF]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating vector pathways...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 w-full p-4 md:p-8 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/90 to-transparent">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00E5FF]/30 to-purple-500/30 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500"></div>
            <div className="relative flex items-center bg-[#161B22] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="pl-4 md:pl-5">
                <Search className="w-5 h-5 text-white/30 group-focus-within:text-[#00E5FF] transition-colors" />
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask the Mind Engine..."
                className="w-full bg-transparent px-4 py-4 text-white focus:outline-none placeholder:text-white/20 text-sm"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-4 md:px-6 py-4 bg-white/5 hover:bg-[#00E5FF]/20 text-[#00E5FF] transition-colors disabled:opacity-30 flex items-center gap-2 font-medium"
              >
                <span className="hidden md:inline">Synthesize</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </main>
  );
}
