import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, HeartPulse, Hospital, LayoutDashboard, LogOut, Menu, Plus, Radio, ShieldCheck, Sparkles, Stethoscope, Users, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { getErrorMessage } from './api.js';
import { useAuth } from './auth.jsx';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');

function Logo({ inverse = false }) {
  return <Link to="/" className={`flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-ink'}`}>
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><HeartPulse size={20} strokeWidth={2.5} /></span>
    medqueue<span className="text-brand-600">.</span>
  </Link>;
}

function App() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={user ? <Navigate to="/app" replace /> : <AuthPage />} />
    <Route path="/app" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
    <Route path="/display/:departmentId" element={<DisplayBoard />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

function Landing() {
  const { user } = useAuth();
  return <div className="min-h-screen bg-white">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
      <Logo />
      <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
        <a href="#how-it-works" className="hover:text-brand-700">How it works</a><a href="#departments" className="hover:text-brand-700">Departments</a><a href="#benefits" className="hover:text-brand-700">For hospitals</a>
      </nav>
      <div className="flex items-center gap-3"><Link to={user ? '/app' : '/login'} className="hidden px-3 py-2 text-sm font-bold text-ink sm:block">{user ? 'Dashboard' : 'Sign in'}</Link><Link to={user ? '/app' : '/login'} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-300/50 transition hover:bg-brand-700">{user ? 'Open dashboard' : 'Get started'} <ArrowRight className="ml-1 inline" size={15} /></Link></div>
    </header>
    <main>
      <section className="hero-grid relative overflow-hidden px-6 py-14 md:py-24 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3.5 py-2 text-xs font-bold tracking-wide text-brand-700"><Sparkles size={14} /> A smarter way to see your doctor</div>
            <h1 className="max-w-2xl font-display text-5xl font-extrabold leading-[1.08] tracking-[-.045em] text-ink sm:text-6xl">Less waiting.<br /><span className="text-brand-600">More living.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Know where you stand before you arrive. MedQueue brings appointments, walk-ins, and real-time hospital queues together in one calm, simple experience.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link to="/login" className="rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">Book an appointment <ArrowRight size={17} className="ml-2 inline" /></Link><a href="#how-it-works" className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-ink transition hover:border-brand-300">See how it works</a></div>
            <div className="mt-8 flex items-center gap-3 text-sm text-slate-500"><span className="flex -space-x-2">{['M','A','J'].map((x,i)=><span key={x} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-xs font-bold text-white ${['bg-sky-500','bg-teal-500','bg-indigo-500'][i]}`}>{x}</span>)}</span><span><b className="text-ink">Care teams and patients</b> move in sync</span></div>
          </motion.div>
          <HeroCard />
        </div>
        <div className="pointer-events-none absolute -right-36 -top-20 h-96 w-96 rounded-full bg-cyan-100/40 blur-3xl" />
      </section>
      <section className="border-y border-slate-100 bg-white px-6 py-7"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-16 gap-y-4 text-sm font-bold text-slate-400 md:justify-between"><span className="uppercase tracking-[.14em]">Care that keeps moving</span><span className="flex items-center gap-2"><ShieldCheck size={18} className="text-brand-600" /> Privacy-conscious by design</span><span className="flex items-center gap-2"><Radio size={18} className="text-brand-600" /> Live queue updates</span><span className="flex items-center gap-2"><Activity size={18} className="text-brand-600" /> Clear, useful insights</span></div></section>
      <section id="how-it-works" className="px-6 py-20 lg:px-10"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="A better visit, step by step" title="Your time matters. We make it count." copy="From the moment you book to the moment you’re called, every next step is easy to understand." /><div className="mt-12 grid gap-5 md:grid-cols-3">{[
        ['01','Choose your care','Find a department and book a time that works for you.',CalendarDays],['02','Get your place in line','Receive your digital token and estimated wait before arrival.',Clock3],['03','Stay in the know','Follow the live queue so you can spend less time waiting around.',Radio],
      ].map(([n,title,copy,Icon])=><div key={n} className="rounded-2xl border border-slate-100 bg-white p-7 shadow-card"><span className="text-sm font-extrabold text-brand-600">{n}</span><div className="my-5 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={22} /></div><h3 className="font-display text-lg font-extrabold text-ink">{title}</h3><p className="mt-2 leading-6 text-slate-500">{copy}</p></div>)}</div></div></section>
      <section id="departments" className="bg-canvas px-6 py-20 lg:px-10"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="Care, connected" title="The right team, right on time." copy="A coordinated view across departments helps patients and care teams stay on the same page." /><div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{['General Medicine','Cardiology','Neurology','Orthopedics','Dermatology','Pediatrics','Ophthalmology','ENT','Dentistry','Gynecology'].map((name,i)=><div key={name} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 text-sm font-bold text-ink"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Stethoscope size={17} /></span>{name}</div>)}</div></div></section>
      <section id="benefits" className="px-6 py-20 lg:px-10"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2"><div><SectionHeading eyebrow="A calmer clinic day" title="Better visibility for every care team." copy="MedQueue helps hospitals keep queues moving with a shared live view and simple, reliable workflows." /><div className="mt-8 space-y-4">{['Manage walk-ins and appointments in one queue','Use FIFO, LIFO, or priority-based scheduling','See department activity and wait-time estimates'].map(item=><div key={item} className="flex gap-3 text-slate-600"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><Check size={15} /></span>{item}</div>)}</div></div><div className="rounded-3xl bg-ink p-8 text-white md:p-10"><div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-slate-300">The right information, at a glance</div><div className="mt-2 font-display text-2xl font-extrabold">A more connected visit</div></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Hospital size={23} /></div></div><div className="mt-8 grid grid-cols-2 gap-3">{[['Patients','Know their place'],['Staff','Keep care moving'],['Admins','Spot patterns'],['Display boards','Guide the next visit']].map(([a,b])=><div key={a} className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="font-bold">{a}</div><div className="mt-1 text-sm text-slate-300">{b}</div></div>)}</div></div></div></section>
      <section className="px-6 pb-20 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 rounded-3xl bg-brand-50 p-8 md:flex-row md:p-12"><div><div className="font-display text-3xl font-extrabold text-ink">Your next visit can feel different.</div><p className="mt-2 text-slate-600">Sign in to book care and follow your queue.</p></div><Link to="/login" className="rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white hover:bg-brand-700">Get started <ArrowRight size={16} className="ml-2 inline" /></Link></div></section>
    </main>
    <footer className="border-t border-slate-100 px-6 py-7"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><Logo /><p className="text-xs text-slate-400">A student demonstration using synthetic data. Not a certified clinical system.</p><Link to="/login" className="text-sm font-bold text-slate-500 hover:text-brand-700">Staff sign in</Link></div></footer>
  </div>;
}

function HeroCard() {
  return <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12, duration: .55 }} className="relative mx-auto w-full max-w-[500px]">
    <div className="absolute -left-7 top-16 z-10 rounded-2xl border border-slate-100 bg-white p-4 shadow-card"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Check size={19} /></span><div><div className="text-sm font-extrabold text-ink">You’re checked in</div><div className="text-xs text-slate-500">General Medicine</div></div></div></div>
    <div className="rounded-[2rem] bg-gradient-to-br from-brand-700 to-[#16476b] p-5 shadow-2xl shadow-cyan-900/15 sm:p-8"><div className="flex items-center justify-between text-white"><span className="flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />Live queue</span><span className="rounded-full bg-white/10 px-3 py-1 text-xs">Today · 10:42 AM</span></div><div className="mt-6 rounded-2xl bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-widest text-slate-400">Your token</div><div className="mt-1 font-display text-5xl font-extrabold tracking-tight text-ink">A<span className="text-brand-600">024</span></div></div><div className="rounded-2xl bg-brand-50 p-4 text-brand-700"><Users size={27} /></div></div><div className="my-6 h-px bg-slate-100" /><div className="grid grid-cols-2 gap-4"><div><div className="text-xs text-slate-400">People ahead</div><div className="mt-1 text-xl font-extrabold text-ink">3 people</div></div><div><div className="text-xs text-slate-400">Estimated wait</div><div className="mt-1 text-xl font-extrabold text-ink">~18 min</div></div></div><div className="mt-6 flex items-center gap-3 rounded-xl bg-canvas p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-brand-700"><Stethoscope size={17} /></span><div className="flex-1"><div className="text-xs text-slate-400">Now serving</div><div className="text-sm font-extrabold text-ink">A021 <span className="font-medium text-slate-500">· Counter 2</span></div></div><ArrowUpRight size={17} className="text-brand-600" /></div></div><div className="mt-4 flex justify-center gap-2">{[0,1,2].map((x)=><span key={x} className={`h-1.5 rounded-full ${x===0?'w-7 bg-white':'w-1.5 bg-white/40'}`} />)}</div></div>
    <div className="absolute -bottom-5 -right-4 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-card"><div className="flex items-center gap-2 text-sm font-bold text-ink"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-600"><Clock3 size={15} /></span>Less time in the waiting room</div></div>
  </motion.div>;
}

function SectionHeading({ eyebrow, title, copy }) {
  return <div className="max-w-2xl"><div className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-600">{eyebrow}</div><h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h2><p className="mt-4 leading-7 text-slate-500">{copy}</p></div>;
}

function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, register } = useAuth();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'register') await register(form);
      else await signIn({ email: form.email, password: form.password });
      navigate('/app');
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-canvas"><header className="mx-auto max-w-7xl px-6 py-5"><Logo /></header><div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-10 lg:grid-cols-2 lg:py-20"><div className="hidden lg:block"><div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700"><HeartPulse size={14} /> A better kind of care coordination</div><h1 className="mt-6 max-w-xl font-display text-5xl font-extrabold leading-tight tracking-tight text-ink">Welcome to a more <span className="text-brand-600">thoughtful</span> visit.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-slate-500">Book with your care team and stay updated on your place in line, all from one simple dashboard.</p><div className="mt-10 rounded-2xl border border-slate-100 bg-white p-5 shadow-card"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck /></div><div><div className="font-bold text-ink">A clear view of your care</div><div className="mt-1 text-sm text-slate-500">Your information stays in the right hands.</div></div></div></div></div><div className="mx-auto w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-card sm:p-9"><div className="font-display text-2xl font-extrabold text-ink">{mode === 'login' ? 'Welcome back' : 'Create your account'}</div><p className="mt-2 text-sm text-slate-500">{mode === 'login' ? 'Sign in to continue to MedQueue.' : 'Patient registration takes less than a minute.'}</p><div className="mt-6 grid grid-cols-2 rounded-xl bg-canvas p-1"><button onClick={()=>{setMode('login');setError('');}} className={`rounded-lg py-2.5 text-sm font-bold ${mode==='login'?'bg-white text-ink shadow-sm':'text-slate-500'}`}>Sign in</button><button onClick={()=>{setMode('register');setError('');}} className={`rounded-lg py-2.5 text-sm font-bold ${mode==='register'?'bg-white text-ink shadow-sm':'text-slate-500'}`}>Register</button></div><form onSubmit={submit} className="mt-6 space-y-4">{mode==='register'&&<Field label="Full name" value={form.name} onChange={(name)=>setForm({...form,name})} placeholder="Your name" required /> }<Field label="Email address" type="email" value={form.email} onChange={(email)=>setForm({...form,email})} placeholder="you@example.com" required /><Field label="Password" type="password" value={form.password} onChange={(password)=>setForm({...form,password})} placeholder="At least 8 characters" required minLength={8} />{mode==='register'&&<Field label="Phone (optional)" type="tel" value={form.phone} onChange={(phone)=>setForm({...form,phone})} placeholder="+1 555 0100" />}{error&&<div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}<button disabled={busy} className="w-full rounded-xl bg-brand-600 py-3.5 font-bold text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70">{busy?'Please wait…':mode==='login'?'Sign in securely':'Create patient account'} <ArrowRight size={16} className="ml-1 inline" /></button></form>{mode==='login'&&<div className="mt-6 rounded-xl bg-canvas p-4 text-xs leading-5 text-slate-500"><b className="text-ink">Demo access:</b> admin@medqueue.test / doctor@medqueue.test / staff@medqueue.test / patient@medqueue.test<br />Password: MedQueueDemo!2026</div>}</div></div></div>;
}

function Field({ label, value, onChange, type='text', ...props }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-ink">{label}</span><input type={type} value={value} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-50" {...props} /></label>;
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [activeDept, setActiveDept] = useState('');
  const [overview, setOverview] = useState(null);
  const [queue, setQueue] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [booking, setBooking] = useState({ departmentId: '', scheduledAt: '' });
  const [simArrival, setSimArrival] = useState(8);
  const [simService, setSimService] = useState(12);
  const [simulated, setSimulated] = useState(null);
  const staffMode = ['ADMIN','STAFF','DOCTOR'].includes(user.role);

  async function loadBase() {
    const [deptResult, apptResult] = await Promise.all([
      api.get('/departments'),
      api.get('/appointments'),
    ]);
    setDepartments(deptResult.data.data);
    setAppointments(apptResult.data.data);
    if (!staffMode) {
      const activeTokens = (await api.get('/queues/mine')).data.data;
      setTicket(activeTokens[0] || null);
    }
    if (!activeDept && deptResult.data.data[0]) {
      setActiveDept(deptResult.data.data[0].id);
      setBooking((old) => ({...old, departmentId: deptResult.data.data[0].id}));
    }
    if (staffMode) {
      try { setOverview((await api.get('/analytics/overview')).data.data); } catch { setOverview(null); }
    }
  }
  async function loadQueue(id=activeDept) {
    if (!id) return;
    try { setQueue((await api.get(`/queues/${id}/status`)).data.data); setError(''); }
    catch (e) { setError(getErrorMessage(e)); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([api.get('/departments'), api.get('/appointments')])
      .then(async ([deptResult, apptResult]) => {
        if (!active) return;
        const list = deptResult.data.data;
        setDepartments(list); setAppointments(apptResult.data.data);
        if (!staffMode) {
          try { const activeTokens = await api.get('/queues/mine'); if (active) setTicket(activeTokens.data.data[0] || null); }
          catch (e) { if (active) setError(getErrorMessage(e)); }
        }
        if (list[0]) { setActiveDept(list[0].id); setBooking((old)=>({...old, departmentId:list[0].id})); }
        if (staffMode) {
          try { const result = await api.get('/analytics/overview'); if (active) setOverview(result.data.data); }
          catch (e) { if (active) setError(getErrorMessage(e)); }
        }
      })
      .catch((e) => active && setError(getErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [staffMode]);
  useEffect(() => {
    if (!activeDept) return undefined;
    loadQueue(activeDept);
    const socket = io(API_ORIGIN, { transports: ['websocket','polling'] });
    socket.emit('join_department', activeDept);
    socket.on('queue:updated', () => {
      loadQueue(activeDept);
      if (staffMode) api.get('/analytics/overview').then((r)=>setOverview(r.data.data)).catch((e)=>setError(getErrorMessage(e)));
      else api.get('/queues/mine').then((r)=>setTicket(r.data.data[0]||null)).catch((e)=>setError(getErrorMessage(e)));
    });
    return () => { socket.off('queue:updated'); socket.disconnect(); };
  }, [activeDept, staffMode]);

  async function createAppointment(event) {
    event.preventDefault(); setNotice(''); setError('');
    try {
      const notes = new FormData(event.currentTarget).get('notes');
      const { data } = await api.post('/appointments', { departmentId: booking.departmentId, scheduledAt: new Date(booking.scheduledAt).toISOString(), ...(notes ? { notes } : {}) });
      setAppointments((old)=>[data.data,...old]); setNotice('Your appointment is booked. You can check in for a queue token on the day of your visit.');
      setBooking((old)=>({...old,scheduledAt:''}));
    } catch (e) { setError(getErrorMessage(e)); }
  }
  async function registerWalkIn() {
    setError(''); setNotice('');
    try {
      const { data } = await api.post('/queues/register', { departmentId: activeDept });
      setTicket(data.data); setNotice(`You're registered. Your token is ${data.data.code}.`); await loadQueue();
    } catch (e) { setError(getErrorMessage(e)); }
  }
  async function checkInAppointment(appointment) {
    setError(''); setNotice('');
    try {
      const { data } = await api.post('/queues/register', { departmentId: appointment.departmentId, appointmentId: appointment.id });
      setTicket(data.data); setActiveDept(appointment.departmentId); setNotice(`Checked in. Your token is ${data.data.code}.`);
      setQueue((await api.get(`/queues/${appointment.departmentId}/status`)).data.data);
      await loadBase();
    } catch (e) { setError(getErrorMessage(e)); }
  }
  async function runAction(path, successMessage) {
    setError(''); setNotice('');
    try { const { data } = await api.post(path); setNotice(successMessage); if (data.data?.code) setTicket(data.data); await loadQueue(); if (staffMode) setOverview((await api.get('/analytics/overview')).data.data); }
    catch (e) { setError(getErrorMessage(e)); }
  }
  async function setPolicy(policy) {
    try { await api.put(`/queues/${activeDept}/scheduling`, { policy }); setNotice(`Scheduling updated to ${policy}.`); await loadQueue(); }
    catch (e) { setError(getErrorMessage(e)); }
  }
  async function createDepartment(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.post('/departments', { name: form.get('name'), description: form.get('description'), averageServiceMin: Number(form.get('averageServiceMin')), policy: 'FIFO' });
      await loadBase(); setNotice('Department added.'); event.currentTarget.reset();
    } catch (e) { setError(getErrorMessage(e)); }
  }
  const simulation = useMemo(() => {
    if (!simulated) return null;
    const lambda = Number(simArrival), mu = Number(simService);
    if (!lambda || !mu || lambda >= mu) return { stable:false };
    return { stable:true, rho:lambda/mu, queueLength:lambda**2/(mu*(mu-lambda)), wait:lambda/(mu*(mu-lambda))*60 };
  }, [simArrival, simService, simulated]);
  const isAdmin = user.role==='ADMIN';

  return <div className="min-h-screen bg-canvas text-ink">
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur"><div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-7"><div className="flex items-center gap-3"><button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-canvas lg:hidden" onClick={()=>setNavOpen(!navOpen)}><Menu size={20} /></button><Logo /></div><div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-extrabold">{user.name}</span><span className="block text-xs text-slate-400">{user.role.toLowerCase()}</span></span><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700">{user.name.charAt(0)}</div><button title="Sign out" onClick={signOut} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"><LogOut size={18} /></button></div></div></header>
    <div className="mx-auto flex max-w-[1500px]">
      <aside className={`${navOpen?'fixed inset-y-[72px] left-0 z-20 block shadow-xl':'hidden'} w-64 shrink-0 border-r border-slate-100 bg-white p-4 lg:sticky lg:top-[72px] lg:block lg:h-[calc(100vh-72px)]`}><div className="px-3 py-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">Workspace</div>{['Overview','Appointments','Queue board','Analytics',...(isAdmin?['Departments']:[])].map((item,i)=>{const Icon=[LayoutDashboard,CalendarDays,Radio,Activity,Hospital][i];return <button key={item} onClick={()=>{setTab(item);setNavOpen(false);}} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${tab===item?'bg-brand-50 text-brand-700':'text-slate-500 hover:bg-canvas hover:text-ink'}`}><Icon size={18} />{item}{item==='Appointments'&&appointments.length>0&&<span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{appointments.length}</span>}</button>})}<div className="mt-8 rounded-2xl bg-ink p-4 text-white"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><HeartPulse size={18} /></div><div className="mt-3 text-sm font-extrabold">MedQueue demo</div><p className="mt-1 text-xs leading-5 text-slate-300">Synthetic sample data. Not for clinical use.</p></div><Link to="/" className="absolute bottom-5 left-7 text-xs font-bold text-slate-400 hover:text-brand-700">← Back to home</Link></aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-9">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="text-sm font-semibold text-slate-400">{new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'}).format(new Date())}</div><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{tab==='Overview'?`Good ${new Date().getHours()<12?'morning':'afternoon'}, ${user.name.split(' ')[0]}`:tab}</h1><p className="mt-1 text-sm text-slate-500">{staffMode?'Here’s what’s happening across your care team.':'Your care, your time. Here’s your visit at a glance.'}</p></div><button onClick={()=>{loadBase().catch(e=>setError(getErrorMessage(e)));loadQueue();}} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-brand-300"><Activity size={15} className="mr-2 inline" />Refresh</button></div>
        {error&&<div role="alert" className="mb-5 flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={17} /></button></div>}
        {notice&&<div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><span>{notice}</span><button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={17} /></button></div>}
        {loading?<div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(x=><div key={x} className="skeleton h-32 rounded-2xl" />)}</div>:<>
          {tab==='Overview'&&<div className="space-y-6">
            {staffMode?<><StatsCards overview={overview} /><div className="grid gap-5 xl:grid-cols-[1.35fr_.8fr]"><Panel title="Department activity" subtitle="Today’s registrations and completions"><DepartmentChart departments={overview?.byDepartment||[]} /></Panel><QueuePanel departments={departments} activeDept={activeDept} setActiveDept={setActiveDept} queue={queue} user={user} onRegister={registerWalkIn} onAction={runAction} onPolicy={setPolicy} /></div><div className="grid gap-5 xl:grid-cols-2"><SimulationPanel arrival={simArrival} service={simService} setArrival={setSimArrival} setService={setSimService} onSimulate={()=>setSimulated(true)} result={simulation} /><Panel title="Today’s appointments" subtitle={`${appointments.length} scheduled`}><AppointmentList appointments={appointments.slice(0,5)} /></Panel></div></>:<><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><QueuePanel departments={departments} activeDept={activeDept} setActiveDept={setActiveDept} queue={queue} user={user} onRegister={registerWalkIn} onAction={runAction} onPolicy={setPolicy} /><BookingPanel departments={departments} booking={booking} setBooking={setBooking} onSubmit={createAppointment} /></div><TicketCard ticket={ticket} /><Panel title="Your appointments" subtitle="Upcoming and recent visits"><AppointmentList appointments={appointments} onCheckIn={checkInAppointment} onCancel={async(id)=>{try{await api.delete(`/appointments/${id}`);await loadBase();setNotice('Appointment cancelled.');}catch(e){setError(getErrorMessage(e));}}} patient /></Panel></>}
          </div>}
          {tab==='Appointments'&&<div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><BookingPanel departments={departments} booking={booking} setBooking={setBooking} onSubmit={createAppointment} /><Panel title="Appointment history" subtitle="Your scheduled and past visits"><AppointmentList appointments={appointments} onCheckIn={checkInAppointment} onCancel={async(id)=>{try{await api.delete(`/appointments/${id}`);await loadBase();setNotice('Appointment cancelled.');}catch(e){setError(getErrorMessage(e));}}} patient /></Panel></div>}
          {tab==='Queue board'&&<QueuePanel large departments={departments} activeDept={activeDept} setActiveDept={setActiveDept} queue={queue} user={user} onRegister={registerWalkIn} onAction={runAction} onPolicy={setPolicy} />}
          {tab==='Analytics'&&<div className="space-y-5"><StatsCards overview={overview} /><div className="grid gap-5 xl:grid-cols-2"><Panel title="Department queue performance" subtitle="Live counts paired with an M/M/1 estimate"><DepartmentChart departments={overview?.byDepartment||[]} /></Panel><SimulationPanel arrival={simArrival} service={simService} setArrival={setSimArrival} setService={setSimService} onSimulate={()=>setSimulated(true)} result={simulation} /></div></div>}
          {tab==='Departments'&&isAdmin&&<Panel title="Manage departments" subtitle="Add an active department to the hospital directory"><DepartmentManager departments={departments} onSubmit={createDepartment} onDeactivate={async(id)=>{try{await api.delete(`/departments/${id}`);await loadBase();setNotice('Department deactivated.');}catch(e){setError(getErrorMessage(e));}}} /></Panel>}
        </>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400"><span>MedQueue · synthetic demonstration environment</span><Link to={activeDept?`/display/${activeDept}`:'/app'} target="_blank" className="font-bold text-brand-700 hover:text-brand-800"><Radio size={13} className="mr-1 inline" />Open public display board</Link></div>
      </main>
    </div>
  </div>;
}

function Panel({ title, subtitle, children, className='' }) {
  return <section className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6 ${className}`}><div className="mb-5"><h2 className="font-display text-base font-extrabold text-ink">{title}</h2>{subtitle&&<p className="mt-1 text-xs text-slate-400">{subtitle}</p>}</div>{children}</section>;
}

function StatsCards({ overview }) {
  const stats=[['Patients',overview?.patients??'—',Users,'Registered accounts','text-sky-600','bg-sky-50'],['Waiting',overview?.waiting??'—',Clock3,'Active queue','text-amber-600','bg-amber-50'],['Completed',overview?.completed??'—',Check,'Consultations today','text-emerald-600','bg-emerald-50'],['Appointments',overview?.appointments??'—',CalendarDays,'Booked today','text-violet-600','bg-violet-50']];
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(([label,value,Icon,detail,color,bg])=><div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${bg} ${color}`}><Icon size={17} /></span></div><div className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">{value}</div><div className="mt-1 text-[11px] text-slate-400">{detail}</div></div>)}</div>;
}

function DepartmentChart({ departments }) {
  const data=departments.map(d=>({name:d.name.split(' ')[0],Waiting:d.waiting,Completed:d.completed}));
  return data.length?<div className="h-[270px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:8,right:8,left:-20,bottom:0}}><CartesianGrid stroke="#eef2f6" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#8391a2'}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#8391a2'}} allowDecimals={false} /><Tooltip cursor={{fill:'#f7fafc'}} contentStyle={{border:'1px solid #e8eef3',borderRadius:12,fontSize:12}} /><Bar dataKey="Waiting" fill="#f3b84b" radius={[5,5,0,0]} /><Bar dataKey="Completed" fill="#10a3a2" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div>:<Empty message="Department activity will appear when tokens are registered." />;
}

function QueuePanel({ departments, activeDept, setActiveDept, queue, user, onRegister, onAction, onPolicy, large=false }) {
  const staff=['ADMIN','STAFF','DOCTOR'].includes(user.role);
  const serving=queue?.serving;
  const canManage=staff;
  return <Panel className={large?'min-h-[550px]':''} title="Live department queue" subtitle="Changes sync to the public display in real time">
    <div className="flex flex-wrap items-center justify-between gap-3"><select aria-label="Department" value={activeDept} onChange={(e)=>setActiveDept(e.target.value)} className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-ink outline-none focus:border-brand-500">{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><div className="flex items-center gap-2 text-xs font-bold text-emerald-700"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live status</div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[.9fr_1.1fr]"><div className="rounded-2xl bg-ink p-5 text-white"><div className="text-xs font-semibold text-slate-300">NOW SERVING</div><div className="mt-3 font-display text-5xl font-extrabold tracking-tight">{serving?.code||'— —'}</div><div className="mt-2 truncate text-sm text-slate-300">{serving?.patient?.name||'No patient is being seen'}</div><div className="mt-5 flex items-center gap-2 text-xs text-slate-300"><span className="rounded-full bg-white/10 px-2.5 py-1">{queue?.department?.name||'Select a department'}</span><span>·</span><span>{queue?.waitingCount??0} waiting</span></div>{canManage&&<div className="mt-5 flex gap-2">{serving?<><button onClick={()=>onAction(`/queues/${activeDept}/${serving.id}/complete`,'Consultation completed.')} className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">Complete</button><button onClick={()=>onAction(`/queues/${activeDept}/${serving.id}/skip`,'Patient skipped.')} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">Skip</button></>:<button onClick={()=>onAction(`/queues/${activeDept}/call-next`,'Next patient called.')} className="w-full rounded-lg bg-brand-500 px-3 py-2.5 text-sm font-extrabold hover:bg-brand-600">Call next patient <ArrowRight size={15} className="ml-1 inline" /></button>}</div>}</div>
      <div className="rounded-2xl border border-slate-100 bg-canvas p-4"><div className="mb-3 flex items-center justify-between"><div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Waiting next</div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">{queue?.waitingCount??0}</span></div><div className="max-h-44 space-y-2 overflow-auto">{queue?.waiting?.slice(0,6).map((token,i)=><div key={token.id} className="flex items-center gap-3 rounded-xl bg-white p-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-xs font-extrabold text-brand-700">{token.code}</span><span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">{token.patient?.name}</span><span className="text-[10px] text-slate-400">~{token.estimatedWaitMin}m</span>{token.priority>0&&<span className="rounded bg-rose-50 px-1.5 py-1 text-[9px] font-extrabold text-rose-600">PRIORITY</span>}</div>)}{!queue?.waiting?.length&&<div className="py-8 text-center text-xs text-slate-400">No patients waiting right now.</div>}</div></div></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} className="text-brand-600" />Average service <b className="text-ink">{queue?.averageServiceMin??'—'} min</b></div><div className="flex flex-wrap gap-2">{canManage&&<select aria-label="Scheduling policy" value={queue?.department?.policy||'FIFO'} onChange={(e)=>onPolicy(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600"><option value="FIFO">FIFO policy</option><option value="LIFO">LIFO policy</option><option value="PRIORITY">Priority policy</option></select>}{!canManage&&<button onClick={onRegister} className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-700"><Plus size={14} className="mr-1 inline" />Walk-in token</button>}<Link to={`/display/${activeDept}`} target="_blank" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-brand-300"><Radio size={13} className="mr-1 inline" />Display</Link></div></div>
  </Panel>;
}

function BookingPanel({ departments, booking, setBooking, onSubmit }) {
  const minDate=new Date(Date.now()+60*60*1000).toISOString().slice(0,16);
  return <Panel title="Book an appointment" subtitle="Choose a department and a time that suits you"><form onSubmit={onSubmit} className="space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-bold text-ink">Department</span><select required value={booking.departmentId} onChange={(e)=>setBooking({...booking,departmentId:e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500">{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><Field label="Appointment date & time" type="datetime-local" value={booking.scheduledAt} min={minDate} onChange={(scheduledAt)=>setBooking({...booking,scheduledAt})} required /><label className="block"><span className="mb-1.5 block text-sm font-bold text-ink">Notes <span className="font-medium text-slate-400">(optional)</span></span><textarea name="notes" rows="3" maxLength="500" placeholder="Anything you'd like the care team to know?" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500" /></label><button className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700">Request appointment <ArrowRight size={15} className="ml-1 inline" /></button><p className="text-center text-[11px] leading-5 text-slate-400">Appointments are stored securely in the MedQueue demo database.</p></form></Panel>;
}

function AppointmentList({ appointments, onCancel, onCheckIn, patient=false }) {
  if (!appointments.length) return <Empty message="No appointments yet. Book a visit to see it here." />;
  return <div className="divide-y divide-slate-100">{appointments.map((item)=><div key={item.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><CalendarDays size={18} /></span><div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold text-ink">{item.department?.name||'Department'}</div><div className="mt-0.5 text-xs text-slate-400">{new Date(item.scheduledAt).toLocaleString()} · {item.status.toLowerCase().replace('_',' ')}</div></div>{item.token&&<span className="rounded-lg bg-canvas px-2.5 py-1.5 text-xs font-extrabold text-brand-700">Token {item.token.code}</span>}{patient&&item.status==='BOOKED'&&new Date(item.scheduledAt).toDateString()===new Date().toDateString()&&onCheckIn&&<button onClick={()=>onCheckIn(item)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">Check in</button>}{patient&&onCancel&&['BOOKED','CHECKED_IN'].includes(item.status)&&<button onClick={()=>onCancel(item.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">Cancel</button>}</div>)}</div>;
}

function TicketCard({ ticket }) {
  if (!ticket) return null;
  return <div className="my-5 rounded-2xl border border-brand-100 bg-brand-50 p-5 print:border-slate-300 print:bg-white"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs font-extrabold uppercase tracking-wider text-brand-700">Your digital token</div><div className="mt-1 font-display text-3xl font-extrabold text-ink">{ticket.code}</div><div className="mt-1 text-sm text-slate-600">{ticket.department?.name} · {new Date(ticket.registeredAt).toLocaleTimeString()}</div></div><div className="flex items-center gap-4"><div className="text-sm text-slate-600">{ticket.status==='SERVING'?'You are being seen':`${ticket.position||'—'} in line · ~${ticket.estimatedWaitMin??'—'} min`}</div><button onClick={()=>window.print()} className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 print:hidden">Print ticket</button></div></div></div>;
}

function SimulationPanel({ arrival, service, setArrival, setService, onSimulate, result }) {
  return <Panel title="Queue simulation" subtitle="Illustrative M/M/1 estimates — not live hospital measurements"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">Arrival rate · patients/hour<input type="number" min="0" max="200" value={arrival} onChange={(e)=>setArrival(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-ink" /></label><label className="text-xs font-bold text-slate-500">Service rate · patients/hour<input type="number" min="1" max="200" value={service} onChange={(e)=>setService(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-ink" /></label></div><button onClick={onSimulate} className="mt-3 rounded-lg bg-ink px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700">Run estimate <ArrowRight size={14} className="ml-1 inline" /></button>{result&&<div className={`mt-4 rounded-xl p-4 ${result.stable?'bg-brand-50':'bg-amber-50'}`}>{result.stable?<div className="grid grid-cols-3 gap-3 text-center"><Metric label="Utilization ρ" value={`${(result.rho*100).toFixed(1)}%`} /><Metric label="Avg. queue Lq" value={result.queueLength.toFixed(2)} /><Metric label="Queue wait Wq" value={`${result.wait.toFixed(1)} min`} /></div>:<div className="text-sm font-bold text-amber-800">The system is unstable: arrival rate must be lower than service rate (λ &lt; μ).</div>}</div>}</Panel>;
}
function Metric({label,value}) {return <div><div className="text-[10px] font-bold text-slate-500">{label}</div><div className="mt-1 font-display text-lg font-extrabold text-ink">{value}</div></div>;}

function DepartmentManager({ departments, onSubmit, onDeactivate }) {
  return <><form onSubmit={onSubmit} className="mb-6 grid gap-3 md:grid-cols-[1fr_2fr_140px_auto]"><input name="name" required minLength="2" placeholder="Department name" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><input name="description" required minLength="5" placeholder="Description" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><input name="averageServiceMin" type="number" min="1" max="180" defaultValue="12" aria-label="Average service minutes" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"><Plus size={15} className="mr-1 inline" />Add</button></form><div className="divide-y divide-slate-100">{departments.map((dept)=><div key={dept.id} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700"><Hospital size={17} /></span><div className="min-w-0 flex-1"><div className="font-bold">{dept.name}</div><div className="truncate text-xs text-slate-400">{dept.description}</div></div><span className="text-xs text-slate-500">{dept.averageServiceMin} min avg</span><button onClick={()=>onDeactivate(dept.id)} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">Deactivate</button></div>)}</div></>;
}

function DisplayBoard() {
  const { departmentId } = useParams();
  const [queue,setQueue]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    const refresh=()=>api.get(`/queues/${departmentId}/status`).then(({data})=>active&&setQueue(data.data)).catch((e)=>active&&setError(getErrorMessage(e)));
    refresh();
    const socket=io(API_ORIGIN,{transports:['websocket','polling']});
    socket.emit('join_department',departmentId);socket.on('queue:updated',refresh);
    const timer=setInterval(refresh,30000);
    return()=>{active=false;clearInterval(timer);socket.off('queue:updated');socket.disconnect();};
  },[departmentId]);
  return <div className="min-h-screen bg-[#0b1c2d] p-6 text-white sm:p-10"><div className="mx-auto max-w-7xl"><div className="flex items-center justify-between"><Logo inverse /><div className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />LIVE QUEUE</div></div><div className="mt-12 flex flex-wrap items-end justify-between gap-4"><div><div className="text-sm font-bold uppercase tracking-[.2em] text-cyan-300">Patient display</div><h1 className="mt-2 font-display text-4xl font-extrabold sm:text-6xl">{queue?.department?.name||'Department queue'}</h1></div><div className="text-sm text-slate-400">{new Date().toLocaleString()}</div></div>{error&&<div className="mt-6 rounded-xl bg-rose-500/10 p-4 text-rose-200">{error}</div>}<div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-3xl bg-gradient-to-br from-brand-700 to-sky-900 p-8 sm:p-12"><div className="text-sm font-bold tracking-[.18em] text-cyan-100">NOW SERVING</div><div className="mt-3 font-display text-8xl font-extrabold tracking-tight sm:text-[10rem]">{queue?.serving?.code||'— —'}</div><div className="mt-5 text-xl text-slate-200">{queue?.serving?.patient?.name||'Please wait for the next call'}</div></div><div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-extrabold">Coming up next</h2><span className="rounded-full bg-white/10 px-3 py-1 text-sm">{queue?.waitingCount||0} waiting</span></div><div className="mt-5 space-y-3">{queue?.waiting?.slice(0,5).map((token,index)=><div key={token.id} className="flex items-center gap-4 rounded-xl bg-white/5 p-4"><span className="text-xl font-extrabold text-cyan-300">{token.code}</span><span className="flex-1 text-slate-200">{token.patient?.name}</span><span className="text-sm text-slate-400">~{token.estimatedWaitMin} min</span>{token.priority>0&&<span className="rounded bg-rose-400/15 px-2 py-1 text-xs font-bold text-rose-200">Priority</span>}</div>)}{!queue?.waiting?.length&&<div className="py-12 text-center text-slate-400">The queue is clear.</div>}</div></div></div><div className="mt-8 flex justify-between text-sm text-slate-500"><span>MedQueue · Please keep your token visible.</span><span>Refreshes automatically</span></div></div></div>;
}

function Empty({ message }) { return <div className="rounded-xl bg-canvas px-5 py-8 text-center text-sm text-slate-400">{message}</div>; }

export default App;
