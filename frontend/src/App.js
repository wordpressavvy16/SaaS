import React, { useCallback, useEffect, useMemo, useState, createContext, useContext } from 'react';
import axios from 'axios';
import {
  Activity, BarChart3, BriefcaseBusiness, Check, ChevronLeft, ChevronRight,
  CircleHelp, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, Sparkles,
  Trash2, Users, Workflow, X, Pencil, Filter, Mail, Phone,
} from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const PAGE_SIZE = 10;
const STATUSES = ['new', 'qualified', 'contacted', 'proposal', 'customer', 'lost'];
const emptyContact = {
  first_name: '', last_name: '', email: '', phone: '', company: '', position: '',
  source: '', status: 'new', lead_score: 0, tags: [],
};

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
    setBusiness(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    axios.get(`${API}/auth/me`)
      .then(({ data }) => {
        setUser(data.user);
        setBusiness(data.business);
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem('token', data.access_token);
      axios.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
      setUser(data.user);
      setBusiness(data.business);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Unable to sign in.' };
    }
  };

  const registerBusiness = async (form) => {
    try {
      const { data } = await axios.post(`${API}/auth/register-business`, form);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed.' };
    }
  };

  return <AuthContext.Provider value={{ user, business, loading, login, logout, registerBusiness }}>{children}</AuthContext.Provider>;
}

function LoginForm({ onRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await login(email, password);
    if (!result.success) setError(result.error);
    setBusy(false);
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl">
        <div className="mb-8"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><BriefcaseBusiness size={24} /></div><h1 className="text-2xl font-bold text-slate-900">Welcome back</h1><p className="mt-1 text-sm text-slate-500">Sign in to your business workspace.</p></div>
        <form className="space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">Email<input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label className="block text-sm font-medium text-slate-700">Password<input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">New to the platform? <button onClick={onRegister} className="font-semibold text-indigo-600 hover:text-indigo-700">Register a business</button></p>
      </div>
    </div>
  );
}

function RegisterForm({ onBack }) {
  const { registerBusiness } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', domain: '', owner_email: '', owner_name: '', owner_username: '', owner_password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    const result = await registerBusiness(form);
    if (result.success) setMessage('Registration submitted. You can sign in once an administrator approves your business.');
    else setError(result.error);
    setBusy(false);
  };
  return <div className="min-h-screen bg-slate-950 px-4 py-10"><form onSubmit={submit} className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-2xl"><button type="button" onClick={onBack} className="mb-5 text-sm font-semibold text-indigo-600">← Back to sign in</button><h1 className="text-2xl font-bold text-slate-900">Register your business</h1><p className="mb-7 mt-1 text-sm text-slate-500">Create a workspace and administrator account.</p><div className="grid gap-4 sm:grid-cols-2">{[['name','Business name'],['domain','Domain'],['owner_name','Owner full name'],['owner_username','Username'],['owner_email','Owner email'],['owner_password','Password']].map(([name,label]) => <label key={name} className="text-sm font-medium text-slate-700">{label}<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" name={name} type={name.includes('password')?'password':name.includes('email')?'email':'text'} value={form[name]} onChange={change} required={!['domain'].includes(name)} /></label>)}</div><label className="mt-4 block text-sm font-medium text-slate-700">Description<textarea className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" rows="3" name="description" value={form.description} onChange={change} /></label>{error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}<button disabled={busy} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy?'Submitting…':'Submit registration'}</button></form></div>;
}

