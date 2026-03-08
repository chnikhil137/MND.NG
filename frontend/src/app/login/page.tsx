"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Fingerprint, Lock, Mail, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            router.push('/')
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 glass-card p-10 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent opacity-50"></div>

                <div className="text-center">
                    <Fingerprint className="mx-auto h-12 w-12 text-[#00E5FF] mb-4 opacity-80" />
                    <h2 className="text-3xl font-bold tracking-tight text-white">MND.NG Engine</h2>
                    <p className="mt-2 text-sm text-white/50">Authenticate to access the neural routing matrix.</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-5 w-5 text-white/30" />
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#00E5FF]/50 focus:ring-1 focus:ring-[#00E5FF]/50 transition-all text-white placeholder:text-white/30"
                                placeholder="Secure Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-white/30" />
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#00E5FF]/50 focus:ring-1 focus:ring-[#00E5FF]/50 transition-all text-white placeholder:text-white/30"
                                placeholder="Decryption Phrase (Password)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-[#0D1117] bg-[#00E5FF] hover:bg-[#33EBFF] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00E5FF] transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Initialize Session'}
                    </button>
                </form>

                <div className="text-center text-sm text-white/40 mt-6">
                    Unregistered operator?{' '}
                    <Link href="/signup" className="text-[#00E5FF] hover:text-[#33EBFF] transition-colors">
                        Request Access
                    </Link>
                </div>
            </div>
        </div>
    )
}
