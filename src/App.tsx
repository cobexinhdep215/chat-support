/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db 
} from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Plus, 
  Settings, 
  MessageSquare, 
  BookOpen, 
  LogOut, 
  Code, 
  ExternalLink,
  Trash2,
  Save,
  Send,
  X,
  ChevronRight,
  Globe,
  FileText,
  Car,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  domain: string;
  settings: {
    primaryColor: string;
    logoUrl: string;
    welcomeMessage: string;
    botName: string;
  };
  createdAt: any;
}

interface KnowledgeEntry {
  id: string;
  workspaceId: string;
  type: 'url' | 'text' | 'pdf';
  content: string;
  source: string;
  createdAt: any;
}

interface ChatLog {
  id: string;
  workspaceId: string;
  userId: string;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: any }[];
  createdAt: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'training' | 'customization' | 'logs' | 'sdk'>('dashboard');
  
  // Widget mode detection
  const isWidgetMode = new URLSearchParams(window.location.search).get('widget') === 'true';
  const widgetWorkspaceId = new URLSearchParams(window.location.search).get('workspaceId');

  const [widgetWorkspace, setWidgetWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    if (isWidgetMode && widgetWorkspaceId) {
      const unsubscribe = onSnapshot(doc(db, 'workspaces', widgetWorkspaceId), (docSnap) => {
        if (docSnap.exists()) {
          setWidgetWorkspace({ id: docSnap.id, ...docSnap.data() } as Workspace);
        }
      });
      return unsubscribe;
    }
  }, [isWidgetMode, widgetWorkspaceId]);

  // Auth listener
  useEffect(() => {
    if (isWidgetMode) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, [isWidgetMode]);

  // Workspaces listener
  useEffect(() => {
    if (!user || isWidgetMode) return;
    const q = query(collection(db, 'workspaces'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ws = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
      setWorkspaces(ws);
      if (ws.length > 0 && !activeWorkspace) {
        setActiveWorkspace(ws[0]);
      }
    });
    return unsubscribe;
  }, [user, isWidgetMode]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (isWidgetMode) {
    if (!widgetWorkspace) return null;
    return <ChatWidget workspace={widgetWorkspace} fullScreen />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Car className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">DoxeAI</h1>
          <p className="text-slate-600 mb-8">
            The ultimate AI chatbot for car tuning & accessories. 
            Manage your workspaces and train your bot in minutes.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Car className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-slate-900">DoxeAI</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Workspaces" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          {activeWorkspace && (
            <>
              <SidebarItem 
                icon={<BookOpen size={20} />} 
                label="Training" 
                active={activeTab === 'training'} 
                onClick={() => setActiveTab('training')} 
              />
              <SidebarItem 
                icon={<Settings size={20} />} 
                label="Customization" 
                active={activeTab === 'customization'} 
                onClick={() => setActiveTab('customization')} 
              />
              <SidebarItem 
                icon={<MessageSquare size={20} />} 
                label="Chat Logs" 
                active={activeTab === 'logs'} 
                onClick={() => setActiveTab('logs')} 
              />
              <SidebarItem 
                icon={<Code size={20} />} 
                label="Get SDK" 
                active={activeTab === 'sdk'} 
                onClick={() => setActiveTab('sdk')} 
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" alt="Avatar" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <DashboardView 
              workspaces={workspaces} 
              activeWorkspace={activeWorkspace} 
              setActiveWorkspace={setActiveWorkspace} 
              user={user}
            />
          )}
          {activeTab === 'training' && activeWorkspace && (
            <TrainingView workspace={activeWorkspace} />
          )}
          {activeTab === 'customization' && activeWorkspace && (
            <CustomizationView workspace={activeWorkspace} />
          )}
          {activeTab === 'logs' && activeWorkspace && (
            <LogsView workspace={activeWorkspace} />
          )}
          {activeTab === 'sdk' && activeWorkspace && (
            <SDKView workspace={activeWorkspace} />
          )}
        </AnimatePresence>
      </main>

      {/* Floating Widget Preview (Demo) */}
      {activeWorkspace && (
        <ChatWidget workspace={activeWorkspace} />
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
        active 
          ? "bg-blue-50 text-blue-600 shadow-sm" 
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Views ---

function DashboardView({ workspaces, activeWorkspace, setActiveWorkspace, user }: { workspaces: Workspace[], activeWorkspace: Workspace | null, setActiveWorkspace: (ws: Workspace) => void, user: User }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');

  const createWorkspace = async () => {
    if (!newName) return;
    const wsData = {
      name: newName,
      ownerId: user.uid,
      domain: newDomain || 'localhost',
      settings: {
        primaryColor: '#2563eb',
        logoUrl: '',
        welcomeMessage: 'Hello! How can I help you with your car tuning today?',
        botName: 'Doxe Consultant'
      },
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'workspaces'), wsData);
    setIsCreating(false);
    setNewName('');
    setNewDomain('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Your Workspaces</h2>
          <p className="text-slate-500 text-sm">Manage multiple websites from one place.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          New Workspace
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workspaces.map(ws => (
          <div 
            key={ws.id}
            onClick={() => setActiveWorkspace(ws)}
            className={cn(
              "p-6 rounded-xl border-2 cursor-pointer transition-all",
              activeWorkspace?.id === ws.id 
                ? "border-blue-600 bg-blue-50/50 shadow-md" 
                : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Globe className="text-slate-600" size={24} />
              </div>
              {activeWorkspace?.id === ws.id && (
                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">ACTIVE</span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 text-lg">{ws.name}</h3>
            <p className="text-slate-500 text-sm mb-4">{ws.domain}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ChevronRight size={14} />
              Click to manage
            </div>
          </div>
        ))}
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold mb-6">Create New Workspace</h3>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Workspace Name</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Doxe Club Main"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Domain</label>
                <input 
                  type="text" 
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  placeholder="e.g. doxeclub.com"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsCreating(false)}
                className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={createWorkspace}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function TrainingView({ workspace }: { workspace: Workspace }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState('');
  const [type, setType] = useState<'url' | 'text'>('url');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'workspaces', workspace.id, 'knowledge_base'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnowledgeEntry)));
    });
    return unsubscribe;
  }, [workspace.id]);

  const addEntry = async () => {
    if (!newContent) return;
    await addDoc(collection(db, 'workspaces', workspace.id, 'knowledge_base'), {
      workspaceId: workspace.id,
      type,
      content: newContent,
      source: newSource || (type === 'url' ? newContent : 'Manual Entry'),
      createdAt: serverTimestamp()
    });
    setNewContent('');
    setNewSource('');
    setIsAdding(false);
  };

  const deleteEntry = async (id: string) => {
    await deleteDoc(doc(db, 'workspaces', workspace.id, 'knowledge_base', id));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI Training</h2>
          <p className="text-slate-500 text-sm">Feed your bot with data from {workspace.name}.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Knowledge
        </button>
      </div>

      <div className="space-y-4">
        {entries.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="text-slate-400" />
            </div>
            <p className="text-slate-500">No knowledge base entries yet. Add some to train your AI.</p>
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
                  {entry.type === 'url' ? <Globe size={20} className="text-blue-500" /> : <FileText size={20} className="text-orange-500" />}
                </div>
                <div>
                  <p className="font-medium text-slate-900 truncate max-w-md">{entry.source}</p>
                  <p className="text-xs text-slate-500 truncate max-w-md">{entry.content.substring(0, 100)}...</p>
                </div>
              </div>
              <button 
                onClick={() => deleteEntry(entry.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold mb-6">Add Knowledge Entry</h3>
            <div className="flex gap-2 mb-6">
              <button 
                onClick={() => setType('url')}
                className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", type === 'url' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600")}
              >
                URL / Crawler
              </button>
              <button 
                onClick={() => setType('text')}
                className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", type === 'text' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600")}
              >
                Raw Text
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {type === 'url' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Source URL</label>
                  <input 
                    type="url" 
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    placeholder="https://doxeclub.com/about-us"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-2">The AI will crawl this URL for information.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source Title</label>
                    <input 
                      type="text" 
                      value={newSource}
                      onChange={e => setNewSource(e.target.value)}
                      placeholder="e.g. Tuning Price List 2024"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                    <textarea 
                      rows={6}
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      placeholder="Paste your knowledge base text here..."
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={addEntry}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Add to Memory
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function CustomizationView({ workspace }: { workspace: Workspace }) {
  const [settings, setSettings] = useState(workspace.settings);
  const [saving, setSaving] = useState(false);

  const saveSettings = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'workspaces', workspace.id), { settings });
    setSaving(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customization</h2>
          <p className="text-slate-500 text-sm">Style the chat widget to match your brand.</p>
        </div>
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Bot Name</label>
            <input 
              type="text" 
              value={settings.botName}
              onChange={e => setSettings({ ...settings, botName: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Primary Color</label>
            <div className="flex gap-3">
              <input 
                type="color" 
                value={settings.primaryColor}
                onChange={e => setSettings({ ...settings, primaryColor: e.target.value })}
                className="w-12 h-12 p-1 border border-slate-200 rounded-lg cursor-pointer"
              />
              <input 
                type="text" 
                value={settings.primaryColor}
                onChange={e => setSettings({ ...settings, primaryColor: e.target.value })}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Welcome Message</label>
            <textarea 
              rows={3}
              value={settings.welcomeMessage}
              onChange={e => setSettings({ ...settings, welcomeMessage: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Logo URL</label>
            <input 
              type="text" 
              value={settings.logoUrl}
              onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-2xl p-8 border-2 border-dashed border-slate-200">
          <p className="text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase">Live Preview</p>
          <div className="w-full max-w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div 
              className="p-4 text-white flex items-center gap-3"
              style={{ backgroundColor: settings.primaryColor }}
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Car size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">{settings.botName}</p>
                <p className="text-[10px] opacity-80">Online</p>
              </div>
            </div>
            <div className="p-4 h-64 bg-slate-50 flex flex-col justify-end gap-3">
              <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm text-xs text-slate-700 max-w-[80%] border border-slate-100">
                {settings.welcomeMessage}
              </div>
            </div>
            <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
              <div className="flex-1 h-8 bg-slate-50 rounded-full border border-slate-200 px-3 flex items-center text-[10px] text-slate-400">
                Type a message...
              </div>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: settings.primaryColor }}
              >
                <Send size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LogsView({ workspace }: { workspace: Workspace }) {
  const [logs, setLogs] = useState<ChatLog[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'workspaces', workspace.id, 'chat_logs'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatLog)));
    });
    return unsubscribe;
  }, [workspace.id]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto"
    >
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Chat Logs</h2>
      <p className="text-slate-500 text-sm mb-8">Monitor how users are interacting with your AI.</p>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <p className="text-slate-500">No chat history yet.</p>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">USER: {log.userId.substring(0, 8)}</span>
                  <span className="text-[10px] text-slate-300">•</span>
                  <span className="text-xs text-slate-500">
                    {log.createdAt?.toDate().toLocaleString() || 'Just now'}
                  </span>
                </div>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {log.messages.length} messages
                </span>
              </div>
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {log.messages.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex flex-col",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "max-w-[80%] p-3 rounded-2xl text-sm",
                      msg.role === 'user' 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-slate-100 text-slate-700 rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function SDKView({ workspace }: { workspace: Workspace }) {
  const [copied, setCopied] = useState(false);
  const sdkCode = `<!-- DoxeAI Chat Widget -->
<script>
  window.DOXE_AI_CONFIG = {
    workspaceId: "${workspace.id}",
    botName: "${workspace.settings.botName}",
    primaryColor: "${workspace.settings.primaryColor}"
  };
</script>
<script src="${window.location.origin}/sdk.js" async></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sdkCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto"
    >
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Embed SDK</h2>
      <p className="text-slate-500 text-sm mb-8">Add this code snippet to your website's &lt;head&gt; or &lt;body&gt;.</p>

      <div className="bg-slate-900 rounded-2xl p-6 relative group">
        <button 
          onClick={copyToClipboard}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-xs"
        >
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
        <pre className="text-blue-400 font-mono text-sm overflow-x-auto">
          {sdkCode}
        </pre>
      </div>

      <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          <ExternalLink size={18} />
          How it works
        </h4>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
          <li>The script is lightweight and won't block page rendering.</li>
          <li>It automatically injects the chat widget with your custom settings.</li>
          <li>AI responses are generated in real-time based on your training data.</li>
          <li>Works on any platform (WordPress, Shopify, React, etc.).</li>
        </ul>
      </div>
    </motion.div>
  );
}

// --- Chat Widget Component ---

function ChatWidget({ workspace, fullScreen }: { workspace: Workspace, fullScreen?: boolean }) {
  const [isOpen, setIsOpen] = useState(fullScreen || false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: workspace.settings.welcomeMessage }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatLogId, setChatLogId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Handle postMessage for SDK
  useEffect(() => {
    if (fullScreen) {
      window.parent.postMessage({ type: 'DOXE_AI_STATE', isOpen }, '*');
    }
  }, [isOpen, fullScreen]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      // 1. Fetch Knowledge Base for RAG
      const kbQuery = query(collection(db, 'workspaces', workspace.id, 'knowledge_base'));
      const kbSnapshot = await getDocs(kbQuery);
      const context = kbSnapshot.docs.map(doc => doc.data().content).join('\n\n');

      // 2. Call Gemini
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `Context: ${context}\n\nUser Question: ${userMsg}` }] }
        ],
        config: {
          systemInstruction: `You are ${workspace.settings.botName}, an expert car consultant for ${workspace.name}. 
          Use the provided context to answer questions about car parts, tuning, and services. 
          Be professional, helpful, and concise. If the answer isn't in the context, say you'll check with the team.`
        }
      });

      const botMsg = response.text || "I'm sorry, I couldn't process that.";
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: botMsg }];
      setMessages(finalMessages);

      // 3. Log Chat
      const logData = {
        workspaceId: workspace.id,
        userId: 'sdk-user',
        messages: finalMessages.map(m => ({ ...m, timestamp: new Date().toISOString() })),
        createdAt: serverTimestamp()
      };

      if (chatLogId) {
        await updateDoc(doc(db, 'workspaces', workspace.id, 'chat_logs', chatLogId), logData);
      } else {
        const docRef = await addDoc(collection(db, 'workspaces', workspace.id, 'chat_logs'), logData);
        setChatLogId(docRef.id);
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div 
          className="p-4 text-white flex items-center justify-between"
          style={{ backgroundColor: workspace.settings.primaryColor }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              {workspace.settings.logoUrl ? (
                <img src={workspace.settings.logoUrl} className="w-full h-full rounded-full object-cover" alt="Logo" />
              ) : (
                <Car size={20} />
              )}
            </div>
            <div>
              <p className="font-bold text-sm">{workspace.settings.botName}</p>
              <p className="text-[10px] opacity-80">Expert Car Consultant</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={cn(
              "flex flex-col",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white text-slate-700 rounded-tl-none border border-slate-100"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start">
              <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                <motion.div 
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex gap-1"
                >
                  <div className="w-1 h-1 bg-slate-400 rounded-full" />
                  <div className="w-1 h-1 bg-slate-400 rounded-full" />
                  <div className="w-1 h-1 bg-slate-400 rounded-full" />
                </motion.div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 bg-white flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about tuning, parts..."
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button 
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: workspace.settings.primaryColor }}
          >
            <Send size={18} />
          </button>
        </div>
        <div className="p-2 text-center bg-white border-t border-slate-50">
          <p className="text-[10px] text-slate-400">Powered by DoxeAI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
          >
            {/* Header */}
            <div 
              className="p-4 text-white flex items-center justify-between"
              style={{ backgroundColor: workspace.settings.primaryColor }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  {workspace.settings.logoUrl ? (
                    <img src={workspace.settings.logoUrl} className="w-full h-full rounded-full object-cover" alt="Logo" />
                  ) : (
                    <Car size={20} />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm">{workspace.settings.botName}</p>
                  <p className="text-[10px] opacity-80">Expert Car Consultant</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex flex-col",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                    msg.role === 'user' 
                      ? "bg-blue-600 text-white rounded-tr-none" 
                      : "bg-white text-slate-700 rounded-tl-none border border-slate-100"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                    <motion.div 
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="flex gap-1"
                    >
                      <div className="w-1 h-1 bg-slate-400 rounded-full" />
                      <div className="w-1 h-1 bg-slate-400 rounded-full" />
                      <div className="w-1 h-1 bg-slate-400 rounded-full" />
                    </motion.div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-100 bg-white flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about tuning, parts..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button 
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: workspace.settings.primaryColor }}
              >
                <Send size={18} />
              </button>
            </div>
            <div className="p-2 text-center bg-white border-t border-slate-50">
              <p className="text-[10px] text-slate-400">Powered by DoxeAI</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white relative"
        style={{ backgroundColor: workspace.settings.primaryColor }}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
}