function SuperAdminDashboard() {
  const { logout } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/admin/businesses`); setBusinesses(data); setError(''); }
    catch (e) { setError(e.response?.data?.detail || 'Could not load business applications.'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const act = async (id, action) => { try { await axios.post(`${API}/admin/businesses/${id}/${action}`); await refresh(); } catch (e) { setError(e.response?.data?.detail || `Could not ${action} business.`); } };
  return <div className="min-h-screen bg-slate-50"><header className="flex items-center justify-between border-b bg-white px-6 py-4"><h1 className="font-bold text-slate-900">Platform administration</h1><button onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"><LogOut size={16}/>Sign out</button></header><main className="mx-auto max-w-5xl px-4 py-10"><h2 className="text-2xl font-bold text-slate-900">Business applications</h2><p className="mb-6 mt-1 text-slate-500">Review and approve new workspaces.</p>{error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="space-y-3">{businesses.map((item)=><article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><h3 className="font-semibold text-slate-900">{item.name}</h3><p className="text-sm text-slate-500">{item.description || item.domain || 'No description'}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-600">{item.status}</span></div>{item.status==='pending'&&<div className="flex gap-2"><button onClick={()=>act(item.id,'approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Approve</button><button onClick={()=>act(item.id,'reject')} className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">Reject</button></div>}</article>)}{businesses.length===0&&<div className="rounded-2xl border border-dashed bg-white p-12 text-center text-slate-500">No business applications yet.</div>}</div></main></div>;
}

function ContactModal({ contact, onClose, onSaved }) {
  const [form, setForm] = useState(contact ? { ...emptyContact, ...contact } : { ...emptyContact });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const payload = { ...form, email: form.email.trim() || null, phone: form.phone.trim() || null, company: form.company.trim() || null, position: form.position.trim() || null, source: form.source.trim() || null, lead_score: Number(form.lead_score) };
    try {
      if (contact?.id) await axios.put(`${API}/crm/contacts/${contact.id}`, payload);
      else await axios.post(`${API}/crm/contacts`, payload);
      onSaved();
    } catch (err) { setError(err.response?.data?.detail || 'Unable to save contact.'); }
    finally { setBusy(false); }
  };
  const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50';
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}><section role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title" className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b px-6 py-5"><div><h2 id="contact-dialog-title" className="text-xl font-bold text-slate-900">{contact?'Edit contact':'Add contact'}</h2><p className="mt-1 text-sm text-slate-500">Contact details, pipeline stage, and lead score.</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></div><form onSubmit={submit} className="p-6"><div className="grid gap-4 sm:grid-cols-2">{[['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone'],['company','Company'],['position','Position'],['source','Source']].map(([key,label])=><label key={key} className="text-sm font-medium text-slate-700">{label}<input className={inputClass} type={key==='email'?'email':'text'} value={form[key]||''} onChange={(e)=>set(key,e.target.value)} required={key==='first_name'||key==='last_name'} /></label>)}<label className="text-sm font-medium text-slate-700">Pipeline status<select className={inputClass} value={form.status} onChange={(e)=>set('status',e.target.value)}>{STATUSES.map((status)=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Lead score <span className="font-normal text-slate-400">(0–100)</span><input className={inputClass} type="number" min="0" max="100" value={form.lead_score} onChange={(e)=>set('lead_score',e.target.value)} /></label></div>{error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3 border-t pt-5"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy?'Saving…':contact?'Save changes':'Create contact'}</button></div></form></section></div>;
}

function CRMPage() {
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (query.trim()) params.q = query.trim();
      if (status !== 'all') params.status = status;
      if (source !== 'all') params.source = source;
      const { data } = await axios.get(`${API}/crm/contacts`, { params });
      setContacts(data);
    } catch (e) { setContacts([]); setError(e.response?.data?.detail || 'Could not load contacts. Please try again.'); }
    finally { setLoading(false); }
  }, [page, query, status, source]);

  useEffect(() => { const timer = setTimeout(fetchContacts, query ? 250 : 0); return () => clearTimeout(timer); }, [fetchContacts, query]);
  useEffect(() => { setPage(0); }, [status, source]);

  const sources = useMemo(() => [...new Set(contacts.map((contact) => contact.source).filter(Boolean))].sort(), [contacts]);
  const saveComplete = async () => { setModal(null); setNotice('Contact saved successfully.'); await fetchContacts(); };
  const removeContact = async (contact) => {
    try { await axios.delete(`${API}/crm/contacts/${contact.id}`); setConfirmDelete(null); setNotice('Contact deleted.'); await fetchContacts(); }
    catch (e) { setError(e.response?.data?.detail || 'Could not delete contact.'); setConfirmDelete(null); }
  };
  const updateScore = async (contact, value) => {
    const score = Math.max(0, Math.min(100, Number(value)));
    try { await axios.patch(`${API}/crm/contacts/${contact.id}`, { lead_score: score }); setContacts((rows)=>rows.map((row)=>row.id===contact.id?{...row,lead_score:score}:row)); }
    catch (e) { setError(e.response?.data?.detail || 'Could not update lead score.'); }
  };

  return <div>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600"><Users size={15}/> Customer relationships</div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Contacts</h1><p className="mt-1 text-sm text-slate-500">Manage your leads and customer relationships in one place.</p></div><button onClick={()=>setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"><Plus size={17}/> Add contact</button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><StatCard label="Contacts on this page" value={contacts.length} icon={<Users size={18}/>} /><StatCard label="Qualified leads" value={contacts.filter((item)=>item.status==='qualified').length} icon={<Check size={18}/>} /><StatCard label="Customers" value={contacts.filter((item)=>item.status==='customer').length} icon={<BriefcaseBusiness size={18}/>} /></div>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Search contacts" value={query} onChange={(e)=>{setQuery(e.target.value);setPage(0);}} placeholder="Search name, email, company, phone…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"/></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-400"><Filter size={15}/><select aria-label="Filter by status" className="bg-transparent py-2.5 text-sm text-slate-700 outline-none" value={status} onChange={(e)=>{setStatus(e.target.value);setPage(0);}}><option value="all">All statuses</option>{STATUSES.map((item)=><option key={item} value={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}</select></label><select aria-label="Filter by source" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500" value={source} onChange={(e)=>{setSource(e.target.value);setPage(0);}}><option value="all">All sources</option>{sources.map((item)=><option key={item} value={item}>{item}</option>)}</select></div></div>
      {notice&&<div role="status" className="mx-4 mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>{notice}</span><button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={16}/></button></div>}{error&&<div role="alert" className="mx-4 mt-4 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Lead score</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading?<tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-slate-500"><span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent align-middle"/> <span className="ml-2">Loading contacts…</span></td></tr>:contacts.map((contact)=><tr key={contact.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="font-semibold text-slate-900">{contact.first_name} {contact.last_name}</div><div className="mt-1 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:gap-3">{contact.email&&<span className="inline-flex items-center gap-1"><Mail size={12}/>{contact.email}</span>}{contact.phone&&<span className="inline-flex items-center gap-1"><Phone size={12}/>{contact.phone}</span>}</div></td><td className="px-5 py-4"><div className="text-sm text-slate-700">{contact.company||'—'}</div>{contact.position&&<div className="text-xs text-slate-400">{contact.position}</div>}</td><td className="px-5 py-4 text-sm text-slate-600">{contact.source||'—'}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyle(contact.status)}`}>{contact.status||'new'}</span></td><td className="px-5 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{width:`${contact.lead_score||0}%`}}/></div><input aria-label={`Lead score for ${contact.first_name} ${contact.last_name}`} className="w-12 rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-slate-700 outline-none hover:border-slate-200 focus:border-indigo-400" type="number" min="0" max="100" value={contact.lead_score||0} onChange={(e)=>setContacts((rows)=>rows.map((row)=>row.id===contact.id?{...row,lead_score:e.target.value}:row))} onBlur={(e)=>updateScore(contact,e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')e.currentTarget.blur();}}/></div></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button aria-label={`Edit ${contact.first_name} ${contact.last_name}`} onClick={()=>setModal(contact)} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><Pencil size={16}/></button><button aria-label={`Delete ${contact.first_name} ${contact.last_name}`} onClick={()=>setConfirmDelete(contact)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16}/></button></div></td></tr>)}{!loading&&contacts.length===0&&<tr><td colSpan="6" className="px-5 py-16 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Users size={23}/></div><p className="font-semibold text-slate-800">No contacts found</p><p className="mt-1 text-sm text-slate-500">Try changing your filters or add your first contact.</p><button onClick={()=>setModal({})} className="mt-4 text-sm font-semibold text-indigo-600">Add a contact</button></td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"><p className="text-sm text-slate-500">Page {page+1} · Showing {contacts.length} contact{contacts.length===1?'':'s'}</p><div className="flex gap-2"><button disabled={page===0||loading} onClick={()=>setPage((p)=>Math.max(0,p-1))} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16}/>Previous</button><button disabled={contacts.length<PAGE_SIZE||loading} onClick={()=>setPage((p)=>p+1)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={16}/></button></div></div>
    </div>
    {modal&&<ContactModal contact={modal.id?modal:null} onClose={()=>setModal(null)} onSaved={saveComplete}/>}
    {confirmDelete&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={20}/></div><h2 className="text-lg font-bold text-slate-900">Delete contact?</h2><p className="mt-2 text-sm text-slate-500">This will permanently remove {confirmDelete.first_name} {confirmDelete.last_name} from your contacts.</p><div className="mt-6 flex justify-end gap-3"><button onClick={()=>setConfirmDelete(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button onClick={()=>removeContact(confirmDelete)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Delete contact</button></div></section></div>}
  </div>;
}

function statusStyle(status) {
  return ({new:'bg-sky-50 text-sky-700',qualified:'bg-violet-50 text-violet-700',contacted:'bg-amber-50 text-amber-700',proposal:'bg-indigo-50 text-indigo-700',customer:'bg-emerald-50 text-emerald-700',lost:'bg-rose-50 text-rose-700'})[status] || 'bg-slate-100 text-slate-600';
}

function StatCard({ label, value, icon }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</div><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p></div></div>;
}

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'crm', label: 'CRM & Contacts', icon: Users },
  { id: 'ai-automation', label: 'AI Automation', icon: Workflow },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

function PlaceholderPage({ page }) {
  const content = {
    overview: { title: 'Workspace overview', description: 'Your business workspace is ready. Jump into contacts to manage leads and customers.' },
    'ai-automation': { title: 'AI Automation', description: 'Create and monitor workflows for your business.' },
    analytics: { title: 'Analytics', description: 'Business performance and activity at a glance.' },
  }[page];
  const [analytics, setAnalytics] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  useEffect(() => {
    if (page === 'overview' || page === 'analytics') axios.get(`${API}/analytics/dashboard`).then(({data})=>setAnalytics(data)).catch(()=>{});
    if (page === 'ai-automation') axios.get(`${API}/ai/workflows`).then(({data})=>setWorkflows(data)).catch(()=>{});
  }, [page]);
  return <div><div className="mb-7"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600"><Sparkles size={15}/> Workspace</div><h1 className="text-3xl font-bold text-slate-900">{content.title}</h1><p className="mt-1 text-sm text-slate-500">{content.description}</p></div>{(page==='overview'||page==='analytics')&&<div className="grid gap-4 sm:grid-cols-3"><StatCard label="Total contacts" value={analytics?.total_contacts??'—'} icon={<Users size={18}/>} /><StatCard label="Workflows" value={analytics?.total_workflows??'—'} icon={<Workflow size={18}/>} /><StatCard label="Active workflows" value={analytics?.active_workflows??'—'} icon={<Activity size={18}/>} /></div>}{page==='ai-automation'&&<div className="rounded-2xl border bg-white p-6"><h2 className="font-semibold text-slate-900">Your workflows</h2>{workflows.length?<div className="mt-4 space-y-3">{workflows.map((workflow)=><div key={workflow.id} className="rounded-xl border p-4"><p className="font-medium text-slate-900">{workflow.name}</p><p className="mt-1 text-sm text-slate-500">{workflow.description||'No description'} · {workflow.trigger_type}</p></div>)}</div>:<p className="mt-3 text-sm text-slate-500">No workflows yet. Workflow creation will be added in the AI Automation module phase.</p>}</div>}</div>;
}

function BusinessDashboard() {
  const { user, business, logout } = useAuth();
  const [activePage, setActivePage] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (user?.full_name||'U').split(' ').map((part)=>part[0]).slice(0,2).join('').toUpperCase();
  const currentNav = navigation.find((item)=>item.id===activePage);
  return <div className="min-h-screen bg-slate-50 text-slate-900"><aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-white transition-transform lg:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full'}`}><div className="flex h-20 items-center gap-3 border-b border-white/10 px-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500"><BriefcaseBusiness size={20}/></div><div className="min-w-0"><p className="truncate text-sm font-bold">{business?.name||'Workspace'}</p><p className="text-xs text-slate-400">Enterprise workspace</p></div><button className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/10 lg:hidden" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"><X size={18}/></button></div><div className="px-4 pt-6"><p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Workspace</p><nav className="mt-3 space-y-1">{navigation.map(({id,label,icon:Icon})=><button key={id} onClick={()=>{setActivePage(id);setMobileOpen(false);}} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${activePage===id?'bg-indigo-500/15 text-indigo-300':'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon size={18}/>{label}{id==='crm'&&<span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px]">CRM</span>}</button>)}</nav></div><div className="mt-auto border-t border-white/10 p-4"><button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-white"><Settings size={17}/>Settings</button><button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-white"><CircleHelp size={17}/>Help & support</button><div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.full_name}</p><p className="truncate text-xs capitalize text-slate-500">{(user?.role||'').replaceAll('_',' ')}</p></div><button onClick={logout} title="Sign out" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><LogOut size={17}/></button></div></div></aside><div className="lg:pl-64"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-7"><div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="text-sm text-slate-400">Workspace <span className="mx-2">/</span><span className="font-semibold text-slate-800">{currentNav?.label}</span></div></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{user?.full_name}</span><div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initials}</div></div></header><main className="mx-auto max-w-7xl p-4 sm:p-7">{activePage==='crm'?<CRMPage/>:<PlaceholderPage page={activePage}/>}</main></div>{mobileOpen&&<button aria-label="Close navigation overlay" onClick={()=>setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"/>}</div>;
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [register, setRegister] = useState(false);
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"/></div>;
  if (!user) return register ? <RegisterForm onBack={()=>setRegister(false)}/> : <LoginForm onRegister={()=>setRegister(true)}/>;
  if (user.role==='super_admin') return <SuperAdminDashboard/>;
  return <BusinessDashboard/>;
}

export default function App() {
  return <AuthProvider><AuthenticatedApp/></AuthProvider>;
}
